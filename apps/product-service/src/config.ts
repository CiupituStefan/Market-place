import { baseServiceEnv, booleanString, loadEnv, postgresEnv, SERVICES } from '@market/config';
import { CURRENCIES } from '@market/types';
import { z } from 'zod';

export const SERVICE_NAME = 'product-service';

export const ConfigSchema = baseServiceEnv
  .extend(postgresEnv.shape)
  .extend({
    PORT: z.coerce.number().int().min(1).max(65_535).default(SERVICES[SERVICE_NAME].port),
    MIGRATE_ON_START: booleanString.optional(),
    /** auth-service public keys, for verifying staff tokens on catalog writes. */
    AUTH_JWKS_URL: z.url().default('http://localhost:4001/.well-known/jwks.json'),
    JWT_ISSUER: z.string().min(1).default('cse-auth'),
    /** Single-currency catalog for now; every price row also stores its currency. */
    CATALOG_CURRENCY: z.enum(CURRENCIES).default('EUR'),

    /** Product images: uploaded straight to S3 with pre-signed POSTs, served via CloudFront. */
    S3_BUCKET: z.string().min(1).optional(),
    S3_REGION: z.string().min(1).default('eu-central-1'),
    /** S3-compatible endpoint for local development (MinIO). Unset on AWS. */
    S3_ENDPOINT: z.url().optional(),
    /** Public base URL of the CDN in front of the bucket, e.g. https://cdn.csekeyboards.com */
    ASSET_BASE_URL: z.url().optional(),
    IMAGE_MAX_BYTES: z.coerce
      .number()
      .int()
      .min(1_024)
      .max(50 * 1024 * 1024)
      .default(10 * 1024 * 1024),
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
