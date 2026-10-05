import { extractAccessToken, JWT_VERIFIER, type JwtVerifier } from '@market/nest-common';
import { DomainError, ErrorCode, hasAnyRole } from '@market/types';
import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { resolveRoute } from '../routing/routes.js';

/** Enforces route-level roles (e.g. back office) before proxying. */
@Injectable()
export class EdgeAuthGuard implements CanActivate {
  constructor(@Inject(JWT_VERIFIER) private readonly verifier: JwtVerifier) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const roles = resolveRoute(req.path)?.roles;
    if (!roles) return true;
    const token = extractAccessToken(req.headers);
    if (!token) throw new DomainError(ErrorCode.UNAUTHENTICATED, 'Authentication required');
    const user = await this.verifier.verify(token);
    if (!hasAnyRole(user.roles, roles)) {
      throw new DomainError(ErrorCode.FORBIDDEN, 'You do not have permission to do this');
    }
    return true;
  }
}
