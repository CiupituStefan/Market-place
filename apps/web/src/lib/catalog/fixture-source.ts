import { paginate, type Paginated } from '@market/types';
import { categories, featuredSlugs, products, reviews } from './fixtures';
import { FILTER_KEYS, type CatalogQuery } from './query';
import type { Category, Facet, Product, ProductSummary, Review } from './schemas';

/**
 * In-memory implementation of the catalog read API. It emulates the
 * product-service endpoints (filtering, facets, search, sorting, pagination)
 * so the storefront can be built before the backend exists. It is swapped for
 * HTTP calls in Phase 5; the function signatures stay the same.
 */

export const PAGE_SIZE = 12;

export interface ProductListing extends Paginated<ProductSummary> {
  facets: Facet[];
}

function toSummary(product: Product): ProductSummary {
  const {
    description: _d,
    highlights: _h,
    options: _o,
    variants: _v,
    specs: _s,
    included: _i,
    compatibility: _c,
    faq: _f,
    ...summary
  } = product;
  return summary;
}

function categoryScope(slug: string): Set<string> {
  return new Set([slug, ...categories.filter((c) => c.parentSlug === slug).map((c) => c.slug)]);
}

function normalize(value: string): string {
  return value.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
}

function searchHaystack(product: Product): string {
  const category = categories.find((c) => c.slug === product.categorySlug);
  return normalize(
    [
      product.name,
      product.brand,
      product.tagline,
      category?.name ?? '',
      ...product.variants.map((v) => v.sku),
      ...Object.values(product.attributes).flat(),
    ].join(' '),
  );
}

/** Every search token must appear somewhere (name, brand, SKU, category or attributes). */
export function matchesSearch(product: Product, q: string): boolean {
  const haystack = searchHaystack(product);
  return normalize(q)
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => haystack.includes(token));
}

function matchesFilters(product: Product, query: CatalogQuery, skipKey?: string): boolean {
  for (const { key } of FILTER_KEYS) {
    if (key === skipKey) continue;
    const wanted = query[key];
    if (wanted.length === 0) continue;
    const values = product.attributes[key] ?? [];
    if (!wanted.some((w) => values.includes(w))) return false;
  }
  if (query.inStock && product.availability === 'OUT_OF_STOCK') return false;
  const major = product.price.amount / 100;
  if (query.minPrice !== undefined && major < query.minPrice) return false;
  if (query.maxPrice !== undefined && major > query.maxPrice) return false;
  return true;
}

/**
 * Facet counts follow the usual e-commerce convention: a facet's counts ignore
 * its own selection, so shoppers can still see (and add) sibling values.
 */
function buildFacets(base: Product[], query: CatalogQuery): Facet[] {
  return FILTER_KEYS.map(({ key, label }) => {
    const counts = new Map<string, number>();
    for (const product of base) {
      if (!matchesFilters(product, query, key)) continue;
      for (const value of product.attributes[key] ?? []) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
    }
    for (const selected of query[key]) if (!counts.has(selected)) counts.set(selected, 0);
    return {
      key,
      label,
      values: [...counts.entries()]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => a.value.localeCompare(b.value, 'en', { numeric: true })),
    };
  }).filter((facet) => facet.values.length > 1 || query[facet.key as keyof CatalogQuery]);
}

const featuredRank = (p: Product) => {
  const index = featuredSlugs.indexOf(p.slug);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
};

function sortProducts(items: Product[], sort: CatalogQuery['sort']): Product[] {
  const sorted = [...items];
  switch (sort) {
    case 'newest':
      return sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case 'price-asc':
      return sorted.sort((a, b) => a.price.amount - b.price.amount);
    case 'price-desc':
      return sorted.sort((a, b) => b.price.amount - a.price.amount);
    case 'rating':
      return sorted.sort(
        (a, b) => b.rating.average - a.rating.average || b.rating.count - a.rating.count,
      );
    case 'featured':
      return sorted.sort(
        (a, b) => featuredRank(a) - featuredRank(b) || b.rating.count - a.rating.count,
      );
  }
}

export function listProductsSync(query: CatalogQuery, categorySlug?: string): ProductListing {
  const scope = categorySlug ? categoryScope(categorySlug) : null;
  const base = products.filter(
    (p) => (!scope || scope.has(p.categorySlug)) && (!query.q || matchesSearch(p, query.q)),
  );
  const filtered = sortProducts(
    base.filter((p) => matchesFilters(p, query)),
    query.sort,
  );
  const pagination = { page: query.page, pageSize: PAGE_SIZE };
  const start = (query.page - 1) * PAGE_SIZE;
  return {
    ...paginate(
      filtered.slice(start, start + PAGE_SIZE).map(toSummary),
      filtered.length,
      pagination,
    ),
    facets: buildFacets(base, query),
  };
}

export const fixtureSource = {
  listProducts: (query: CatalogQuery, categorySlug?: string) =>
    Promise.resolve(listProductsSync(query, categorySlug)),

  getProduct: (slug: string) => Promise.resolve(products.find((p) => p.slug === slug) ?? null),

  getCategories: () => Promise.resolve(categories),

  getCategory: (slug: string) => Promise.resolve(categories.find((c) => c.slug === slug) ?? null),

  getFeatured: () =>
    Promise.resolve(
      featuredSlugs
        .map((slug) => products.find((p) => p.slug === slug))
        .filter((p): p is Product => p !== undefined)
        .map(toSummary),
    ),

  getBestSellers: (limit = 4) =>
    Promise.resolve(
      [...products]
        .sort((a, b) => b.rating.count - a.rating.count)
        .slice(0, limit)
        .map(toSummary),
    ),

  getNewArrivals: (limit = 4) =>
    Promise.resolve(sortProducts(products, 'newest').slice(0, limit).map(toSummary)),

  getRelated: (product: Product, limit = 4) =>
    Promise.resolve(
      products
        .filter((p) => p.id !== product.id)
        .sort(
          (a, b) =>
            Number(b.categorySlug === product.categorySlug) -
              Number(a.categorySlug === product.categorySlug) || b.rating.count - a.rating.count,
        )
        .slice(0, limit)
        .map(toSummary),
    ),

  getReviews: (): Promise<Review[]> => Promise.resolve(reviews),

  /** Store-wide rating summary (review-service aggregate in production). */
  getRatingStats: () => {
    const count = products.reduce((total, p) => total + p.rating.count, 0);
    const weighted = products.reduce((total, p) => total + p.rating.average * p.rating.count, 0);
    return Promise.resolve({ average: count ? weighted / count : 0, count });
  },

  getAllProductSlugs: () =>
    Promise.resolve(products.map((p) => ({ slug: p.slug, updatedAt: p.createdAt }))),
};

export type CatalogSource = typeof fixtureSource;

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
