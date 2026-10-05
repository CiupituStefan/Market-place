import { resolveRequestId, runWithContext, type Logger } from '@market/logger';
import { REQUEST_ID_HEADER } from '@market/types';
import type { NextFunction, Request, Response } from 'express';

/** Correlation ID of a request that went through requestContextMiddleware. */
export function getRequestId(req: Request): string {
  const value = req.headers[REQUEST_ID_HEADER];
  return typeof value === 'string' ? value : 'unknown';
}

/**
 * Assigns the correlation ID, echoes it on the response, runs the rest of the
 * request inside an async context (so every log line carries request_id), and
 * writes one structured access-log line when the response finishes.
 */
export function requestContextMiddleware(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const requestId = resolveRequestId(req.headers[REQUEST_ID_HEADER]);
    // Downstream code (filters, the gateway proxy) reads the normalised header.
    req.headers[REQUEST_ID_HEADER] = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);

    // Captured now: Express rewrites req.url/req.path while routing through mounted prefixes.
    const path = req.originalUrl.split('?')[0] ?? req.path;
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
      const fields = {
        request_id: requestId,
        method: req.method,
        path,
        status: res.statusCode,
        duration_ms: Math.round(durationMs * 10) / 10,
      };
      // Probes are frequent and uninteresting; keep them out of info-level logs.
      if (path.startsWith('/health/')) logger.debug(fields, 'request completed');
      else if (res.statusCode >= 500) logger.error(fields, 'request failed');
      else logger.info(fields, 'request completed');
    });

    runWithContext({ requestId }, next);
  };
}
