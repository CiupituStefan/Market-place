import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';
import { configurationId } from './configurator/configurator.service.js';
import { toPrefixTsQuery } from './search/postgres-catalog-search.js';

describe('toPrefixTsQuery', () => {
  it('builds a prefix AND query from words', () => {
    expect(toPrefixTsQuery('Forge 75')).toBe('forge:* & 75:*');
    expect(toPrefixTsQuery('CSE-ATLAS-TKL')).toBe('cse:* & atlas:* & tkl:*');
  });

  it('strips every tsquery operator', () => {
    expect(toPrefixTsQuery("a & b | !c <-> d:* 'e'")).toBe('a:* & b:* & c:* & d:* & e:*');
    expect(toPrefixTsQuery('!!! ***')).toBeNull();
  });

  it('keeps accented letters', () => {
    expect(toPrefixTsQuery('Tastatură')).toBe('tastatură:*');
  });
});

describe('configurationId', () => {
  it('is deterministic and depends on every group', () => {
    const selection = { layout: '75', case: 'black' } as const;
    expect(configurationId('cse-custom', selection)).toBe(
      configurationId('cse-custom', { case: 'black', layout: '75' }),
    );
    expect(configurationId('cse-custom', selection)).not.toBe(configurationId('other', selection));
    expect(configurationId('cse-custom', selection)).toMatch(/^cfg_[0-9a-f]{20}$/);
  });
});

describe('config', () => {
  it('requires a database and migrates on start outside production', () => {
    const dev = loadConfig({ DATABASE_URL: 'postgresql://p:p@localhost:5432/products' });
    expect(dev).toMatchObject({ PORT: 4002, MIGRATE_ON_START: true, CATALOG_CURRENCY: 'EUR' });
    expect(
      loadConfig({ NODE_ENV: 'production', DATABASE_URL: 'postgresql://p:p@db:5432/products' })
        .MIGRATE_ON_START,
    ).toBe(false);
    expect(() => loadConfig({})).toThrow();
  });
});
