import { ConfigError } from '@market/config';
import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

const DATABASE_URL = 'postgresql://orders:pw@localhost:5432/orders';

describe('order-service config', () => {
  it('defaults to the registered port and a 30-minute payment window', () => {
    const config = loadConfig({ DATABASE_URL });
    expect(config.PORT).toBe(4005);
    expect(config.PAYMENT_WINDOW_SECONDS).toBe(1_800);
    expect(config.MIGRATE_ON_START).toBe(true);
  });

  it('never migrates on start in production unless asked', () => {
    expect(loadConfig({ DATABASE_URL, NODE_ENV: 'production' }).MIGRATE_ON_START).toBe(false);
  });

  it('keeps the payment window within what inventory reservations allow', () => {
    expect(() => loadConfig({ DATABASE_URL, PAYMENT_WINDOW_SECONDS: '7200' })).toThrow(ConfigError);
  });
});
