import { ConfigurationQuoteSchema, type ConfigurationSelection } from '@/lib/catalog/schemas';
import type { Locale } from '@/lib/i18n/config';
import { api } from './browser';

/** Server-side price for a selection; labels in the breakdown come in the page's language. */
export function quoteConfiguration(
  slug: string,
  selection: ConfigurationSelection,
  locale: Locale,
) {
  const query = locale === 'en' ? '' : `?locale=${locale}`;
  return api(`/configurator/${encodeURIComponent(slug)}/quote${query}`, {
    method: 'POST',
    body: { selection },
    schema: ConfigurationQuoteSchema,
  });
}
