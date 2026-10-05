import { randomUUID } from 'node:crypto';
import { createPostgresTestDatabase } from '@market/db/testing';
import { DomainError } from '@market/types';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CartService } from '../src/cart/cart.service.js';
import { MIGRATIONS_FOLDER, schema, type Database } from '../src/db/database.js';
import { cartItems, discountCodes } from '../src/db/schema.js';
import { DiscountService } from '../src/discounts/discount.service.js';
import { FakeCatalog, FakeInventory, testConfig } from './harness.js';

/**
 * Usage limits and concurrent cart writes under real row locks. Needs
 * TEST_DATABASE_URL (a server where the user may create databases); CI provides one.
 */
const adminUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!adminUrl)('concurrency on real PostgreSQL', () => {
  let db: Database;
  let close: () => Promise<void>;
  let discounts: DiscountService;
  let carts: CartService;
  const catalog = new FakeCatalog();
  const inventory = new FakeInventory();

  beforeAll(async () => {
    ({ db, close } = await createPostgresTestDatabase({
      adminUrl: adminUrl!,
      schema,
      migrationsFolder: MIGRATIONS_FOLDER,
      maxConnections: 30,
    }));
    const config = testConfig();
    discounts = new DiscountService(db, config);
    carts = new CartService(db, config, catalog, inventory);
  });

  afterAll(async () => {
    await close();
  });

  it('never redeems a limited code more often than its limit', async () => {
    await discounts.create({
      code: 'RACE5',
      type: 'FIXED',
      value: 100,
      minSubtotal: null,
      startsAt: null,
      expiresAt: null,
      usageLimit: 5,
      perCustomerLimit: null,
      active: true,
    });
    const results = await Promise.allSettled(
      Array.from({ length: 30 }, () =>
        discounts.redeem({
          code: 'RACE5',
          orderId: randomUUID(),
          userId: randomUUID(),
          subtotal: 10_00,
        }),
      ),
    );
    const failures = results.filter((r) => r.status === 'rejected');
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(5);
    for (const failure of failures) {
      expect(failure.reason).toBeInstanceOf(DomainError);
    }
    const [row] = await db.select().from(discountCodes).where(eq(discountCodes.code, 'RACE5'));
    expect(row?.usedCount).toBe(5);
  });

  it('counts a retried order once even when the retries race', async () => {
    await discounts.create({
      code: 'RETRY',
      type: 'FIXED',
      value: 100,
      minSubtotal: null,
      startsAt: null,
      expiresAt: null,
      usageLimit: null,
      perCustomerLimit: null,
      active: true,
    });
    const orderId = randomUUID();
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        discounts.redeem({ code: 'RETRY', orderId, userId: null, subtotal: 10_00 }),
      ),
    );
    expect(new Set(results.map((r) => r.orderId))).toEqual(new Set([orderId]));
    const [row] = await db.select().from(discountCodes).where(eq(discountCodes.code, 'RETRY'));
    expect(row?.usedCount).toBe(1);
  });

  it('does not lose quantity when the same item is added concurrently', async () => {
    const variant = catalog.addVariant(10_00);
    inventory.stock.set(variant.variantId, 100);
    const userId = randomUUID();
    await carts.addVariant({ userId, guestToken: null }, variant.variantId, 1);
    await Promise.all(
      Array.from({ length: 5 }, () =>
        carts.addVariant({ userId, guestToken: null }, variant.variantId, 1),
      ),
    );
    const rows = await db
      .select()
      .from(cartItems)
      .where(eq(cartItems.variantId, variant.variantId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.quantity).toBe(6);
  });
});
