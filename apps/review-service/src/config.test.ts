import { ConfigError } from '@market/config';
import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

const DATABASE_URL = 'postgresql://reviews:pw@localhost:5432/reviews';

describe('review-service config', () => {
  it('defaults to the registered port and hides reviews after 3 reports', () => {
    const config = loadConfig({ DATABASE_URL });
    expect(config.PORT).toBe(4008);
    expect(config.REPORTS_TO_HIDE).toBe(3);
  });

  it('fails fast on invalid values', () => {
    expect(() => loadConfig({ DATABASE_URL, REPORTS_TO_HIDE: '0' })).toThrow(ConfigError);
  });
});
