import { baseServiceEnv, booleanString, loadEnv, postgresEnv, SERVICES } from '@market/config';
import { CURRENCIES } from '@market/types';
import { z } from 'zod';

export const SERVICE_NAME = 'cart-service';

export const ConfigSchema = baseServiceEnv
  .extend(postgresEnv.shape)
  .extend({
    PORT: z.coerce.number().int().min(1).max(65_535).default(SERVICES[SERVICE_NAME].port),
    MIGRATE_ON_START: booleanString.optional(),
    AUTH_JWKS_URL: z.url().default('http://localhost:4001/.well-known/jwks.json'),
    JWT_ISSUER: z.string().min(1).default('cse-auth'),
    PRODUCT_SERVICE_URL: z.url().default('http://localhost:4002'),
    INVENTORY_SERVICE_URL: z.url().default('http://localhost:4003'),

    CURRENCY: z.enum(CURRENCIES).default('EUR'),
    /**
     * VAT included in shelf prices, in basis points (2100 = 21%, Romania's standard
     * rate since August 2025). Checkout applies the destination country's rate.
     */
    VAT_RATE_BPS: z.coerce.number().int().min(0).max(5_000).default(2_100),
    FREE_SHIPPING_THRESHOLD: z.coerce.number().int().min(0).default(99_00),
    SHIPPING_FLAT_RATE: z.coerce.number().int().min(0).default(6_90),

    GUEST_CART_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    COOKIE_SECURE: booleanString.optional(),
    COOKIE_DOMAIN: z.string().min(1).optional(),
  })
  .transform((env) => {
    const production = env.NODE_ENV === 'production';
    return {
      ...env,
      MIGRATE_ON_START: env.MIGRATE_ON_START ?? !production,
      COOKIE_SECURE: env.COOKIE_SECURE ?? production,
    };
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
