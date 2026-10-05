import { DomainError, ErrorCode, type AuthUser, type Role } from '@market/types';
import {
  applyDecorators,
  createParamDecorator,
  SetMetadata,
  UseGuards,
  type ExecutionContext,
} from '@nestjs/common';
import { ApiCookieAuth, ApiForbiddenResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthGuard, getAuthUser, REQUIRED_ROLES } from './auth.guard.js';

/**
 * Requires a valid access token; with roles, requires at least one of them.
 *   @Authenticated()                 any signed-in user
 *   @Authenticated('STAFF', 'ADMIN') back-office only
 */
export function Authenticated(...roles: Role[]): MethodDecorator & ClassDecorator {
  return applyDecorators(
    SetMetadata(REQUIRED_ROLES, roles),
    UseGuards(AuthGuard),
    ApiCookieAuth('access_token'),
    ApiUnauthorizedResponse({ description: 'Missing, invalid or expired access token' }),
    ...(roles.length > 0
      ? [ApiForbiddenResponse({ description: `Requires one of: ${roles.join(', ')}` })]
      : []),
  );
}

/** Injects the authenticated user. Only valid on handlers guarded by @Authenticated. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => {
    const user = getAuthUser(context.switchToHttp().getRequest<Request>());
    if (!user) throw new DomainError(ErrorCode.UNAUTHENTICATED, 'Authentication required');
    return user;
  },
);
