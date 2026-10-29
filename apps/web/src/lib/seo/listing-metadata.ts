import type { Metadata } from 'next';
import { activeFilterCount, type CatalogQuery } from '@/lib/catalog/query';
import type { Locale } from '@/lib/i18n/config';
import { localizedAlternates } from './alternates';

/**
 * Faceted URLs would create thousands of near-duplicate pages. Only the
 * unfiltered listing (and its pagination) is indexable; everything canonicalises
 * to it.
 */
export function listingMetadata(
  pathname: string,
  query: CatalogQuery,
  locale: Locale,
): Pick<Metadata, 'alternates' | 'robots'> {
  const filtered = activeFilterCount(query) > 0 || query.sort !== 'featured' || Boolean(query.q);
  const page = query.page > 1 && !filtered ? `${pathname}?page=${String(query.page)}` : pathname;
  return {
    alternates: localizedAlternates(page, locale),
    robots: filtered ? { index: false, follow: true } : { index: true, follow: true },
  };
}
