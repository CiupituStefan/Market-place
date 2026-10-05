import { z } from 'zod';

/**
 * Public runtime configuration. NEXT_PUBLIC_* values are inlined at build time,
 * so each one must be referenced explicitly (no dynamic process.env access).
 */
const PublicEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url().default('http://localhost:3000'),
  NEXT_PUBLIC_API_URL: z.url().default('http://localhost:4000'),
});

/** `FOO=` in an env file means "unset", so empty strings fall back to defaults. */
const unsetIfEmpty = (value: string | undefined) => (value === '' ? undefined : value);

export const publicEnv = PublicEnvSchema.parse({
  NEXT_PUBLIC_SITE_URL: unsetIfEmpty(process.env.NEXT_PUBLIC_SITE_URL),
  NEXT_PUBLIC_API_URL: unsetIfEmpty(process.env.NEXT_PUBLIC_API_URL),
});

/** Base URL for server-side calls: the in-cluster gateway when available. */
export function serverApiUrl(): string {
  return unsetIfEmpty(process.env.API_INTERNAL_URL) ?? publicEnv.NEXT_PUBLIC_API_URL;
}
