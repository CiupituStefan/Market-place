import { baseServiceEnv, booleanString, loadEnv, postgresEnv, SERVICES } from '@market/config';
import { z } from 'zod';

export const SERVICE_NAME = 'auth-service';

export const ConfigSchema = baseServiceEnv
  .extend(postgresEnv.shape)
  .extend({
    PORT: z.coerce.number().int().min(1).max(65_535).default(SERVICES[SERVICE_NAME].port),
    /** Apply migrations at boot. Convenient locally; production runs them as a Job. */
    MIGRATE_ON_START: booleanString.optional(),

    /** Ed25519 private key, PKCS#8 PEM (raw or base64-encoded). Required in production. */
    JWT_PRIVATE_KEY: z.string().min(1).optional(),
    JWT_KEY_ID: z.string().min(1).default('auth-key-1'),
    /** Previous public key (SPKI PEM, raw or base64) kept in the JWKS during key rotation. */
    JWT_PREVIOUS_PUBLIC_KEY: z.string().min(1).optional(),
    JWT_PREVIOUS_KEY_ID: z.string().min(1).optional(),
    JWT_ISSUER: z.string().min(1).default('cse-auth'),

    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3_600).default(900),
    SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
    /** A just-rotated refresh token reused within this window is a benign race (two tabs), not theft. */
    REFRESH_REUSE_GRACE_SECONDS: z.coerce.number().int().min(0).max(60).default(10),

    LOGIN_MAX_FAILURES: z.coerce.number().int().min(3).max(20).default(5),
    LOGIN_LOCKOUT_MINUTES: z.coerce.number().int().min(1).max(1_440).default(15),

    COOKIE_SECURE: booleanString.optional(),
    COOKIE_DOMAIN: z.string().min(1).optional(),

    /** Storefront base URL used in emailed links. */
    WEB_URL: z.url().default('http://localhost:3000'),
    /** Development only: log verification/reset links until notification-service exists. */
    DEV_LOG_EMAIL_LINKS: booleanString.optional(),
  })
  .transform((env) => {
    const production = env.NODE_ENV === 'production';
    return {
      ...env,
      MIGRATE_ON_START: env.MIGRATE_ON_START ?? !production,
      COOKIE_SECURE: env.COOKIE_SECURE ?? production,
      DEV_LOG_EMAIL_LINKS: env.NODE_ENV === 'development' && (env.DEV_LOG_EMAIL_LINKS ?? true),
    };
  })
  .refine((env) => env.NODE_ENV !== 'production' || env.JWT_PRIVATE_KEY !== undefined, {
    path: ['JWT_PRIVATE_KEY'],
    message: 'is required in production',
  })
  .refine((env) => env.NODE_ENV !== 'production' || env.COOKIE_SECURE, {
    path: ['COOKIE_SECURE'],
    message: 'must be true in production',
  });

export type AppConfig = z.infer<typeof ConfigSchema>;

export const APP_CONFIG = Symbol('APP_CONFIG');

export function loadConfig(source?: Record<string, string | undefined>): AppConfig {
  return loadEnv(ConfigSchema, source);
}
