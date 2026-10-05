import { describe, expect, it } from 'vitest';
import { categories, products, reviews } from './fixtures';
import { CategorySchema, ProductSchema, ReviewSchema } from './schemas';
import { findVariant } from './variants';

/** Fixtures must satisfy the same contract the product-service API will. */
describe('catalog fixtures', () => {
  it('match the API schemas', () => {
    for (const product of products) expect(() => ProductSchema.parse(product)).not.toThrow();
    for (const category of categories) expect(() => CategorySchema.parse(category)).not.toThrow();
    for (const review of reviews) expect(() => ReviewSchema.parse(review)).not.toThrow();
  });

  it('have unique ids, slugs and SKUs', () => {
    const ids = [
      ...products.map((p) => p.id),
      ...products.flatMap((p) => p.variants.map((v) => v.id)),
    ];
    const skus = products.flatMap((p) => p.variants.map((v) => v.sku));
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(skus).size).toBe(skus.length);
    expect(new Set(products.map((p) => p.slug)).size).toBe(products.length);
  });

  it('every product points at an existing category', () => {
    const slugs = new Set(categories.map((c) => c.slug));
    for (const product of products) expect(slugs).toContain(product.categorySlug);
  });

  it('every variant is reachable through the product options', () => {
    for (const product of products) {
      for (const variant of product.variants) {
        expect(findVariant(product, variant.options)?.id).toBe(variant.id);
      }
    }
  });

  it('the summary price is the lowest variant price', () => {
    for (const product of products) {
      const lowest = Math.min(...product.variants.map((v) => v.price.amount));
      expect(product.price.amount).toBe(lowest);
    }
  });
});
