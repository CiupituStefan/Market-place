import type { MetadataRoute } from 'next';
import { connection } from 'next/server';
import { catalog } from '@/lib/catalog';
import { contentPages } from '@/lib/content';
import { absoluteUrl } from '@/lib/site';

/** Generated per request (from cached catalog data) so builds do not need the API. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const [categories, products] = await Promise.all([
    catalog.getCategories(),
    catalog.getAllProductSlugs(),
  ]);
  return [
    { url: absoluteUrl('/'), changeFrequency: 'daily', priority: 1 },
    { url: absoluteUrl('/shop'), changeFrequency: 'daily', priority: 0.9 },
    ...categories.map((c) => ({
      url: absoluteUrl(`/shop/${c.slug}`),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
    ...products.map((p) => ({
      url: absoluteUrl(`/product/${p.slug}`),
      lastModified: new Date(p.updatedAt),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    ...Object.keys(contentPages).map((page) => ({
      url: absoluteUrl(`/${page}`),
      changeFrequency: 'monthly' as const,
      priority: 0.3,
    })),
  ];
}
