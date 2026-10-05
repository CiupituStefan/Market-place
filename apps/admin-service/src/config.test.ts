import { ConfigError } from '@market/config';
import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

const DATABASE_URL = 'postgresql://admin:pw@localhost:5432/admin';

describe('admin-service config', () => {
  it('defaults to the registered port, store time zone and currency', () => {
    const config = loadConfig({ DATABASE_URL });
    expect(config.PORT).toBe(4009);
    expect(config.ANALYTICS_TIME_ZONE).toBe('Europe/Bucharest');
    expect(config.ANALYTICS_CURRENCY).toBe('EUR');
  });

  it('fails fast on an unknown time zone', () => {
    expect(() => loadConfig({ DATABASE_URL, ANALYTICS_TIME_ZONE: 'Mars/Olympus' })).toThrow(
      ConfigError,
    );
  });
});
