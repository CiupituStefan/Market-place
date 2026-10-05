import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

export interface RequestContext {
  requestId: string;
  userId?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

/** Runs `fn` with a request context that every log line inside it will carry. */
export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;

/**
 * Reuses an inbound request ID when it is well-formed, otherwise generates one.
 * Rejecting arbitrary values prevents log injection through the header.
 */
export function resolveRequestId(inbound: string | string[] | undefined): string {
  const value = Array.isArray(inbound) ? inbound[0] : inbound;
  return value && SAFE_REQUEST_ID.test(value) ? value : randomUUID();
}
