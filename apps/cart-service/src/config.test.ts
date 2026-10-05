import { ConfigError } from '@market/config';
import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

const DATABASE_URL = 'postgresql://cart:pw@localhost:5432/cart';

describe('cart-service config', () => {
  it('defaults to the registered port and development-friendly settings', () => {
    const config = loadConfig({ DATABASE_URL });
    expect(config.PORT).toBe(4004);
    expect(config.MIGRATE_ON_START).toBe(true);
    expect(config.COOKIE_SECURE).toBe(false);
    expect(config.FREE_SHIPPING_THRESHOLD).toBe(99_00);
  });

  it('uses secure cookies and no auto-migration in production', () => {
    const config = loadConfig({ NODE_ENV: 'production', DATABASE_URL });
    expect(config.COOKIE_SECURE).toBe(true);
    expect(config.MIGRATE_ON_START).toBe(false);
  });

  it('refuses insecure cookies in production', () => {
    expect(() =>
      loadConfig({ NODE_ENV: 'production', DATABASE_URL, COOKIE_SECURE: 'false' }),
    ).toThrow(ConfigError);
  });

  it('fails fast on invalid values', () => {
    expect(() => loadConfig({ DATABASE_URL, VAT_RATE_BPS: '-1' })).toThrow(ConfigError);
  });
});
