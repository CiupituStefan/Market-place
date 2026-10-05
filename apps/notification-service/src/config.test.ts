import { ConfigError } from '@market/config';
import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

const DATABASE_URL = 'postgresql://notifications:pw@localhost:5432/notifications';
const production = {
  NODE_ENV: 'production',
  DATABASE_URL,
  KAFKA_BROKERS: 'b-1.msk:9096',
  UNSUBSCRIBE_SECRET: 's'.repeat(48),
};

describe('notification-service config', () => {
  it('defaults to the registered port and the log provider', () => {
    const config = loadConfig({ DATABASE_URL });
    expect(config.PORT).toBe(4007);
    expect(config.EMAIL_PROVIDER).toBe('log');
  });

  it('requires the settings of the chosen provider', () => {
    expect(() => loadConfig({ DATABASE_URL, EMAIL_PROVIDER: 'smtp' })).toThrow(ConfigError);
    expect(() => loadConfig({ DATABASE_URL, EMAIL_PROVIDER: 'ses' })).toThrow(ConfigError);
    expect(
      loadConfig({ DATABASE_URL, EMAIL_PROVIDER: 'smtp', SMTP_URL: 'smtp://localhost:1025' })
        .SMTP_URL,
    ).toBe('smtp://localhost:1025');
  });

  it('refuses the log provider and the development secret in production', () => {
    expect(() => loadConfig(production)).toThrow(/EMAIL_PROVIDER/);
    const ses = { ...production, EMAIL_PROVIDER: 'ses', SES_REGION: 'eu-central-1' };
    expect(loadConfig(ses).EMAIL_PROVIDER).toBe('ses');
    expect(() => loadConfig({ ...ses, UNSUBSCRIBE_SECRET: undefined })).toThrow(
      /UNSUBSCRIBE_SECRET/,
    );
  });
});
