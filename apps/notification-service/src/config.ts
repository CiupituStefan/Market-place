import { baseServiceEnv, booleanString, loadEnv, postgresEnv, SERVICES } from '@market/config';
import { messagingEnv } from '@market/messaging';
import { z } from 'zod';

export const SERVICE_NAME = 'notification-service';

const DEV_UNSUBSCRIBE_SECRET = 'local-development-unsubscribe-secret-not-for-production';

export const ConfigSchema = baseServiceEnv
  .extend(postgresEnv.shape)
  .extend(messagingEnv.shape)
  .extend({
    PORT: z.coerce.number().int().min(1).max(65_535).default(SERVICES[SERVICE_NAME].port),
    MIGRATE_ON_START: booleanString.optional(),
    AUTH_JWKS_URL: z.url().default('http://localhost:4001/.well-known/jwks.json'),
    JWT_ISSUER: z.string().min(1).default('cse-auth'),

    /** Storefront base URL for links in emails. */
    WEB_URL: z.url().default('http://localhost:3000'),
    /** Public API base URL (the gateway) for one-click unsubscribe (RFC 8058). */
    PUBLIC_API_URL: z.url().default(`http://localhost:${SERVICES['api-gateway'].port}`),

    /**
     * `ses` in AWS, `smtp` for any SMTP server (Mailpit locally), `log` prints emails
     * to the service log (development and tests only).
     */
    EMAIL_PROVIDER: z.enum(['ses', 'smtp', 'log']).default('log'),
    EMAIL_FROM: z.string().min(3).default('CSE Keyboards <hello@csekeyboards.test>'),
    EMAIL_REPLY_TO: z.email().optional(),
    /** e.g. smtp://localhost:1025 (Mailpit) or smtps://user:pass@host:465. */
    SMTP_URL: z.url().optional(),
    /** SES region; credentials come from the pod's IAM role (IRSA), never from env. */
    SES_REGION: z.string().min(1).optional(),
    SES_CONFIGURATION_SET: z.string().min(1).optional(),

    /** Signs unsubscribe links. Rotating it invalidates links in emails already sent. */
    UNSUBSCRIBE_SECRET: z.string().min(32).default(DEV_UNSUBSCRIBE_SECRET),

    /**
     * Events older than this are recorded but not emailed: a new deployment
     * replaying topic history or a re-published dead letter must not mail
     * customers about week-old orders.
     */
    MAX_EVENT_AGE_HOURS: z.coerce.number().int().min(1).max(720).default(24),
    DISPATCH_ENABLED: booleanString.default(true),
    DISPATCH_INTERVAL_MS: z.coerce.number().int().min(100).max(60_000).default(2_000),
    DISPATCH_BATCH_SIZE: z.coerce.number().int().min(1).max(200).default(20),
    /** Delivery attempts before an email is marked FAILED (backoff doubles from 30 s). */
    DISPATCH_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(8),
    /** Template variables (single-use links) are erased this long after a final failure. */
    FAILED_DATA_RETENTION_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  })
  .transform((env) => ({
    ...env,
    MIGRATE_ON_START: env.MIGRATE_ON_START ?? env.NODE_ENV !== 'production',
  }))
  .refine((env) => env.EMAIL_PROVIDER !== 'smtp' || env.SMTP_URL !== undefined, {
    path: ['SMTP_URL'],
    message: 'is required when EMAIL_PROVIDER=smtp',
  })
  .refine((env) => env.EMAIL_PROVIDER !== 'ses' || env.SES_REGION !== undefined, {
    path: ['SES_REGION'],
    message: 'is required when EMAIL_PROVIDER=ses',
  })
  .refine((env) => env.NODE_ENV !== 'production' || env.EMAIL_PROVIDER !== 'log', {
    path: ['EMAIL_PROVIDER'],
    message: 'log only prints emails; use ses or smtp in production',
  })
  .refine(
    (env) => env.NODE_ENV !== 'production' || env.UNSUBSCRIBE_SECRET !== DEV_UNSUBSCRIBE_SECRET,
    { path: ['UNSUBSCRIBE_SECRET'], message: 'must be set in production' },
  );

export type AppConfig = z.infer<typeof ConfigSchema>;

export const APP_CONFIG = Symbol('APP_CONFIG');

export function loadConfig(source?: Record<string, string | undefined>): AppConfig {
  return loadEnv(ConfigSchema, source);
}
