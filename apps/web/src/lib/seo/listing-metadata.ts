import type { Metadata } from 'next';
import { activeFilterCount, type CatalogQuery } from '@/lib/catalog/query';

/**
 * Faceted URLs would create thousands of near-duplicate pages. Only the
 * unfiltered listing (and its pagination) is indexable; everything canonicalises
 * to it.
 */
export function listingMetadata(
  pathname: string,
  query: CatalogQuery,
): Pick<Metadata, 'alternates' | 'robots'> {
  const filtered = activeFilterCount(query) > 0 || query.sort !== 'featured' || Boolean(query.q);
  const canonical = query.page > 1 && !filtered ? `${pathname}?page=${query.page}` : pathname;
  return {
    alternates: { canonical },
    robots: filtered ? { index: false, follow: true } : { index: true, follow: true },
  };
}
