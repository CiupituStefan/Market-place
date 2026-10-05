import { baseServiceEnv, booleanString, loadEnv, postgresEnv, SERVICES } from '@market/config';
import { messagingEnv } from '@market/messaging';
import { z } from 'zod';

export const SERVICE_NAME = 'payment-service';

export const ConfigSchema = baseServiceEnv
  .extend(postgresEnv.shape)
  .extend(messagingEnv.shape)
  .extend({
    PORT: z.coerce.number().int().min(1).max(65_535).default(SERVICES[SERVICE_NAME].port),
    MIGRATE_ON_START: booleanString.optional(),
    AUTH_JWKS_URL: z.url().default('http://localhost:4001/.well-known/jwks.json'),
    JWT_ISSUER: z.string().min(1).default('cse-auth'),
    ORDER_SERVICE_URL: z.url().default('http://localhost:4005'),

    /**
     * `stripe` talks to Stripe. `mock` is an in-process stand-in for local
     * development without Stripe keys; it is refused in production.
     */
    PAYMENT_PROVIDER: z.enum(['stripe', 'mock']).default('stripe'),
    STRIPE_SECRET_KEY: z
      .string()
      .regex(/^(sk|rk)_(test|live)_/, 'must be a Stripe secret key')
      .optional(),
    STRIPE_PUBLISHABLE_KEY: z
      .string()
      .regex(/^pk_(test|live)_/, 'must be a Stripe publishable key')
      .optional(),
    /** Signing secret of the webhook endpoint (also used by the mock provider to sign its events). */
    STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),
    /** Maximum age of a webhook signature (replay protection). */
    WEBHOOK_TOLERANCE_SECONDS: z.coerce.number().int().min(60).max(900).default(300),
  })
  .transform((env) => ({
    ...env,
    MIGRATE_ON_START: env.MIGRATE_ON_START ?? env.NODE_ENV !== 'production',
  }))
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && env.PAYMENT_PROVIDER !== 'stripe') {
      ctx.addIssue({
        code: 'custom',
        path: ['PAYMENT_PROVIDER'],
        message: 'must be stripe in production',
      });
    }
    if (env.PAYMENT_PROVIDER === 'stripe') {
      if (!env.STRIPE_SECRET_KEY)
        ctx.addIssue({
          code: 'custom',
          path: ['STRIPE_SECRET_KEY'],
          message: 'required with the stripe provider',
        });
      if (!env.STRIPE_PUBLISHABLE_KEY)
        ctx.addIssue({
          code: 'custom',
          path: ['STRIPE_PUBLISHABLE_KEY'],
          message: 'required with the stripe provider',
        });
    }
    if (env.NODE_ENV === 'production' && env.STRIPE_SECRET_KEY?.includes('_test_')) {
      ctx.addIssue({
        code: 'custom',
        path: ['STRIPE_SECRET_KEY'],
        message: 'test keys are not allowed in production',
      });
    }
  });

export type AppConfig = z.infer<typeof ConfigSchema>;

export const APP_CONFIG = Symbol('APP_CONFIG');

export function loadConfig(source?: Record<string, string | undefined>): AppConfig {
  return loadEnv(ConfigSchema, source);
}
