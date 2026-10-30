import 'server-only';
import type { CatalogQuery } from '@market/types';
import { z } from 'zod';
import { createApiClient } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { serverApiUrl } from '@/lib/env';
import type { Locale } from '@/lib/i18n/config';
import { PAGE_SIZE, toSearchParams } from './query';
import {
  CategorySchema,
  ConfiguratorSchema,
  ProductListingSchema,
  ProductSchema,
  ProductSummarySchema,
  type Category,
  type Configurator,
  type Product,
  type ProductListing,
  type ProductSummary,
} from './schemas';

/**
 * Catalog reads for Server Components, from product-service through the gateway, in the page's
 * language (product-service returns translated names and descriptions; English otherwise).
 * Responses are cached in Next's data cache for a minute (tag `catalog`), so
 * pages stay fast and the API sees a fraction of the traffic.
 */
const api = createApiClient(serverApiUrl());
const cached = { next: { revalidate: 60, tags: ['catalog'] } };

async function orNull<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/** `?locale=ro` for Romanian; English is the catalog's own language. */
function withLocale(path: string, locale: Locale): string {
  if (locale === 'en') return path;
  return `${path}${path.includes('?') ? '&' : '?'}locale=${locale}`;
}

function listPath(query: Partial<CatalogQuery>, category?: string, pageSize = PAGE_SIZE): string {
  const params = toSearchParams(query);
  if (category) params.set('category', category);
  params.set('pageSize', String(pageSize));
  return `/products?${params.toString()}`;
}

async function list(
  locale: Locale,
  query: Partial<CatalogQuery>,
  category?: string,
  pageSize?: number,
): Promise<ProductListing> {
  return api(withLocale(listPath(query, category, pageSize), locale), {
    schema: ProductListingSchema,
    ...cached,
  });
}

export const catalog = {
  listProducts: (
    locale: Locale,
    query: CatalogQuery,
    categorySlug?: string,
  ): Promise<ProductListing> => list(locale, query, categorySlug),

  getProduct: (locale: Locale, slug: string): Promise<Product | null> =>
    orNull(
      api(withLocale(`/products/${encodeURIComponent(slug)}`, locale), {
        schema: ProductSchema,
        ...cached,
      }),
    ),

  getCategories: (locale: Locale): Promise<Category[]> =>
    api(withLocale('/categories', locale), { schema: z.array(CategorySchema), ...cached }),

  getCategory: async (locale: Locale, slug: string): Promise<Category | null> =>
    (await catalog.getCategories(locale)).find((category) => category.slug === slug) ?? null,

  getFeatured: async (locale: Locale): Promise<ProductSummary[]> =>
    (await list(locale, { sort: 'featured' }, 'keyboards', 4)).items,

  getBestSellers: async (locale: Locale, limit = 4): Promise<ProductSummary[]> =>
    (await list(locale, { sort: 'rating' }, undefined, limit)).items,

  getNewArrivals: async (locale: Locale, limit = 4): Promise<ProductSummary[]> =>
    (await list(locale, { sort: 'newest' }, undefined, limit)).items,

  /** The first hundred products, for the home page's overview of the whole shop. */
  getOverview: async (locale: Locale): Promise<ProductSummary[]> =>
    (await list(locale, { sort: 'featured' }, undefined, 100)).items,

  getRelated: (locale: Locale, product: Product): Promise<ProductSummary[]> =>
    api(withLocale(`/products/${encodeURIComponent(product.slug)}/related`, locale), {
      schema: z.array(ProductSummarySchema),
      ...cached,
    }),

  getConfigurator: (locale: Locale, slug: string): Promise<Configurator | null> =>
    orNull(
      api(withLocale(`/configurator/${encodeURIComponent(slug)}`, locale), {
        schema: ConfiguratorSchema,
        ...cached,
      }),
    ),

  /** Every published product, for the sitemap. */
  getAllProductSlugs: async (): Promise<{ slug: string; updatedAt: string }[]> => {
    const slugs: { slug: string; updatedAt: string }[] = [];
    for (let page = 1; page <= 50; page += 1) {
      const listing = await list('en', { page, sort: 'newest' }, undefined, 100);
      slugs.push(...listing.items.map((item) => ({ slug: item.slug, updatedAt: item.createdAt })));
      if (page >= listing.totalPages) break;
    }
    return slugs;
  },
};

export { PAGE_SIZE } from './query';
export * from './query';
export * from './schemas';

/** Breadcrumb trail for a category, root first. */
export function categoryTrail(all: Category[], slug: string): Category[] {
  const trail: Category[] = [];
  let current = all.find((c) => c.slug === slug);
  while (current) {
    trail.unshift(current);
    const parent = current.parentSlug;
    current = parent ? all.find((c) => c.slug === parent) : undefined;
  }
  return trail;
}
