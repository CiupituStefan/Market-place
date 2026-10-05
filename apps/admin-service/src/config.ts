import { baseServiceEnv, booleanString, loadEnv, postgresEnv, SERVICES } from '@market/config';
import { messagingEnv } from '@market/messaging';
import { CurrencySchema } from '@market/types';
import { z } from 'zod';

export const SERVICE_NAME = 'admin-service';

export const ConfigSchema = baseServiceEnv
  .extend(postgresEnv.shape)
  .extend(messagingEnv.shape)
  .extend({
    PORT: z.coerce.number().int().min(1).max(65_535).default(SERVICES[SERVICE_NAME].port),
    MIGRATE_ON_START: booleanString.optional(),
    AUTH_JWKS_URL: z.url().default('http://localhost:4001/.well-known/jwks.json'),
    JWT_ISSUER: z.string().min(1).default('cse-auth'),
    /** Days and "today" in reports follow the store's time zone, not UTC. */
    ANALYTICS_TIME_ZONE: z.string().min(1).default('Europe/Bucharest'),
    /** Reports are in the catalog currency; orders in other currencies are reported apart. */
    ANALYTICS_CURRENCY: CurrencySchema.default('EUR'),
  })
  .transform((env) => ({
    ...env,
    MIGRATE_ON_START: env.MIGRATE_ON_START ?? env.NODE_ENV !== 'production',
  }))
  .refine(
    (env) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: env.ANALYTICS_TIME_ZONE });
        return true;
      } catch {
        return false;
      }
    },
    { path: ['ANALYTICS_TIME_ZONE'], message: 'must be an IANA time zone' },
  );

export type AppConfig = z.infer<typeof ConfigSchema>;

export const APP_CONFIG = Symbol('APP_CONFIG');

export function loadConfig(source?: Record<string, string | undefined>): AppConfig {
  return loadEnv(ConfigSchema, source);
}
