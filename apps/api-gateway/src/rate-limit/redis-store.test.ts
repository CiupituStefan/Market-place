import { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RedisRateLimitStore } from './redis-store.js';

/** Runs against a real Redis when REDIS_URL is set (CI service container, local docker). */
const url = process.env.REDIS_URL;

describe.skipIf(!url)('RedisRateLimitStore (integration)', () => {
  let redis: Redis;
  const prefix = `test:${Date.now()}:`;

  beforeAll(() => {
    redis = new Redis(url!);
  });

  afterAll(async () => {
    const keys = await redis.keys(`${prefix}*`);
    if (keys.length) await redis.del(...keys);
    await redis.quit();
  });

  it('counts atomically across concurrent hits and sets an expiry', async () => {
    const store = new RedisRateLimitStore(redis, prefix);
    const results = await Promise.all(Array.from({ length: 25 }, () => store.hit('client', 5_000)));
    expect(results.map((r) => r.count).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 25 }, (_, i) => i + 1),
    );
    const ttl = await redis.pttl(`${prefix}client`);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(5_000);
  });

  it('starts a new window after expiry', async () => {
    const store = new RedisRateLimitStore(redis, prefix);
    await store.hit('short', 50);
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect((await store.hit('short', 50)).count).toBe(1);
  });
});
