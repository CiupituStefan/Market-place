export interface RateLimitPolicy {
  name: string;
  /** Requests allowed per window per client IP. */
  limit: number;
  windowMs: number;
  matches: (method: string, path: string) => boolean;
}

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const MINUTE = 60_000;

/**
 * First matching policy wins, so order from most to least specific. Credential
 * and payment endpoints are tight to slow down brute force and card testing.
 */
export const DEFAULT_POLICIES: readonly RateLimitPolicy[] = [
  {
    name: 'auth-credentials',
    limit: 10,
    windowMs: MINUTE,
    matches: (method, path) =>
      method === 'POST' &&
      /^\/api\/v1\/auth\/(login|register|forgot-password|reset-password|verify-email)(\/|$)/.test(
        path,
      ),
  },
  {
    name: 'payments',
    limit: 20,
    windowMs: MINUTE,
    matches: (method, path) => method === 'POST' && path.startsWith('/api/v1/payments/'),
  },
  {
    // Each attempt reserves stock and may claim a discount code: keep it tight.
    name: 'checkout',
    limit: 20,
    windowMs: MINUTE,
    matches: (method, path) => method === 'POST' && /^\/api\/v1\/orders\/?$/.test(path),
  },
  {
    name: 'writes',
    limit: 120,
    windowMs: MINUTE,
    matches: (method) => UNSAFE.has(method),
  },
  {
    name: 'reads',
    limit: 600,
    windowMs: MINUTE,
    matches: () => true,
  },
];

export function selectPolicy(
  policies: readonly RateLimitPolicy[],
  method: string,
  path: string,
): RateLimitPolicy | undefined {
  const upper = method.toUpperCase();
  return policies.find((policy) => policy.matches(upper, path));
}
