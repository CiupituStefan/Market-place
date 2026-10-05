import { z } from 'zod';

/**
 * Client-side validation is for UX only; auth-service enforces the same rules.
 * Password policy follows NIST 800-63B: length over composition rules.
 */
export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;

export const LoginSchema = z.object({
  email: z.email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

export const RegisterSchema = z
  .object({
    firstName: z.string().trim().min(1, 'Enter your first name.').max(80),
    lastName: z.string().trim().min(1, 'Enter your last name.').max(80),
    email: z.email('Enter a valid email address.'),
    password: z
      .string()
      .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters.`)
      .max(PASSWORD_MAX, `Use at most ${PASSWORD_MAX} characters.`),
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, { error: 'You must accept the terms to continue.' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });

export type FieldErrors = Partial<Record<string, string>>;

export function fieldErrors(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.');
    errors[key] ??= issue.message;
  }
  return errors;
}

/**
 * Only same-site relative paths are accepted as post-login redirects, which
 * prevents open-redirect phishing via `/login?next=https://evil.example`.
 */
export function safeRedirect(next: string | null | undefined, fallback = '/account'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\'))
    return fallback;
  return next;
}
