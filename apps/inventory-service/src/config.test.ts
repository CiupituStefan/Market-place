import { ConfigError } from '@market/config';
import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

describe('inventory-service config', () => {
  it('defaults to the registered port', () => {
    expect(loadConfig({}).PORT).toBe(4003);
  });

  it('fails fast on invalid values', () => {
    expect(() => loadConfig({ PORT: 'not-a-port' })).toThrow(ConfigError);
  });
});
