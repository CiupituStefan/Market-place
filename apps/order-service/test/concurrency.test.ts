import { randomUUID } from 'node:crypto';
import { createPostgresTestDatabase } from '@market/db/testing';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MIGRATIONS_FOLDER, schema, type Database } from '../src/db/database.js';
import { orders, outboxEvents } from '../src/db/schema.js';
import { CheckoutService } from '../src/orders/checkout.service.js';
import { OrderService } from '../src/orders/order.service.js';
import { address, cartOf, FakeCart, FakeInventory, testConfig, variantItem } from './harness.js';

/**
 * Races that only a real PostgreSQL (many connections, row locks) can reproduce.
 * Needs TEST_DATABASE_URL; CI provides one.
 */
const adminUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!adminUrl)('concurrency on real PostgreSQL', () => {
  let db: Database;
  let close: () => Promise<void>;
  const cart = new FakeCart();
  const inventory = new FakeInventory();
  let checkout: CheckoutService;
  let ordersService: OrderService;

  beforeAll(async () => {
    ({ db, close } = await createPostgresTestDatabase({
      adminUrl: adminUrl!,
      schema,
      migrationsFolder: MIGRATIONS_FOLDER,
      maxConnections: 30,
    }));
    checkout = new CheckoutService(db, testConfig(), cart, inventory);
    ordersService = new OrderService(db, cart, inventory);
  });

  afterAll(async () => {
    await close();
  });

  function shopper() {
    const userId = randomUUID();
    const item = variantItem(40_00, 1);
    inventory.stock.set(item.variantId!, 100);
    const priced = cart.set({ userId, guestToken: null }, cartOf([item]));
    const request = {
      email: 'race@example.com',
      shippingAddress: { ...address, company: null, line2: null, region: null, phone: null },
      billingAddress: null,
      expectedTotal: priced.total.amount,
      notes: null,
    };
    return { identity: { userId, guestToken: null }, request };
  }

  const eventCount = async (orderId: string, type: string) =>
    (await db.select().from(outboxEvents).where(eq(outboxEvents.messageKey, orderId))).filter(
      (row) => (row.envelope as { eventType: string }).eventType === type,
    ).length;

  it('creates exactly one order for 20 simultaneous submits with the same key', async () => {
    const { identity, request } = shopper();
    const key = randomUUID();
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, () => checkout.place(identity, key, request)),
    );
    const ids = new Set(
      results.flatMap((r) => (r.status === 'fulfilled' ? [r.value.order.id] : [])),
    );
    expect(ids.size).toBe(1);
    const created = await db.select().from(orders).where(eq(orders.userId, identity.userId));
    expect(created).toHaveLength(1);
    // Losers either replayed the order or were told it is still being placed.
    for (const r of results) {
      if (r.status === 'rejected') expect((r.reason as { code: string }).code).toBe('CONFLICT');
    }
  });

  it('never lets a cancellation and a payment both win', async () => {
    for (let round = 0; round < 10; round += 1) {
      const { identity, request } = shopper();
      const { order } = await checkout.place(identity, randomUUID(), request);
      const [paid, cancelled] = await Promise.allSettled([
        ordersService.paymentSucceeded(order.id, {
          paymentId: randomUUID(),
          amount: order.total.amount,
          currency: 'EUR',
        }),
        ordersService.cancel(order.id, 'CUSTOMER_REQUEST', identity.userId),
      ]);
      const [row] = await db.select().from(orders).where(eq(orders.id, order.id));
      const reservation = inventory.forOrder(order.id);
      if (row?.status === 'PAID') {
        expect(cancelled.status).toBe('rejected');
        expect(reservation?.status).toBe('CONFIRMED');
      } else {
        expect(row).toMatchObject({ status: 'CANCELLED', refundRequired: true });
        expect(paid.status === 'fulfilled' && paid.value.outcome).toBe('REFUND_REQUIRED');
        expect(reservation?.status).toBe('RELEASED');
      }
    }
  });

  it('records one payment when the same webhook is processed twice at once', async () => {
    const { identity, request } = shopper();
    const { order } = await checkout.place(identity, randomUUID(), request);
    const paymentId = randomUUID();
    const outcomes = await Promise.all(
      Array.from({ length: 5 }, () =>
        ordersService.paymentSucceeded(order.id, {
          paymentId,
          amount: order.total.amount,
          currency: 'EUR',
        }),
      ),
    );
    expect(outcomes.map((o) => o.outcome).sort()).toEqual([
      'ALREADY_PAID',
      'ALREADY_PAID',
      'ALREADY_PAID',
      'ALREADY_PAID',
      'PAID',
    ]);
    expect(await eventCount(order.id, 'OrderPaid')).toBe(1);
  });
});
