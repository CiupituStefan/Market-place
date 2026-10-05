import { describe, expect, it } from 'vitest';
import { activeFilterCount, PAGE_SIZE, parseCatalogQuery, toSearchParams } from './query';

describe('storefront catalog query', () => {
  it('always uses the storefront page size', () => {
    expect(parseCatalogQuery({ pageSize: '100' }).pageSize).toBe(PAGE_SIZE);
  });

  it('round-trips through the URL and omits defaults', () => {
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

  it('never puts the category or page size in the query string', () => {
    const params = toSearchParams(parseCatalogQuery({ category: 'keyboards' }));
    expect(params.has('category')).toBe(false);
    expect(params.has('pageSize')).toBe(false);
  });

  it('counts active filters', () => {
    expect(
      activeFilterCount(parseCatalogQuery({ layout: '75%,TKL', inStock: '1', minPrice: '10' })),
    ).toBe(4);
  });
});
