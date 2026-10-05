import { baseServiceEnv, booleanString, loadEnv, postgresEnv, SERVICES } from '@market/config';
import { messagingEnv } from '@market/messaging';
import { z } from 'zod';

export const SERVICE_NAME = 'inventory-service';

export const ConfigSchema = baseServiceEnv
  .extend(postgresEnv.shape)
  .extend(messagingEnv.shape)
  .extend({
    PORT: z.coerce.number().int().min(1).max(65_535).default(SERVICES[SERVICE_NAME].port),
    MIGRATE_ON_START: booleanString.optional(),
    AUTH_JWKS_URL: z.url().default('http://localhost:4001/.well-known/jwks.json'),
    JWT_ISSUER: z.string().min(1).default('cse-auth'),

    /** How long checkout holds stock while the shopper pays. */
    RESERVATION_TTL_SECONDS: z.coerce.number().int().min(60).max(3_600).default(900),
    /** How often expired reservations are swept back into available stock. */
    EXPIRY_SWEEP_INTERVAL_MS: z.coerce.number().int().min(1_000).max(300_000).default(15_000),
    EXPIRY_BATCH_SIZE: z.coerce.number().int().min(1).max(1_000).default(100),
    /** Disable the sweeper on some replicas if needed; SKIP LOCKED makes several safe. */
    EXPIRY_WORKER_ENABLED: booleanString.default(true),
    DEFAULT_LOW_STOCK_THRESHOLD: z.coerce.number().int().min(0).max(1_000).default(5),
    /** product-service base URL, only used by the demo seed. */
    PRODUCT_SERVICE_URL: z.url().default('http://localhost:4002'),
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
