import { randomUUID } from 'node:crypto';
import { createPostgresTestDatabase } from '@market/db/testing';
import { DomainError } from '@market/types';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MIGRATIONS_FOLDER, schema, type Database } from '../src/db/database.js';
import { inventoryItems, inventoryReservations } from '../src/db/schema.js';
import { ReservationService } from '../src/reservations/reservation.service.js';
import { StockService } from '../src/stock/stock.service.js';
import { stockUp, testConfig } from './harness.js';

/**
 * Overselling, deadlock and double-processing tests. They need a real PostgreSQL
 * (many connections, row locks, SKIP LOCKED); set TEST_DATABASE_URL to a server
 * where the user may create databases. CI provides one.
 */
const adminUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!adminUrl)('concurrency on real PostgreSQL', () => {
  let db: Database;
  let close: () => Promise<void>;
  let stock: StockService;
  let reservations: ReservationService;

  beforeAll(async () => {
    ({ db, close } = await createPostgresTestDatabase({
      adminUrl: adminUrl!,
      schema,
      migrationsFolder: MIGRATIONS_FOLDER,
      maxConnections: 30,
    }));
    const config = testConfig();
    stock = new StockService(db, config);
    reservations = new ReservationService(db, config);
  });

  afterAll(async () => {
    await close();
  });

  async function level(variantId: string) {
    const [row] = await db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.variantId, variantId));
    return { onHand: row!.onHand, reserved: row!.reserved };
  }

  async function settle<T>(attempts: Promise<T>[]) {
    const results = await Promise.allSettled(attempts);
    const failures = results.filter((r) => r.status === 'rejected').map((r) => r.reason as unknown);
    return { ok: results.filter((r) => r.status === 'fulfilled').length, failures };
  }

  it('sells the last unit exactly once under 25 simultaneous checkouts', async () => {
    const [variant] = await stockUp(stock, [1]);
    const { ok, failures } = await settle(
      Array.from({ length: 25 }, () =>
        reservations.reserve(randomUUID(), [{ variantId: variant!, quantity: 1 }]),
      ),
    );
    expect(ok).toBe(1);
    expect(failures).toHaveLength(24);
    expect(failures.every((e) => e instanceof DomainError && e.code === 'INSUFFICIENT_STOCK')).toBe(
      true,
    );
    expect(await level(variant!)).toEqual({ onHand: 1, reserved: 1 });
  });

  it('never exceeds stock: 10 units, 40 simultaneous orders', async () => {
    const [variant] = await stockUp(stock, [10]);
    const { ok } = await settle(
      Array.from({ length: 40 }, () =>
        reservations.reserve(randomUUID(), [{ variantId: variant!, quantity: 1 }]),
      ),
    );
    expect(ok).toBe(10);
    expect(await level(variant!)).toEqual({ onHand: 10, reserved: 10 });
  });

  it('does not deadlock when orders lock the same items in opposite order', async () => {
    const [a, b] = await stockUp(stock, [1000, 1000]);
    const attempts = Array.from({ length: 30 }, (_, i) =>
      reservations.reserve(
        randomUUID(),
        i % 2 === 0
          ? [
              { variantId: a!, quantity: 1 },
              { variantId: b!, quantity: 1 },
            ]
          : [
              { variantId: b!, quantity: 1 },
              { variantId: a!, quantity: 1 },
            ],
      ),
    );
    const { ok, failures } = await settle(attempts);
    expect(failures).toEqual([]);
    expect(ok).toBe(30);
    expect(await level(a!)).toEqual({ onHand: 1000, reserved: 30 });
  });

  it('creates one reservation when the same checkout is retried concurrently', async () => {
    const [variant] = await stockUp(stock, [5]);
    const orderId = randomUUID();
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        reservations.reserve(orderId, [{ variantId: variant!, quantity: 2 }]),
      ),
    );
    expect(new Set(results.map((r) => r.reservation.id)).size).toBe(1);
    expect(results.filter((r) => r.created)).toHaveLength(1);
    expect(await level(variant!)).toEqual({ onHand: 5, reserved: 2 });
  });

  it('confirms exactly once when the payment webhook is delivered concurrently', async () => {
    const [variant] = await stockUp(stock, [5]);
    const { reservation } = await reservations.reserve(randomUUID(), [
      { variantId: variant!, quantity: 2 },
    ]);
    await Promise.all(Array.from({ length: 8 }, () => reservations.confirm(reservation.id)));
    expect(await level(variant!)).toEqual({ onHand: 3, reserved: 0 });
  });

  it('parallel expiry sweeps release each reservation once', async () => {
    const [variant] = await stockUp(stock, [50]);
    for (let i = 0; i < 20; i += 1)
      await reservations.reserve(randomUUID(), [{ variantId: variant!, quantity: 1 }], 60);
    const later = new Date(Date.now() + 120_000);
    const released = await Promise.all(
      Array.from({ length: 4 }, () => reservations.expireDue(7, later)),
    );
    const more = await reservations.expireDue(100, later);
    expect(released.reduce((sum, n) => sum + n, 0) + more).toBe(20);
    expect(await level(variant!)).toEqual({ onHand: 50, reserved: 0 });
    const active = await db
      .select()
      .from(inventoryReservations)
      .where(eq(inventoryReservations.status, 'ACTIVE'));
    expect(active.filter((r) => r.expiresAt <= later)).toHaveLength(0);
  });

  it('a payment racing the expiry sweep ends in exactly one consistent outcome', async () => {
    const [variant] = await stockUp(stock, [3]);
    const { reservation } = await reservations.reserve(
      randomUUID(),
      [{ variantId: variant!, quantity: 3 }],
      60,
    );
    await Promise.allSettled([
      reservations.confirm(reservation.id),
      reservations.expireDue(100, new Date(Date.now() + 120_000)),
    ]);
    const final = await reservations.get(reservation.id);
    const stockLevel = await level(variant!);
    // Either sold (confirm won, or late confirmation after expiry) or released: never both, never negative.
    expect(['CONFIRMED', 'EXPIRED']).toContain(final.status);
    expect(stockLevel).toEqual(
      final.status === 'CONFIRMED' ? { onHand: 0, reserved: 0 } : { onHand: 3, reserved: 0 },
    );
  });
});
