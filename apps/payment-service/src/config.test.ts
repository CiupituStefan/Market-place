import { ConfigError } from '@market/config';
import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

const base = {
  DATABASE_URL: 'postgresql://payments:pw@localhost:5432/payments',
  STRIPE_WEBHOOK_SECRET: 'whsec_abc',
};

describe('payment-service config', () => {
  it('requires Stripe keys for the stripe provider', () => {
    expect(() => loadConfig(base)).toThrow(ConfigError);
    const config = loadConfig({
      ...base,
      STRIPE_SECRET_KEY: 'sk_test_x',
      STRIPE_PUBLISHABLE_KEY: 'pk_test_x',
    });
    expect(config.PAYMENT_PROVIDER).toBe('stripe');
  });

  it('allows the mock provider outside production only', () => {
    expect(loadConfig({ ...base, PAYMENT_PROVIDER: 'mock' }).PAYMENT_PROVIDER).toBe('mock');
    expect(() => loadConfig({ ...base, PAYMENT_PROVIDER: 'mock', NODE_ENV: 'production' })).toThrow(
      ConfigError,
    );
  });

  it('refuses test keys in production and malformed secrets anywhere', () => {
    expect(() =>
      loadConfig({
        ...base,
        NODE_ENV: 'production',
        STRIPE_SECRET_KEY: 'sk_test_x',
        STRIPE_PUBLISHABLE_KEY: 'pk_live_x',
      }),
    ).toThrow(ConfigError);
    expect(() =>
      loadConfig({ ...base, STRIPE_WEBHOOK_SECRET: 'nope', PAYMENT_PROVIDER: 'mock' }),
    ).toThrow(ConfigError);
  });
});
