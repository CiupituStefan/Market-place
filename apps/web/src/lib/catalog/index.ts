import 'server-only';
import type { CatalogQuery } from '@market/types';
import { z } from 'zod';
import { createApiClient } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { serverApiUrl } from '@/lib/env';
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
 * Catalog reads for Server Components, from product-service through the gateway.
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

function listPath(query: Partial<CatalogQuery>, category?: string, pageSize = PAGE_SIZE): string {
  const params = toSearchParams(query);
  if (category) params.set('category', category);
  params.set('pageSize', String(pageSize));
  return `/products?${params.toString()}`;
}

async function list(
  query: Partial<CatalogQuery>,
  category?: string,
  pageSize?: number,
): Promise<ProductListing> {
  return api(listPath(query, category, pageSize), { schema: ProductListingSchema, ...cached });
}

export const catalog = {
  listProducts: (query: CatalogQuery, categorySlug?: string): Promise<ProductListing> =>
    list(query, categorySlug),

  getProduct: (slug: string): Promise<Product | null> =>
    orNull(api(`/products/${encodeURIComponent(slug)}`, { schema: ProductSchema, ...cached })),

  getCategories: (): Promise<Category[]> =>
    api('/categories', { schema: z.array(CategorySchema), ...cached }),

  getCategory: async (slug: string): Promise<Category | null> =>
    (await catalog.getCategories()).find((category) => category.slug === slug) ?? null,

  getFeatured: async (): Promise<ProductSummary[]> =>
    (await list({ sort: 'featured' }, 'keyboards', 4)).items,

  getBestSellers: async (limit = 4): Promise<ProductSummary[]> =>
    (await list({ sort: 'rating' }, undefined, limit)).items,

  getNewArrivals: async (limit = 4): Promise<ProductSummary[]> =>
    (await list({ sort: 'newest' }, undefined, limit)).items,

  getRelated: (product: Product): Promise<ProductSummary[]> =>
    api(`/products/${encodeURIComponent(product.slug)}/related`, {
      schema: z.array(ProductSummarySchema),
      ...cached,
    }),

  getConfigurator: (slug: string): Promise<Configurator | null> =>
    orNull(
      api(`/configurator/${encodeURIComponent(slug)}`, { schema: ConfiguratorSchema, ...cached }),
    ),

  /** Every published product, for the sitemap. */
  getAllProductSlugs: async (): Promise<{ slug: string; updatedAt: string }[]> => {
    const slugs: { slug: string; updatedAt: string }[] = [];
    for (let page = 1; page <= 50; page += 1) {
      const listing = await list({ page, sort: 'newest' }, undefined, 100);
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
