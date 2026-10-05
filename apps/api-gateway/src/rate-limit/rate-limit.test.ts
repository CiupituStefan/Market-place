import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_POLICIES, selectPolicy } from './policies.js';
import { FallbackRateLimitStore } from './redis-store.js';
import { MemoryRateLimitStore, type RateLimitStore } from './store.js';

describe('MemoryRateLimitStore', () => {
  it('counts hits within a window and resets after it', async () => {
    let now = 1_000;
    const store = new MemoryRateLimitStore(() => now);
    expect(await store.hit('k', 1_000)).toEqual({ count: 1, resetMs: 1_000 });
    now += 400;
    expect(await store.hit('k', 1_000)).toEqual({ count: 2, resetMs: 600 });
    expect((await store.hit('other', 1_000)).count).toBe(1);
    now += 600;
    expect(await store.hit('k', 1_000)).toEqual({ count: 1, resetMs: 1_000 });
  });
});

describe('FallbackRateLimitStore', () => {
  it('uses the fallback when the primary fails, warning at most once per interval', async () => {
    const failing: RateLimitStore = { hit: () => Promise.reject(new Error('redis down')) };
    const onFallback = vi.fn();
    const store = new FallbackRateLimitStore(failing, new MemoryRateLimitStore(), onFallback);
    expect((await store.hit('k', 60_000)).count).toBe(1);
    expect((await store.hit('k', 60_000)).count).toBe(2);
    expect(onFallback).toHaveBeenCalledTimes(1);
  });
});

describe('policies', () => {
  it.each([
    ['POST', '/api/v1/auth/login', 'auth-credentials'],
    ['POST', '/api/v1/auth/register', 'auth-credentials'],
    ['POST', '/api/v1/auth/logout', 'writes'],
    ['POST', '/api/v1/payments/create-intent', 'payments'],
    ['DELETE', '/api/v1/cart/items/1', 'writes'],
    ['POST', '/api/v1/orders', 'checkout'],
    ['POST', '/api/v1/newsletter/subscriptions', 'email-forms'],
    ['POST', '/api/v1/newsletter/confirm', 'writes'],
    ['POST', '/api/v1/orders/1/cancel', 'writes'],
    ['GET', '/api/v1/orders', 'reads'],
    ['GET', '/api/v1/auth/login', 'reads'],
    ['GET', '/api/v1/products', 'reads'],
  ])('%s %s -> %s', (method, path, name) => {
    expect(selectPolicy(DEFAULT_POLICIES, method, path)?.name).toBe(name);
  });

  it('is tighter for credentials than for general writes', () => {
    const limit = (name: string) => DEFAULT_POLICIES.find((p) => p.name === name)!.limit;
    expect(limit('auth-credentials')).toBeLessThan(limit('writes'));
  });
});
