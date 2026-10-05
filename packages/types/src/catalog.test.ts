import { describe, expect, it } from 'vitest';
import { CatalogQuerySchema, ConfigurationQuoteSchema } from './catalog.js';

describe('CatalogQuerySchema', () => {
  it('applies defaults', () => {
    expect(CatalogQuerySchema.parse({})).toMatchObject({
      sort: 'featured',
      page: 1,
      pageSize: 24,
      inStock: false,
      layout: [],
    });
  });

  it('parses comma lists and repeated params', () => {
    const query = CatalogQuerySchema.parse({
      layout: '75%,TKL',
      switchType: ['Linear', 'Tactile'],
    });
    expect(query.layout).toEqual(['75%', 'TKL']);
    expect(query.switchType).toEqual(['Linear', 'Tactile']);
  });

  it('falls back to defaults on invalid values instead of throwing', () => {
    const query = CatalogQuerySchema.parse({
      sort: 'drop table',
      page: '-4',
      pageSize: '5000',
      minPrice: 'abc',
      inStock: 'maybe',
    });
    expect(query).toMatchObject({
      sort: 'featured',
      page: 1,
      pageSize: 24,
      minPrice: undefined,
      inStock: false,
    });
  });

  it('bounds search terms and filter lists', () => {
    expect(CatalogQuerySchema.parse({ q: 'x'.repeat(500) }).q).toBeUndefined();
    expect(CatalogQuerySchema.parse({ q: '   ' }).q).toBeUndefined();
    expect(CatalogQuerySchema.parse({ q: '  forge ' }).q).toBe('forge');
    expect(
      CatalogQuerySchema.parse({ brand: Array.from({ length: 50 }, (_, i) => `b${i}`) }).brand,
    ).toHaveLength(20);
  });
});

describe('ConfigurationQuoteSchema', () => {
  it('requires deterministic configuration ids', () => {
    expect(
      ConfigurationQuoteSchema.shape.configurationId.safeParse('cfg_0123456789abcdef0123').success,
    ).toBe(true);
    expect(ConfigurationQuoteSchema.shape.configurationId.safeParse('cfg_short').success).toBe(
      false,
    );
  });
});
