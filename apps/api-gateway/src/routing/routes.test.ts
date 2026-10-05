import { describe, expect, it } from 'vitest';
import { resolveRoute, ROUTES } from './routes.js';

describe('resolveRoute', () => {
  it.each([
    ['/api/v1/products', 'product-service'],
    ['/api/v1/products/cse-forge-75', 'product-service'],
    ['/api/v1/auth/login', 'auth-service'],
    ['/api/v1/cart/items/', 'cart-service'],
    ['/api/v1/payments/create-intent', 'payment-service'],
    ['/api/v1/admin/orders', 'admin-service'],
  ])('%s -> %s', (path, service) => {
    expect(resolveRoute(path)?.service).toBe(service);
  });

  it('matches on segment boundaries only', () => {
    expect(resolveRoute('/api/v1/productsx')).toBeUndefined();
    expect(resolveRoute('/api/v1/cartography')).toBeUndefined();
  });

  it('prefers the longest prefix (webhook is a machine route)', () => {
    const webhook = resolveRoute('/api/v1/payments/webhook');
    expect(webhook).toMatchObject({ service: 'payment-service', machine: true });
    expect(resolveRoute('/api/v1/payments/refunds')?.machine).toBeUndefined();
  });

  it('never exposes internal or traversal paths', () => {
    expect(resolveRoute('/api/v1/orders/internal/reconcile')).toBeUndefined();
    expect(resolveRoute('/api/v1/orders/INTERNAL/x')).toBeUndefined();
    expect(resolveRoute('/api/v1/orders/../admin')).toBeUndefined();
  });

  it('has unique prefixes', () => {
    const prefixes = ROUTES.map((r) => r.prefix);
    expect(new Set(prefixes).size).toBe(prefixes.length);
  });
});
