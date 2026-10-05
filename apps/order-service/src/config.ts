import { baseServiceEnv, booleanString, loadEnv, postgresEnv, SERVICES } from '@market/config';
import { messagingEnv } from '@market/messaging';
import { z } from 'zod';

export const SERVICE_NAME = 'order-service';

export const ConfigSchema = baseServiceEnv
  .extend(postgresEnv.shape)
  .extend(messagingEnv.shape)
  .extend({
    PORT: z.coerce.number().int().min(1).max(65_535).default(SERVICES[SERVICE_NAME].port),
    MIGRATE_ON_START: booleanString.optional(),
    AUTH_JWKS_URL: z.url().default('http://localhost:4001/.well-known/jwks.json'),
    JWT_ISSUER: z.string().min(1).default('cse-auth'),
    CART_SERVICE_URL: z.url().default('http://localhost:4004'),
    INVENTORY_SERVICE_URL: z.url().default('http://localhost:4003'),

    /** How long a placed order holds stock while the shopper pays (also the reservation TTL). */
    PAYMENT_WINDOW_SECONDS: z.coerce.number().int().min(300).max(3_600).default(1_800),
    /** Extra time before cancelling, so a webhook already in flight can still land. */
    PAYMENT_GRACE_SECONDS: z.coerce.number().int().min(0).max(900).default(120),
    /** A checkout stuck between steps (crash, timeout) is compensated after this long. */
    CHECKOUT_STALE_SECONDS: z.coerce.number().int().min(30).max(3_600).default(300),
    SWEEP_INTERVAL_MS: z.coerce.number().int().min(1_000).max(300_000).default(30_000),
    SWEEP_BATCH_SIZE: z.coerce.number().int().min(1).max(500).default(50),
    /** SKIP LOCKED makes several sweepers safe; disable per replica if needed. */
    SWEEPER_ENABLED: booleanString.default(true),
  })
  .transform((env) => ({
    ...env,
    MIGRATE_ON_START: env.MIGRATE_ON_START ?? env.NODE_ENV !== 'production',
  }));

export type AppConfig = z.infer<typeof ConfigSchema>;

export const APP_CONFIG = Symbol('APP_CONFIG');

export function loadConfig(source?: Record<string, string | undefined>): AppConfig {
  return loadEnv(ConfigSchema, source);
}
