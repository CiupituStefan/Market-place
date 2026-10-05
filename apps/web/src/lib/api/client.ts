import { API_PREFIX, REQUEST_ID_HEADER } from '@market/types';
import type { z } from 'zod';
import { toApiError } from './errors';

export interface RequestOptions<S extends z.ZodType> {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** Response schema: every response is validated before reaching the UI. */
  schema: S;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Next.js fetch cache options for Server Components. */
  next?: { revalidate?: number | false; tags?: string[] };
  cache?: RequestCache;
}

export function buildUrl(
  baseUrl: string,
  path: string,
  query?: RequestOptions<z.ZodType>['query'],
): string {
  const url = new URL(`${API_PREFIX}/${path.replace(/^\//, '')}`, `${baseUrl.replace(/\/$/, '')}/`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '')
      url.searchParams.set(key, String(value));
  }
  return url.toString();
}

/**
 * Typed JSON client for the API gateway. Cookies carry the session (httpOnly),
 * so no token ever touches JavaScript-accessible storage.
 */
export function createApiClient(baseUrl: string) {
  return async function request<S extends z.ZodType>(
    path: string,
    options: RequestOptions<S>,
  ): Promise<z.infer<S>> {
    const headers: Record<string, string> = { accept: 'application/json', ...options.headers };
    if (options.body !== undefined) headers['content-type'] = 'application/json';
    if (!headers[REQUEST_ID_HEADER] && typeof crypto !== 'undefined') {
      headers[REQUEST_ID_HEADER] = crypto.randomUUID();
    }

    const init: RequestInit & { next?: RequestOptions<S>['next'] } = {
      method: options.method ?? 'GET',
      headers,
      credentials: 'include',
    };
    if (options.body !== undefined) init.body = JSON.stringify(options.body);
    if (options.signal) init.signal = options.signal;
    if (options.cache) init.cache = options.cache;
    if (options.next) init.next = options.next;

    const response = await fetch(buildUrl(baseUrl, path, options.query), init);

    if (!response.ok) throw await toApiError(response);
    if (response.status === 204) return options.schema.parse(undefined);
    return options.schema.parse(await response.json());
  };
}
