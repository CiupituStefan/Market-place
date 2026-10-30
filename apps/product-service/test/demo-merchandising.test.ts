import { ProductSchema } from '@market/types';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { products } from '../src/db/schema.js';
import { seedCatalog } from '../src/seed/seed.js';
import { createHarness, type Harness } from './harness.js';

/**
 * Demo ratings, badges and "was" prices are fiction: a deployment real people visit must not
 * show them (fake reviews and fake reference prices). SEED_DEMO_MERCHANDISING=false.
 */
describe('seeding without demo merchandising', () => {
  let h: Harness | undefined;
  afterEach(async () => {
    await h?.close();
  });

  const product = async (slug: string) =>
    ProductSchema.parse((await request(h!.http).get(`/api/v1/products/${slug}`).expect(200)).body);

  it('seeds products with no made-up ratings, badges or reference prices', async () => {
    h = await createHarness({ seed: false });
    await seedCatalog(h.db, h.config, { demoMerchandising: false });
    const nimbus = await product('cse-nimbus-65');
    expect(nimbus.rating).toEqual({ average: 0, count: 0 });
    expect(nimbus.badges).toEqual([]);
    expect(nimbus.compareAtPrice).toBeNull();
    expect(nimbus.variants.every((v) => v.compareAtPrice === null)).toBe(true);
  });

  it('removes them from a catalog seeded earlier, keeping what an admin changed', async () => {
    h = await createHarness(); // seeded with demo merchandising
    expect((await product('cse-forge-75')).badges).toEqual(['BESTSELLER']);
    // An admin's own choice on another product, and a real rating on a third.
    await h.db
      .update(products)
      .set({ badges: ['SALE'] })
      .where(eq(products.slug, 'cse-atlas-tkl'));
    await h.db
      .update(products)
      .set({ ratingAverage: 5, ratingCount: 1 })
      .where(eq(products.slug, 'cse-pulse-60'));

    await seedCatalog(h.db, h.config, { demoMerchandising: false });

    const forge = await product('cse-forge-75');
    expect(forge.badges).toEqual([]);
    expect(forge.rating.count).toBe(0);
    const nimbus = await product('cse-nimbus-65');
    expect(nimbus.badges).toEqual([]);
    expect(nimbus.compareAtPrice).toBeNull();
    expect((await product('cse-atlas-tkl')).badges).toEqual(['SALE']);
    expect((await product('cse-pulse-60')).rating).toEqual({ average: 5, count: 1 });
  });
});
