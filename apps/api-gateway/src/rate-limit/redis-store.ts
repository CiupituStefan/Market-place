import type { Redis } from 'ioredis';
import type { HitResult, RateLimitStore } from './store.js';

/**
 * Atomic fixed-window counter: INCR and set the expiry on the first hit, in one
 * round trip. Shared by all gateway replicas, so limits are global.
 */
const HIT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then redis.call('PEXPIRE', KEYS[1], ARGV[1]); ttl = tonumber(ARGV[1]) end
return { count, ttl }
`;

export class RedisRateLimitStore implements RateLimitStore {
  constructor(
    private readonly redis: Redis,
    private readonly prefix = 'ratelimit:',
  ) {}

  async hit(key: string, windowMs: number): Promise<HitResult> {
    const [count, ttl] = (await this.redis.eval(
      HIT_SCRIPT,
      1,
      `${this.prefix}${key}`,
      windowMs,
    )) as [number, number];
    return { count, resetMs: ttl };
  }
}

/**
 * Uses the primary store and falls back to the secondary when it fails, so a
 * Redis outage degrades rate limiting to per-instance instead of failing open
 * entirely or taking the API down.
 */
export class FallbackRateLimitStore implements RateLimitStore {
  private lastWarning = 0;

  constructor(
    private readonly primary: RateLimitStore,
    private readonly fallback: RateLimitStore,
    private readonly onFallback: (error: unknown) => void,
  ) {}

  async hit(key: string, windowMs: number): Promise<HitResult> {
    try {
      return await this.primary.hit(key, windowMs);
    } catch (error) {
      const now = Date.now();
      if (now - this.lastWarning > 30_000) {
        this.lastWarning = now;
        this.onFallback(error);
      }
      return this.fallback.hit(key, windowMs);
    }
  }
}
