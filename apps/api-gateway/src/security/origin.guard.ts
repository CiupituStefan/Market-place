import { DomainError, ErrorCode } from '@market/types';
import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { resolveRoute } from '../routing/routes.js';
import { isOriginAllowed } from './origin.js';

@Injectable()
export class OriginGuard implements CanActivate {
  private readonly allowed: ReadonlySet<string>;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.allowed = new Set(config.CORS_ORIGINS);
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (resolveRoute(req.path)?.machine) return true;
    const allowed = isOriginAllowed(
      {
        method: req.method,
        origin: req.headers.origin,
        referer: req.headers.referer,
        hasCookies: Boolean(req.headers.cookie),
      },
      this.allowed,
    );
    if (!allowed) throw new DomainError(ErrorCode.FORBIDDEN, 'Cross-site request blocked');
    return true;
  }
}
