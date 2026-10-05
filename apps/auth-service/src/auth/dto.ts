import { RoleSchema } from '@market/types';
import { z } from 'zod';

export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const Email = z.string().trim().max(254).pipe(z.email()).transform(normalizeEmail);

/** NIST 800-63B: long passphrases, no composition rules, bounded to keep hashing cheap. */
const NewPassword = z.string().min(PASSWORD_MIN).max(PASSWORD_MAX);

const Name = z.string().trim().min(1).max(80);

export const RegisterSchema = z
  .object({ email: Email, password: NewPassword, firstName: Name, lastName: Name })
  .strict()
  .refine((data) => data.password.toLowerCase() !== data.email, {
    path: ['password'],
    message: 'Password must not be your email address',
  });
export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z
  .object({ email: Email, password: z.string().min(1).max(PASSWORD_MAX) })
  .strict();
export type LoginInput = z.infer<typeof LoginSchema>;

export const ForgotPasswordSchema = z.object({ email: Email }).strict();

const OneTimeToken = z.string().min(20).max(200);

export const ResetPasswordSchema = z
  .object({ token: OneTimeToken, password: NewPassword })
  .strict();

export const VerifyEmailSchema = z.object({ token: OneTimeToken }).strict();

export const UpdateRolesSchema = z
  .object({ roles: z.array(RoleSchema).min(1).max(3) })
  .strict()
  .refine((data) => data.roles.includes('USER'), {
    path: ['roles'],
    message: 'USER role is required',
  });

export const ListUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  q: z.string().trim().max(100).optional(),
});

/** Public representation of a user (shared contract): never hashes, lockout state or tokens. */
export {
  UserAccountSchema as UserResponseSchema,
  type UserAccount as UserResponse,
} from '@market/types';
