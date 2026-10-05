import { DomainError, ErrorCode } from '@market/types';
import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { Request, Response } from 'express';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { resolveRoute } from '../routing/routes.js';
import { selectPolicy, type RateLimitPolicy } from './policies.js';
import type { RateLimitStore } from './store.js';
import { RATE_LIMIT_POLICIES, RATE_LIMIT_STORE } from './tokens.js';

/**
 * Per-client-IP rate limiting with IETF RateLimit headers. Client IPs come from
 * `req.ip`, which only honours X-Forwarded-For for the configured trusted hops.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(RATE_LIMIT_STORE) private readonly store: RateLimitStore,
    @Inject(RATE_LIMIT_POLICIES) private readonly policies: readonly RateLimitPolicy[],
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.config.RATE_LIMIT_ENABLED) return true;
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    // Machine endpoints (Stripe webhooks) come from a few provider IPs in bursts.
    if (resolveRoute(req.path)?.machine) return true;
    const policy = selectPolicy(this.policies, req.method, req.path);
    if (!policy) return true;

    const client = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const { count, resetMs } = await this.store.hit(`${policy.name}:${client}`, policy.windowMs);
    const resetSeconds = Math.max(1, Math.ceil(resetMs / 1000));
    res.setHeader('RateLimit-Limit', policy.limit);
    res.setHeader('RateLimit-Remaining', Math.max(0, policy.limit - count));
    res.setHeader('RateLimit-Reset', resetSeconds);

    if (count > policy.limit) {
      res.setHeader('Retry-After', resetSeconds);
      throw new DomainError(ErrorCode.RATE_LIMITED, 'Too many requests, please slow down');
    }
    return true;
  }
}
