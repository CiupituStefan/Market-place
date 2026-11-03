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

  it('requires a signing key, an MFA key and secure cookies in production', () => {
    const MFA_ENCRYPTION_KEY = 'a production key of at least thirty-two characters';
    expect(() => loadConfig({ NODE_ENV: 'production', DATABASE_URL, MFA_ENCRYPTION_KEY })).toThrow(
      /JWT_PRIVATE_KEY/,
    );
    expect(() =>
      loadConfig({ NODE_ENV: 'production', DATABASE_URL, JWT_PRIVATE_KEY: 'x' }),
    ).toThrow(/MFA_ENCRYPTION_KEY/);
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        DATABASE_URL,
        JWT_PRIVATE_KEY: 'x',
        MFA_ENCRYPTION_KEY,
        COOKIE_SECURE: 'false',
      }),
    ).toThrow(/COOKIE_SECURE/);
    const prod = loadConfig({
      NODE_ENV: 'production',
      DATABASE_URL,
      JWT_PRIVATE_KEY: 'x',
      MFA_ENCRYPTION_KEY,
    });
    expect(prod).toMatchObject({ COOKIE_SECURE: true, MIGRATE_ON_START: false });
  });

  it('requires a database URL', () => {
    expect(() => loadConfig({})).toThrow(ConfigError);
  });
});
