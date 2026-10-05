import { CatalogQuerySchema, FILTER_KEYS, type CatalogQuery } from '@market/types';

export { FILTER_KEYS, type CatalogQuery, type FilterKey } from '@market/types';

export type RawSearchParams = Record<string, string | string[] | undefined>;

/** Storefront page size: 3 or 4 columns × rows. */
export const PAGE_SIZE = 12;

/** Parses URL search params with the same schema product-service uses. */
export function parseCatalogQuery(params: RawSearchParams): CatalogQuery {
  return CatalogQuerySchema.parse({ ...params, pageSize: PAGE_SIZE });
}

/**
 * Serialises a query back to a URL search string, omitting defaults. The
 * category is part of the path and the page size is fixed, so neither appears.
 */
export function toSearchParams(query: Partial<CatalogQuery>): URLSearchParams {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.sort && query.sort !== 'featured') params.set('sort', query.sort);
  if (query.page && query.page > 1) params.set('page', String(query.page));
  if (query.inStock) params.set('inStock', '1');
  if (query.minPrice !== undefined) params.set('minPrice', String(query.minPrice));
  if (query.maxPrice !== undefined) params.set('maxPrice', String(query.maxPrice));
  for (const { key } of FILTER_KEYS) {
    const values = query[key];
    if (values && values.length > 0) params.set(key, values.join(','));
  }
  return params;
}

export function activeFilterCount(query: CatalogQuery): number {
  return (
    FILTER_KEYS.reduce((total, { key }) => total + query[key].length, 0) +
    (query.inStock ? 1 : 0) +
    (query.minPrice !== undefined || query.maxPrice !== undefined ? 1 : 0)
  );
}
