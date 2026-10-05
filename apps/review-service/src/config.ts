import { baseServiceEnv, booleanString, loadEnv, postgresEnv, SERVICES } from '@market/config';
import { messagingEnv } from '@market/messaging';
import { z } from 'zod';

export const SERVICE_NAME = 'review-service';

export const ConfigSchema = baseServiceEnv
  .extend(postgresEnv.shape)
  .extend(messagingEnv.shape)
  .extend({
    PORT: z.coerce.number().int().min(1).max(65_535).default(SERVICES[SERVICE_NAME].port),
    MIGRATE_ON_START: booleanString.optional(),
    AUTH_JWKS_URL: z.url().default('http://localhost:4001/.well-known/jwks.json'),
    JWT_ISSUER: z.string().min(1).default('cse-auth'),
    PRODUCT_SERVICE_URL: z.url().default('http://localhost:4002'),
    /** Reports from different shoppers that send a published review back to moderation. */
    REPORTS_TO_HIDE: z.coerce.number().int().min(1).max(50).default(3),
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
