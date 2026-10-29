import {
  ProductListingSchema,
  ProductSchema,
  ProductSummarySchema,
  CategorySchema,
} from '@market/types';
import { eq } from 'drizzle-orm';
import { categories, products } from '../src/db/schema.js';
import { seedCatalog } from '../src/seed/seed.js';
import request from 'supertest';
import { z } from 'zod';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHarness, type Harness } from './harness.js';

let h: Harness;

beforeAll(async () => {
  h = await createHarness();
});

afterAll(async () => {
  await h.close();
});

const list = async (query: string) => {
  const res = await request(h.http).get(`/api/v1/products${query}`).expect(200);
  return ProductListingSchema.parse(res.body);
};
const slugs = (listing: { items: { slug: string }[] }) => listing.items.map((p) => p.slug);

describe('listing', () => {
  it('returns published products in the contract shape, featured first', async () => {
    const listing = await list('');
    expect(listing.total).toBe(16);
    expect(slugs(listing).slice(0, 4)).toEqual([
      'cse-forge-75',
      'cse-atlas-tkl',
      'cse-nimbus-65',
      'cse-orbit-96',
    ]);
    expect(listing.items[0]).toMatchObject({
      categorySlug: 'keyboards',
      price: { amount: 18900, currency: 'EUR' },
    });
  });

  it('is cacheable by CDNs', async () => {
    const res = await request(h.http).get('/api/v1/products').expect(200);
    expect(res.headers['cache-control']).toContain('public');
  });

  it('scopes a parent category to its children', async () => {
    const listing = await list('?category=accessories');
    expect(new Set(listing.items.map((p) => p.categorySlug))).toEqual(
      new Set(['stabilizers', 'cables', 'desk-mats', 'wrist-rests']),
    );
    expect((await list('?category=does-not-exist')).total).toBe(0);
  });

  it('ORs values within a facet and ANDs across facets', async () => {
    expect(slugs(await list('?category=keyboards&layout=75%25,TKL&switchType=Clicky'))).toEqual([
      'cse-forge-75',
    ]);
    expect((await list('?layout=75%25&layout=TKL')).total).toBe(2);
  });

  it('computes facet counts that ignore their own selection', async () => {
    const listing = await list('?category=keyboards&layout=75%25');
    const layout = listing.facets.find((f) => f.key === 'layout')!;
    expect(layout.values).toContainEqual({ value: 'TKL', count: 1 });
    const switchType = listing.facets.find((f) => f.key === 'switchType')!;
    expect(switchType.values).toEqual([
      { value: 'Clicky', count: 1 },
      { value: 'Linear', count: 1 },
      { value: 'Tactile', count: 1 },
    ]);
  });

  it('filters by price (major units) and availability', async () => {
    const listing = await list('?minPrice=150&maxPrice=200&category=keyboards');
    expect(listing.total).toBeGreaterThan(0);
    for (const item of listing.items) {
      expect(item.price.amount).toBeGreaterThanOrEqual(15000);
      expect(item.price.amount).toBeLessThanOrEqual(20000);
    }
    expect((await list('?inStock=1')).total).toBe(16);
  });

  it('sorts and paginates stably', async () => {
    const prices = (await list('?sort=price-asc&pageSize=50')).items.map((p) => p.price.amount);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    const page1 = await list('?pageSize=10');
    const page2 = await list('?pageSize=10&page=2');
    expect(page1.totalPages).toBe(2);
    expect(page2.items).toHaveLength(6);
    expect(new Set([...slugs(page1), ...slugs(page2)]).size).toBe(16);
  });

  it('tolerates junk query parameters', async () => {
    const listing = await list('?sort=drop%20table&page=-1&pageSize=99999&minPrice=abc');
    expect(listing.page).toBe(1);
  });
});

describe('search', () => {
  it.each([
    ['forge', 'cse-forge-75'],
    ['CSE-ATLAS-TKL-SIL-LIN', 'cse-atlas-tkl'],
    ['tactile switches', 'cse-ember-tactile'],
    ['walnut', 'walnut-wrist-rest'],
    ['polycarbonate', 'cse-nimbus-65'],
    ['nimb', 'cse-nimbus-65'],
    ['wrist rest', 'walnut-wrist-rest'],
  ])('"%s" finds %s', async (q, slug) => {
    expect(slugs(await list(`?q=${encodeURIComponent(q)}`))).toContain(slug);
  });

  it('tolerates typos (trigram similarity)', async () => {
    expect(slugs(await list('?q=keybaord'))).toEqual(expect.arrayContaining(['cse-forge-75']));
    expect(slugs(await list('?q=walnutt'))).toContain('walnut-wrist-rest');
  });

  it('ranks the best match first', async () => {
    expect(slugs(await list('?q=atlas'))[0]).toBe('cse-atlas-tkl');
  });

  it('treats query syntax and SQL as plain text', async () => {
    for (const q of ["forge' OR 1=1 --", 'a & b | !c', ':*', '%', '\\']) {
      await request(h.http)
        .get(`/api/v1/products?q=${encodeURIComponent(q)}`)
        .expect(200);
    }
    // "%" is matched literally (layouts like "75%"), not as a LIKE wildcard matching everything.
    const percent = await list('?q=%25');
    expect(percent.total).toBeGreaterThan(0);
    expect(percent.total).toBeLessThan(16);
    expect(
      percent.items.every((p) =>
        Object.values(p.attributes)
          .flat()
          .some((v) => v.includes('%')),
      ),
    ).toBe(true);
  });

  it('returns nothing for gibberish', async () => {
    expect((await list('?q=zzqxv')).total).toBe(0);
  });
});

describe('product detail', () => {
  it('returns the full product in the contract shape', async () => {
    const res = await request(h.http).get('/api/v1/products/cse-forge-75').expect(200);
    const product = ProductSchema.parse(res.body);
    expect(product.variants).toHaveLength(9);
    expect(product.attributes).toMatchObject({ brand: ['CSE'], layout: ['75%'] });
    expect(product.options.map((o) => o.key)).toEqual(['color', 'switch']);
  });

  it('404s unknown products with a specific code', async () => {
    const res = await request(h.http).get('/api/v1/products/nope').expect(404);
    expect(res.body.error.code).toBe('PRODUCT_NOT_FOUND');
  });

  it('lists related products, same category first', async () => {
    const res = await request(h.http).get('/api/v1/products/cse-forge-75/related').expect(200);
    expect(res.body).toHaveLength(4);
    expect(res.body[0].categorySlug).toBe('keyboards');
    expect(res.body.map((p: { slug: string }) => p.slug)).not.toContain('cse-forge-75');
  });
});

describe('categories', () => {
  it('lists categories with their parents', async () => {
    const res = await request(h.http).get('/api/v1/categories').expect(200);
    expect(res.body).toHaveLength(8);
    expect(res.body.find((c: { slug: string }) => c.slug === 'cables').parentSlug).toBe(
      'accessories',
    );
    await request(h.http).get('/api/v1/categories/keycaps').expect(200);
    await request(h.http).get('/api/v1/categories/nope').expect(404);
  });
});

describe('internal API', () => {
  it('re-prices variants for other services', async () => {
    const product = (await request(h.http).get('/api/v1/products/cse-forge-75')).body as {
      variants: { id: string }[];
    };
    const res = await request(h.http)
      .post('/api/v1/internal/variants/lookup')
      .send({ variantIds: [product.variants[0]!.id] })
      .expect(200);
    expect(res.body[0]).toMatchObject({
      productSlug: 'cse-forge-75',
      sku: 'CSE-FORGE-75-CAR-LIN',
      optionsLabel: 'Carbon / Silk Linear',
      price: { amount: 18900, currency: 'EUR' },
      productStatus: 'PUBLISHED',
      preview: expect.objectContaining({ kind: 'keyboard', layout: '75%' }),
      imageUrl: null,
    });
  });
});

describe('infrastructure', () => {
  it('readiness checks the database and documents the API', async () => {
    await request(h.http).get('/health/ready').expect(200);
    const spec = await request(h.http).get('/openapi.json').expect(200);
    expect(Object.keys(spec.body.paths)).toEqual(
      expect.arrayContaining(['/api/v1/products', '/api/v1/configurator/{slug}/quote']),
    );
    expect(Object.keys(spec.body.paths).some((p) => p.includes('internal'))).toBe(false);
  });
});

describe('languages', () => {
  const get = async (path: string): Promise<unknown> => {
    const res = await request(h.http).get(`/api/v1${path}`).expect(200);
    return res.body as unknown;
  };

  it('serves Romanian product texts with ?locale=ro, and the same prices and variants', async () => {
    const en = ProductSchema.parse(await get('/products/cse-forge-75'));
    const ro = ProductSchema.parse(await get('/products/cse-forge-75?locale=ro'));
    expect(ro.tagline).toMatch(/^Tastatură mecanică/);
    expect(ro.description[0]).toMatch(/Forge 75 este/);
    expect(ro.specs[0]?.items[1]).toEqual({ label: 'Tip de montaj', value: 'Gasket' });
    expect(ro.options.find((o) => o.key === 'color')?.name).toBe('Culoare');
    expect(ro.faq[0]?.question).toMatch(/^Pot schimba/);
    expect(ro.variants).toEqual(en.variants);
    expect(ro.price).toEqual(en.price);
    expect(en.tagline).toBe('Gasket-mounted 75% in CNC aluminium');
  });

  it('translates listings, related products and categories', async () => {
    const listing = ProductListingSchema.parse(await get('/products?locale=ro&category=switches'));
    expect(listing.items.map((p) => p.name)).toContain('Switch-uri Silk Linear');
    const related = z
      .array(ProductSummarySchema)
      .parse(await get('/products/cse-forge-75/related?locale=ro'));
    expect(related[0]?.tagline).toMatch(/Tastatură/);
    const keyboards = CategorySchema.parse(await get('/categories/keyboards?locale=ro'));
    expect(keyboards.name).toBe('Tastaturi mecanice');
  });

  it('serves English for unknown languages instead of failing', async () => {
    const product = ProductSchema.parse(await get('/products/cse-forge-75?locale=xx'));
    expect(product.tagline).toBe('Gasket-mounted 75% in CNC aluminium');
  });

  it.each([
    ['tastatura', 'cse-forge-75'],
    ['tastatură', 'cse-pulse-60'],
    ['tastaturi mecanice', 'cse-atlas-tkl'],
    ['suport incheieturi', 'walnut-wrist-rest'],
  ])('search "%s" finds %s (Romanian, with or without diacritics)', async (q, slug) => {
    expect(slugs(await list(`?q=${encodeURIComponent(q)}`))).toContain(slug);
  });

  it('adds translations to a catalog seeded before they existed, without overwriting', async () => {
    await h.db.update(products).set({ translations: {} }).where(eq(products.slug, 'cse-orbit-96'));
    await h.db
      .update(products)
      .set({ translations: { ro: { tagline: 'Scris de mână' } } })
      .where(eq(products.slug, 'cse-pulse-60'));
    await h.db.update(categories).set({ translations: {} }).where(eq(categories.slug, 'cables'));
    await seedCatalog(h.db, h.config);
    expect(ProductSchema.parse(await get('/products/cse-orbit-96?locale=ro')).tagline).toMatch(
      /^Tastatură/,
    );
    expect(ProductSchema.parse(await get('/products/cse-pulse-60?locale=ro')).tagline).toBe(
      'Scris de mână',
    );
    expect(CategorySchema.parse(await get('/categories/cables?locale=ro')).name).toBe('Cabluri');
  });
});
