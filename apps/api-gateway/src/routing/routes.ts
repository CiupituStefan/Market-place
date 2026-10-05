import type { UpstreamService } from '../config.js';

export interface RouteDefinition {
  /** Public path prefix, matched on segment boundaries. */
  prefix: string;
  service: UpstreamService;
  /** Overrides the default upstream timeout. */
  timeoutMs?: number;
  /** Overrides the default maximum body size. */
  maxBodyBytes?: number;
  /**
   * Machine-to-machine endpoint (e.g. Stripe webhook): no browser cookies, so it
   * is exempt from the CSRF origin check and from per-IP rate limiting. The
   * upstream authenticates the request itself (Stripe signature).
   */
  machine?: boolean;
}

/**
 * Public API surface. Paths are forwarded unchanged (services also mount their
 * controllers under /api/v1), so OpenAPI paths are identical at both layers.
 */
export const ROUTES: readonly RouteDefinition[] = [
  { prefix: '/api/v1/auth', service: 'auth-service' },
  { prefix: '/api/v1/users', service: 'auth-service' },
  { prefix: '/api/v1/products', service: 'product-service' },
  { prefix: '/api/v1/categories', service: 'product-service' },
  { prefix: '/api/v1/search', service: 'product-service' },
  { prefix: '/api/v1/configurator', service: 'product-service' },
  { prefix: '/api/v1/inventory', service: 'inventory-service' },
  { prefix: '/api/v1/cart', service: 'cart-service' },
  { prefix: '/api/v1/wishlist', service: 'cart-service' },
  { prefix: '/api/v1/discounts', service: 'cart-service' },
  { prefix: '/api/v1/orders', service: 'order-service' },
  {
    prefix: '/api/v1/payments/webhook',
    service: 'payment-service',
    machine: true,
    maxBodyBytes: 512 * 1024,
  },
  { prefix: '/api/v1/payments', service: 'payment-service', timeoutMs: 30_000 },
  { prefix: '/api/v1/newsletter', service: 'notification-service' },
  { prefix: '/api/v1/notifications', service: 'notification-service' },
  { prefix: '/api/v1/reviews', service: 'review-service' },
  { prefix: '/api/v1/admin', service: 'admin-service' },
];

const byLengthDesc = [...ROUTES].sort((a, b) => b.prefix.length - a.prefix.length);

/**
 * Finds the route for a request path (longest prefix wins). Returns undefined for
 * unknown paths and for any path addressing `internal` endpoints, which are for
 * service-to-service calls only and must never be reachable from the internet.
 */
export function resolveRoute(
  path: string,
  routes: readonly RouteDefinition[] = byLengthDesc,
): RouteDefinition | undefined {
  const normalised = path.replace(/\/+$/, '') || '/';
  const segments = normalised.toLowerCase().split('/');
  if (segments.includes('internal') || segments.includes('..')) return undefined;
  return routes.find(
    (route) => normalised === route.prefix || normalised.startsWith(`${route.prefix}/`),
  );
}
