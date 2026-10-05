import { DomainError, ErrorCode, hasAnyRole, type AuthUser, type Role } from '@market/types';
import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { JwtVerifier } from './jwt-verifier.js';
import { extractAccessToken } from './token.js';

export const JWT_VERIFIER = Symbol('JWT_VERIFIER');
export const REQUIRED_ROLES = 'auth:roles';

const users = new WeakMap<Request, AuthUser>();

/** The authenticated user attached by AuthGuard (undefined on public routes). */
export function getAuthUser(req: Request): AuthUser | undefined {
  return users.get(req);
}

/**
 * Authenticates every request it guards and enforces roles. Each service runs it
 * itself (zero trust): being reachable from the gateway is not authorization.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(JWT_VERIFIER) private readonly verifier: JwtVerifier,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const token = extractAccessToken(req.headers);
    if (!token) throw new DomainError(ErrorCode.UNAUTHENTICATED, 'Authentication required');
    const user = await this.verifier.verify(token);

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(REQUIRED_ROLES, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (roles && roles.length > 0 && !hasAnyRole(user.roles, roles)) {
      throw new DomainError(ErrorCode.FORBIDDEN, 'You do not have permission to do this');
    }
    users.set(req, user);
    return true;
  }
}

/**
 * For endpoints that serve both visitors and signed-in users (e.g. the cart).
 * No token: anonymous. A token that is present must be valid; an expired one
 * yields TOKEN_EXPIRED so the client refreshes instead of silently becoming a guest.
 */
@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(@Inject(JWT_VERIFIER) private readonly verifier: JwtVerifier) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const token = extractAccessToken(req.headers);
    if (token) users.set(req, await this.verifier.verify(token));
    return true;
  }
}
