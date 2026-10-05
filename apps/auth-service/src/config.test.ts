import { ConfigError } from '@market/config';
import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

const DATABASE_URL = 'postgresql://auth:secret@localhost:5432/auth';

describe('auth-service config', () => {
  it('has safe development defaults', () => {
    const config = loadConfig({ NODE_ENV: 'development', DATABASE_URL });
    expect(config).toMatchObject({
      PORT: 4001,
      MIGRATE_ON_START: true,
      COOKIE_SECURE: false,
      DEV_LOG_EMAIL_LINKS: true,
      ACCESS_TOKEN_TTL_SECONDS: 900,
    });
  });

  it('never logs email links outside development', () => {
    expect(
      loadConfig({ NODE_ENV: 'test', DATABASE_URL, DEV_LOG_EMAIL_LINKS: 'true' })
        .DEV_LOG_EMAIL_LINKS,
    ).toBe(false);
  });

  it('requires a signing key and secure cookies in production', () => {
    expect(() => loadConfig({ NODE_ENV: 'production', DATABASE_URL })).toThrow(/JWT_PRIVATE_KEY/);
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        DATABASE_URL,
        JWT_PRIVATE_KEY: 'x',
        COOKIE_SECURE: 'false',
      }),
    ).toThrow(/COOKIE_SECURE/);
    const prod = loadConfig({ NODE_ENV: 'production', DATABASE_URL, JWT_PRIVATE_KEY: 'x' });
    expect(prod).toMatchObject({ COOKIE_SECURE: true, MIGRATE_ON_START: false });
  });

  it('requires a database URL', () => {
    expect(() => loadConfig({})).toThrow(ConfigError);
  });
});
