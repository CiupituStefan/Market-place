export interface HitResult {
  /** Requests counted in the current window, including this one. */
  count: number;
  /** Milliseconds until the window resets. */
  resetMs: number;
}

/** Fixed-window counter storage. */
export interface RateLimitStore {
  hit(key: string, windowMs: number): Promise<HitResult>;
}

/**
 * Per-process store, used when Redis is not configured (local dev) and as the
 * fallback while Redis is unreachable. Limits then apply per gateway instance.
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private readonly windows = new Map<string, { count: number; resetAt: number }>();
  private lastSweep = 0;

  constructor(private readonly now: () => number = Date.now) {}

  hit(key: string, windowMs: number): Promise<HitResult> {
    const now = this.now();
    this.sweep(now);
    const current = this.windows.get(key);
    if (!current || current.resetAt <= now) {
      this.windows.set(key, { count: 1, resetAt: now + windowMs });
      return Promise.resolve({ count: 1, resetMs: windowMs });
    }
    current.count += 1;
    return Promise.resolve({ count: current.count, resetMs: current.resetAt - now });
  }

  /** Drops expired windows at most once a minute so memory stays bounded. */
  private sweep(now: number): void {
    if (now - this.lastSweep < 60_000) return;
    this.lastSweep = now;
    for (const [key, window] of this.windows) if (window.resetAt <= now) this.windows.delete(key);
  }
}
