import type { Role } from '@market/types';
import type { UserResponse } from '../auth/dto.js';
import type { UserRow } from '../db/schema.js';

export function toUserResponse(user: UserRow): UserResponse {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    roles: user.roles as Role[],
    emailVerified: user.emailVerifiedAt !== null,
    createdAt: user.createdAt.toISOString(),
  };
}
