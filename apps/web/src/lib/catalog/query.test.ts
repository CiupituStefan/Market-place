import { describe, expect, it } from 'vitest';
import { activeFilterCount, parseCatalogQuery, toSearchParams } from './query';

describe('parseCatalogQuery', () => {
  it('applies defaults', () => {
    expect(parseCatalogQuery({})).toMatchObject({
      sort: 'featured',
      page: 1,
      inStock: false,
      layout: [],
    });
  });

  it('parses comma lists and repeated params', () => {
    const query = parseCatalogQuery({ layout: '75%,TKL', switchType: ['Linear', 'Tactile'] });
    expect(query.layout).toEqual(['75%', 'TKL']);
    expect(query.switchType).toEqual(['Linear', 'Tactile']);
  });

  it('falls back to defaults on invalid values instead of throwing', () => {
    const query = parseCatalogQuery({
      sort: 'drop table',
      page: '-4',
      minPrice: 'abc',
      inStock: 'maybe',
    });
    expect(query).toMatchObject({ sort: 'featured', page: 1, minPrice: undefined, inStock: false });
  });

  it('caps search length', () => {
    expect(parseCatalogQuery({ q: 'x'.repeat(500) }).q).toBeUndefined();
    expect(parseCatalogQuery({ q: '  forge ' }).q).toBe('forge');
  });
});

describe('toSearchParams', () => {
  it('round-trips and omits defaults', () => {
    const query = parseCatalogQuery({
      layout: '75%',
      sort: 'newest',
      page: '2',
      inStock: '1',
      maxPrice: '200',
    });
    const params = toSearchParams(query);
    expect(params.toString()).toBe('sort=newest&page=2&inStock=1&maxPrice=200&layout=75%25');
    expect(parseCatalogQuery(Object.fromEntries(params))).toEqual(query);
    expect(toSearchParams(parseCatalogQuery({})).toString()).toBe('');
  });
});

describe('activeFilterCount', () => {
  it('counts attribute values, stock and price range', () => {
    expect(
      activeFilterCount(parseCatalogQuery({ layout: '75%,TKL', inStock: '1', minPrice: '10' })),
    ).toBe(4);
  });
});
