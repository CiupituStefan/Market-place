import type { Metadata } from 'next';
import { DEFAULT_LOCALE, localizePath, type Locale } from '@/lib/i18n/config';

/**
 * Canonical URL of a page in its language, and its versions in every language (hreflang), so
 * search engines index the Romanian and the English page separately and show the right one.
 */
export function localizedAlternates(path: string, locale: Locale): Metadata['alternates'] {
  return {
    canonical: localizePath(path, locale),
    languages: {
      en: localizePath(path, 'en'),
      ro: localizePath(path, 'ro'),
      'x-default': localizePath(path, DEFAULT_LOCALE),
    },
  };
}
