import type { CatalogQuery, Facet } from '@market/types';

export interface SearchResult {
  /** Product ids for the requested page, in display order. */
  ids: string[];
  total: number;
  facets: Facet[];
}

/**
 * Listing and search over published products. The PostgreSQL implementation
 * (full-text + trigram) is enough for thousands of products; an OpenSearch
 * implementation can replace it behind this interface, fed by ProductCreated /
 * ProductUpdated events, without touching controllers or the storefront.
 */
export interface CatalogSearch {
  search(query: CatalogQuery): Promise<SearchResult>;
}

export const CATALOG_SEARCH = Symbol('CATALOG_SEARCH');
