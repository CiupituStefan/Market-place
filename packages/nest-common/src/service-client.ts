import { getRequestContext } from '@market/logger';
import {
  ApiErrorBodySchema,
  DomainError,
  ErrorCode,
  REQUEST_ID_HEADER,
  API_PREFIX,
} from '@market/types';
import type { z } from 'zod';

export interface ServiceClientOptions {
  /** Base URL of the target service, e.g. http://product-service:4002 */
  baseUrl: string;
  /** Name used in error messages and logs. */
  service: string;
  timeoutMs?: number;
}

export interface ServiceRequest<S extends z.ZodType> {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  schema: S;
}

/**
 * Typed JSON client for synchronous service-to-service calls.
 * - propagates the caller's x-request-id (end-to-end correlation);
 * - bounded by a timeout (a slow dependency must not hold the caller's request open);
 * - 4xx responses in the standard error format are re-thrown as the same DomainError,
 *   so e.g. INSUFFICIENT_STOCK from inventory reaches the shopper unchanged;
 * - network errors, timeouts and 5xx become SERVICE_UNAVAILABLE.
 */
export function createServiceClient(options: ServiceClientOptions) {
  const base = options.baseUrl.replace(/\/$/, '');
  const timeoutMs = options.timeoutMs ?? 3_000;

  return async function call<S extends z.ZodType>(
    path: string,
    request: ServiceRequest<S>,
  ): Promise<z.infer<S>> {
    const headers: Record<string, string> = { accept: 'application/json' };
    const requestId = getRequestContext()?.requestId;
    if (requestId) headers[REQUEST_ID_HEADER] = requestId;
    if (request.body !== undefined) headers['content-type'] = 'application/json';

    let response: Response;
    try {
      response = await fetch(`${base}/${API_PREFIX}/${path.replace(/^\//, '')}`, {
        method: request.method ?? 'GET',
        headers,
        ...(request.body !== undefined ? { body: JSON.stringify(request.body) } : {}),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new DomainError(ErrorCode.SERVICE_UNAVAILABLE, `${options.service} is unavailable`);
    }

    if (response.ok) {
      // 204 / empty bodies parse as undefined (use z.unknown() or z.undefined()).
      const text = await response.text();
      let json: unknown;
      try {
        json = text === '' ? undefined : JSON.parse(text);
      } catch {
        json = Symbol('invalid');
      }
      const parsed = request.schema.safeParse(json);
      if (!parsed.success)
        throw new DomainError(
          ErrorCode.SERVICE_UNAVAILABLE,
          `${options.service} returned an unexpected response`,
        );
      return parsed.data;
    }
    if (response.status >= 400 && response.status < 500) {
      const body = ApiErrorBodySchema.safeParse(await response.json().catch(() => null));
      if (body.success)
        throw new DomainError(
          body.data.error.code,
          body.data.error.message,
          body.data.error.details,
        );
    }
    throw new DomainError(ErrorCode.SERVICE_UNAVAILABLE, `${options.service} is unavailable`);
  };
}

export type ServiceClient = ReturnType<typeof createServiceClient>;
