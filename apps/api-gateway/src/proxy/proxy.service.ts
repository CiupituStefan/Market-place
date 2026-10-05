import { pipeline } from 'node:stream/promises';
import { getRequestId } from '@market/nest-common';
import { DomainError, ErrorCode } from '@market/types';
import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Agent, errors as undiciErrors, request } from 'undici';
import { APP_CONFIG, upstreamUrl, type AppConfig } from '../config.js';
import type { RouteDefinition } from '../routing/routes.js';
import { BodyLimit, payloadTooLarge } from './body-limit.js';
import { buildUpstreamRequestHeaders, filterUpstreamResponseHeaders } from './headers.js';

const BODYLESS_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Streams requests to upstream services and responses back without buffering
 * or parsing bodies. Raw bodies matter: Stripe webhook signatures are computed
 * over the exact bytes Stripe sent.
 */
@Injectable()
export class ProxyService implements OnModuleDestroy {
  private readonly logger = new Logger(ProxyService.name);
  // One pooled, keep-alive connection agent shared by all upstreams.
  private readonly agent = new Agent({
    keepAliveTimeout: 10_000,
    connections: 256,
    connect: { timeout: 2_000 },
  });

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async onModuleDestroy(): Promise<void> {
    await this.agent.close();
  }

  async forward(req: Request, res: Response, route: RouteDefinition): Promise<void> {
    const maxBytes = route.maxBodyBytes ?? this.config.MAX_BODY_BYTES;
    const declaredLength = Number(req.headers['content-length'] ?? 0);
    if (declaredLength > maxBytes) throw payloadTooLarge(maxBytes);

    const target = new URL(req.originalUrl, upstreamUrl(this.config, route.service));
    const timeout = route.timeoutMs ?? this.config.UPSTREAM_TIMEOUT_MS;
    const hasBody = !BODYLESS_METHODS.has(req.method);

    // Cancel the upstream call if the client goes away mid-request.
    const abort = new AbortController();
    res.on('close', () => {
      if (!res.writableFinished) abort.abort();
    });

    let upstream: Awaited<ReturnType<typeof request>>;
    try {
      upstream = await request(target, {
        method: req.method as 'GET',
        headers: buildUpstreamRequestHeaders(req.headers, {
          requestId: getRequestId(req),
          clientIp: req.ip ?? req.socket.remoteAddress ?? 'unknown',
          protocol: req.protocol,
          host: req.headers.host,
        }),
        body: hasBody ? req.pipe(new BodyLimit(maxBytes)) : null,
        dispatcher: this.agent,
        headersTimeout: timeout,
        bodyTimeout: timeout,
        signal: abort.signal,
      });
    } catch (error) {
      throw this.mapUpstreamError(error, route);
    }

    res.status(upstream.statusCode);
    for (const [name, value] of Object.entries(filterUpstreamResponseHeaders(upstream.headers))) {
      res.setHeader(name, value);
    }
    try {
      await pipeline(upstream.body, res);
    } catch (error) {
      // Headers are already sent; the exception filter will abort the socket.
      if (!abort.signal.aborted) {
        this.logger.warn(`response stream from ${route.service} failed: ${String(error)}`);
      }
    }
  }

  private mapUpstreamError(error: unknown, route: RouteDefinition): Error {
    const cause = findCause(error);
    if (cause instanceof DomainError) return cause;
    if (
      cause instanceof undiciErrors.HeadersTimeoutError ||
      cause instanceof undiciErrors.BodyTimeoutError
    ) {
      this.logger.warn(`upstream ${route.service} timed out`);
      return new DomainError(ErrorCode.UPSTREAM_TIMEOUT, 'The service took too long to respond');
    }
    this.logger.warn(`upstream ${route.service} unavailable: ${describe(cause)}`);
    return new DomainError(ErrorCode.SERVICE_UNAVAILABLE, 'The service is temporarily unavailable');
  }
}

/** Errors from the request body stream are wrapped by undici; unwrap to the original. */
function findCause(error: unknown): unknown {
  let current: unknown = error;
  for (let depth = 0; depth < 5; depth += 1) {
    if (current instanceof DomainError) return current;
    if (current instanceof Error && current.cause !== undefined) current = current.cause;
    else break;
  }
  return current instanceof DomainError ? current : error;
}

function describe(error: unknown): string {
  if (error instanceof Error)
    return 'code' in error ? `${String(error.code)} ${error.message}` : error.message;
  return String(error);
}
