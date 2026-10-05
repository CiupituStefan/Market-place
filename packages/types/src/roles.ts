import { z } from 'zod';

export const ROLES = ['USER', 'STAFF', 'ADMIN'] as const;
export const RoleSchema = z.enum(ROLES);
export type Role = z.infer<typeof RoleSchema>;

/** Roles allowed into the back-office (admin dashboard / admin APIs). */
export const BACK_OFFICE_ROLES: readonly Role[] = ['STAFF', 'ADMIN'];

export function hasAnyRole(userRoles: readonly Role[], required: readonly Role[]): boolean {
  return required.some((role) => userRoles.includes(role));
}
