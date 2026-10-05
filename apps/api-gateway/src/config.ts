import {
  baseServiceEnv,
  booleanString,
  commaList,
  loadEnv,
  SERVICES,
  type ServiceName,
} from '@market/config';
import { z } from 'zod';

export const SERVICE_NAME = 'api-gateway';

/** Services the gateway routes to. Each URL is configurable via `<SERVICE>_URL`. */
export const UPSTREAM_SERVICES = [
  'auth-service',
  'product-service',
  'inventory-service',
  'cart-service',
  'order-service',
  'payment-service',
  'notification-service',
  'review-service',
  'admin-service',
] as const satisfies readonly ServiceName[];
export type UpstreamService = (typeof UPSTREAM_SERVICES)[number];

const upstream = (service: UpstreamService) =>
  z.url({ protocol: /^https?$/ }).default(`http://localhost:${SERVICES[service].port}`);

/** Upstream base URLs (in Kubernetes: http://<service>.<namespace>.svc.cluster.local). */
const UpstreamUrls = z.object({
  AUTH_SERVICE_URL: upstream('auth-service'),
  PRODUCT_SERVICE_URL: upstream('product-service'),
  INVENTORY_SERVICE_URL: upstream('inventory-service'),
  CART_SERVICE_URL: upstream('cart-service'),
  ORDER_SERVICE_URL: upstream('order-service'),
  PAYMENT_SERVICE_URL: upstream('payment-service'),
  NOTIFICATION_SERVICE_URL: upstream('notification-service'),
  REVIEW_SERVICE_URL: upstream('review-service'),
  ADMIN_SERVICE_URL: upstream('admin-service'),
});

type UpstreamKey = keyof z.infer<typeof UpstreamUrls>;

export function upstreamEnvKey(service: UpstreamService): UpstreamKey {
  return `${service.toUpperCase().replace(/-/g, '_')}_URL` as UpstreamKey;
}

export const ConfigSchema = baseServiceEnv
  .extend({
    PORT: z.coerce.number().int().min(1).max(65_535).default(SERVICES[SERVICE_NAME].port),
    /** Browser origins allowed for CORS and for cookie-authenticated writes (CSRF check). */
    CORS_ORIGINS: commaList.default(['http://localhost:3000']),
    /** Reverse-proxy hops in front of the gateway (ALB/ingress) to trust for client IPs. */
    TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
    /** Optional: without Redis, rate limits are tracked per gateway instance. */
    REDIS_URL: z.url({ protocol: /^rediss?$/ }).optional(),
    RATE_LIMIT_ENABLED: booleanString.default(true),
    /** Default upstream timeout; some routes (payments) override it. */
    UPSTREAM_TIMEOUT_MS: z.coerce.number().int().min(100).max(120_000).default(10_000),
    /** Maximum request body accepted and streamed upstream. */
    MAX_BODY_BYTES: z.coerce
      .number()
      .int()
      .min(1_024)
      .max(50 * 1024 * 1024)
      .default(1024 * 1024),
    DOCS_ENABLED: booleanString.optional(),
    /** Where to fetch auth-service's public keys; defaults to the auth-service upstream. */
    AUTH_JWKS_URL: z.url({ protocol: /^https?$/ }).optional(),
    JWT_ISSUER: z.string().min(1).default('cse-auth'),
  })
  .extend(UpstreamUrls.shape)
  .transform((env) => ({
    ...env,
    DOCS_ENABLED: env.DOCS_ENABLED ?? env.NODE_ENV !== 'production',
    AUTH_JWKS_URL:
      env.AUTH_JWKS_URL ?? new URL('/.well-known/jwks.json', env.AUTH_SERVICE_URL).toString(),
  }));

export type AppConfig = z.infer<typeof ConfigSchema>;

export const APP_CONFIG = Symbol('APP_CONFIG');

export function loadConfig(source?: Record<string, string | undefined>): AppConfig {
  return loadEnv(ConfigSchema, source);
}

export function upstreamUrl(config: AppConfig, service: UpstreamService): string {
  return config[upstreamEnvKey(service)];
}
