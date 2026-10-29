import type { MetadataRoute } from 'next';
import { connection } from 'next/server';
import { catalog } from '@/lib/catalog';
import { contentPages } from '@/lib/content';
import { LOCALES, localizePath } from '@/lib/i18n/config';
import { absoluteUrl } from '@/lib/site';

type Entry = MetadataRoute.Sitemap[number];

/** One entry per language, each listing every language's URL (hreflang). */
function localized(path: string, entry: Omit<Entry, 'url' | 'alternates'>): Entry[] {
  const languages = Object.fromEntries(
    LOCALES.map((locale) => [locale, absoluteUrl(localizePath(path, locale))]),
  );
  return LOCALES.map((locale) => ({
    ...entry,
    url: absoluteUrl(localizePath(path, locale)),
    alternates: { languages },
  }));
}

/** Generated per request (from cached catalog data) so builds do not need the API. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const [categories, products] = await Promise.all([
    catalog.getCategories('en'),
    catalog.getAllProductSlugs(),
  ]);
  return [
    ...localized('/', { changeFrequency: 'daily', priority: 1 }),
    ...localized('/shop', { changeFrequency: 'daily', priority: 0.9 }),
    ...localized('/configurator', { changeFrequency: 'weekly', priority: 0.6 }),
    ...categories.flatMap((c) =>
      localized(`/shop/${c.slug}`, { changeFrequency: 'daily', priority: 0.8 }),
    ),
    ...products.flatMap((p) =>
      localized(`/product/${p.slug}`, {
        lastModified: new Date(p.updatedAt),
        changeFrequency: 'weekly',
        priority: 0.7,
      }),
    ),
    ...Object.keys(contentPages).flatMap((page) =>
      localized(`/${page}`, { changeFrequency: 'monthly', priority: 0.3 }),
    ),
  ];
}
