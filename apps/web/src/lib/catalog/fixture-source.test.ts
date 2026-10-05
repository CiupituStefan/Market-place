import { describe, expect, it } from 'vitest';
import { categories } from './fixtures';
import { categoryTrail, fixtureSource, listProductsSync, PAGE_SIZE } from './fixture-source';
import { parseCatalogQuery } from './query';

const list = (params: Record<string, string>, category?: string) =>
  listProductsSync(parseCatalogQuery(params), category);

describe('catalog listing', () => {
  it('scopes a parent category to its children', () => {
    const accessories = list({}, 'accessories');
    expect(accessories.items.map((p) => p.categorySlug).sort()).toEqual(
      ['cables', 'desk-mats', 'stabilizers', 'wrist-rests'].sort(),
    );
  });

  it('filters by multi-valued attributes (OR within a facet, AND across facets)', () => {
    const result = list({ layout: '75%,TKL', switchType: 'Clicky' }, 'keyboards');
    expect(result.items.map((p) => p.slug)).toEqual(['cse-forge-75']);
  });

  it('computes facet counts that ignore their own selection', () => {
    const result = list({ layout: '75%' }, 'keyboards');
    const layout = result.facets.find((f) => f.key === 'layout');
    expect(layout?.values.length).toBeGreaterThan(1);
    expect(layout?.values.find((v) => v.value === 'TKL')?.count).toBe(1);
  });

  it('filters by price in major units', () => {
    const result = list({ minPrice: '150', maxPrice: '200' }, 'keyboards');
    for (const p of result.items) {
      expect(p.price.amount).toBeGreaterThanOrEqual(15000);
      expect(p.price.amount).toBeLessThanOrEqual(20000);
    }
    expect(result.total).toBeGreaterThan(0);
  });

  it('sorts by price', () => {
    const prices = list({ sort: 'price-asc' }).items.map((p) => p.price.amount);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it('paginates', () => {
    const page1 = list({});
    expect(page1.items).toHaveLength(PAGE_SIZE);
    const page2 = list({ page: '2' });
    expect(page2.items.length).toBe(page1.total - PAGE_SIZE);
    expect(page1.totalPages).toBe(2);
  });

  it('does not leak detail fields into summaries', () => {
    expect(list({}).items[0]).not.toHaveProperty('variants');
  });
});

describe('search', () => {
  it.each([
    ['forge', 'cse-forge-75'],
    ['CSE-ATLAS-TKL-SIL-LIN', 'cse-atlas-tkl'],
    ['tactile switches', 'cse-ember-tactile'],
    ['walnut', 'walnut-wrist-rest'],
    ['polycarbonate', 'cse-nimbus-65'],
  ])('finds "%s"', (q, slug) => {
    expect(list({ q }).items.map((p) => p.slug)).toContain(slug);
  });

  it('requires every token to match', () => {
    expect(list({ q: 'forge walnut' }).total).toBe(0);
  });
});

describe('fixtureSource', () => {
  it('returns null for unknown products', async () => {
    expect(await fixtureSource.getProduct('nope')).toBeNull();
  });

  it('related products prefer the same category and exclude the product', async () => {
    const product = await fixtureSource.getProduct('cse-forge-75');
    const related = await fixtureSource.getRelated(product!, 4);
    expect(related.map((p) => p.slug)).not.toContain('cse-forge-75');
    expect(related[0]?.categorySlug).toBe('keyboards');
  });

  it('builds breadcrumb trails root first', () => {
    expect(categoryTrail(categories, 'cables').map((c) => c.slug)).toEqual([
      'accessories',
      'cables',
    ]);
  });
});
