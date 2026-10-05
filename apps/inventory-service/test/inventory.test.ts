import { randomUUID } from 'node:crypto';
import { outboxEvents } from '@market/db';
import {
  InventoryDecrementedV1,
  InventoryReleasedV1,
  InventoryReservationExpiredV1,
  InventoryReservedV1,
  InventoryStockChangedV1,
} from '@market/events';
import { eq, sql } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inventoryItems } from '../src/db/schema.js';
import { createHarness, stockUp, type Harness } from './harness.js';

let h: Harness;
let staff: string;

beforeAll(async () => {
  h = await createHarness();
  staff = await h.token(['USER', 'STAFF']);
});

afterAll(async () => {
  await h.close();
});

const reserve = (
  orderId: string,
  lines: { variantId: string; quantity: number }[],
  ttlSeconds?: number,
) =>
  request(h.http)
    .post('/api/v1/internal/reservations')
    .send({ orderId, lines, ...(ttlSeconds ? { ttlSeconds } : {}) });

async function level(variantId: string) {
  const [row] = await h.db
    .select()
    .from(inventoryItems)
    .where(eq(inventoryItems.variantId, variantId));
  return { onHand: row!.onHand, reserved: row!.reserved };
}

async function eventsOf(type: string, aggregateId: string) {
  const rows = await h.db.select().from(outboxEvents);
  return rows
    .map((r) => r.envelope as { eventType: string; aggregateId: string; payload: unknown })
    .filter((e) => e.eventType === type && e.aggregateId === aggregateId)
    .map((e) => e.payload);
}

describe('back-office stock management', () => {
  it('is closed to anonymous users and customers', async () => {
    await request(h.http).get('/api/v1/inventory').expect(401);
    await request(h.http)
      .get('/api/v1/inventory')
      .set('cookie', `cse_at=${await h.token(['USER'])}`)
      .expect(403);
  });

  it('records received goods and corrections in the ledger', async () => {
    const [variant] = await stockUp(h.stock, [0]);
    await request(h.http)
      .post(`/api/v1/inventory/${variant}/adjustments`)
      .set('cookie', `cse_at=${staff}`)
      .send({ type: 'RECEIVED', delta: 12, reason: 'PO-1042' })
      .expect(201);
    const corrected = await request(h.http)
      .post(`/api/v1/inventory/${variant}/adjustments`)
      .set('cookie', `cse_at=${staff}`)
      .send({ type: 'ADJUSTMENT', delta: -2, reason: 'cycle count' })
      .expect(201);
    expect(corrected.body).toMatchObject({
      onHand: 10,
      reserved: 0,
      available: 10,
      status: 'IN_STOCK',
    });

    const ledger = await request(h.http)
      .get(`/api/v1/inventory/${variant}/movements`)
      .set('cookie', `cse_at=${staff}`)
      .expect(200);
    expect(ledger.body.slice(0, 2)).toMatchObject([
      { type: 'ADJUSTMENT', onHandDelta: -2, onHandAfter: 10, reason: 'cycle count' },
      { type: 'RECEIVED', onHandDelta: 12, onHandAfter: 12, reason: 'PO-1042' },
    ]);
    const changes = await eventsOf('InventoryStockChanged', variant!);
    expect(InventoryStockChangedV1.payload.parse(changes.at(-1))).toMatchObject({
      onHand: 10,
      available: 10,
      availability: 'IN_STOCK',
    });
  });

  it('never lets on-hand drop below what open checkouts hold', async () => {
    const [variant] = await stockUp(h.stock, [5]);
    await reserve(randomUUID(), [{ variantId: variant!, quantity: 4 }]).expect(201);
    const res = await request(h.http)
      .post(`/api/v1/inventory/${variant}/adjustments`)
      .set('cookie', `cse_at=${staff}`)
      .send({ type: 'ADJUSTMENT', delta: -2, reason: 'damaged' })
      .expect(409);
    expect(res.body.error.message).toMatch(/4 unit/);
    await request(h.http)
      .post(`/api/v1/inventory/${variant}/adjustments`)
      .set('cookie', `cse_at=${staff}`)
      .send({ type: 'RECEIVED', delta: -1, reason: 'oops' })
      .expect(400);
  });

  it('lists low-stock items for alerts', async () => {
    const [low] = await stockUp(h.stock, [2]);
    const res = await request(h.http)
      .get('/api/v1/inventory?lowStock=1&pageSize=100')
      .set('cookie', `cse_at=${staff}`)
      .expect(200);
    expect(res.body.items.map((i: { variantId: string }) => i.variantId)).toContain(low);
    expect(res.body.items.every((i: { status: string }) => i.status !== 'IN_STOCK')).toBe(true);
  });
});

describe('reservations', () => {
  it('reserves, is idempotent per order and rejects a different retry', async () => {
    const [a, b] = await stockUp(h.stock, [5, 5]);
    const orderId = randomUUID();
    const first = await reserve(orderId, [
      { variantId: a!, quantity: 2 },
      { variantId: b!, quantity: 1 },
    ]).expect(201);
    expect(first.body).toMatchObject({ orderId, status: 'ACTIVE' });
    const retry = await reserve(orderId, [
      { variantId: b!, quantity: 1 },
      { variantId: a!, quantity: 2 },
    ]).expect(200);
    expect(retry.body.id).toBe(first.body.id);
    expect(await level(a!)).toEqual({ onHand: 5, reserved: 2 });
    await reserve(orderId, [{ variantId: a!, quantity: 3 }]).expect(409);
    expect(
      InventoryReservedV1.payload.parse((await eventsOf('InventoryReserved', orderId))[0]),
    ).toMatchObject({ orderId });
  });

  it('is all-or-nothing: one short line reserves nothing', async () => {
    const [plenty, scarce] = await stockUp(h.stock, [10, 2]);
    const res = await reserve(randomUUID(), [
      { variantId: plenty!, quantity: 1 },
      { variantId: scarce!, quantity: 3 },
    ]).expect(409);
    expect(res.body.error).toMatchObject({ code: 'INSUFFICIENT_STOCK' });
    expect(res.body.error.details).toEqual([
      { path: expect.stringMatching(/^TEST-/), message: 'Only 2 left' },
    ]);
    expect(await level(plenty!)).toEqual({ onHand: 10, reserved: 0 });
  });

  it('reports variants that are not stocked', async () => {
    const res = await reserve(randomUUID(), [{ variantId: randomUUID(), quantity: 1 }]).expect(409);
    expect(res.body.error.details[0].message).toBe('Not stocked');
  });

  it('confirm decrements stock exactly once', async () => {
    const [variant] = await stockUp(h.stock, [5]);
    const orderId = randomUUID();
    const { body } = await reserve(orderId, [{ variantId: variant!, quantity: 2 }]).expect(201);
    await request(h.http).post(`/api/v1/internal/reservations/${body.id}/confirm`).expect(200);
    await request(h.http).post(`/api/v1/internal/reservations/${body.id}/confirm`).expect(200);
    expect(await level(variant!)).toEqual({ onHand: 3, reserved: 0 });
    const decremented = await eventsOf('InventoryDecremented', orderId);
    expect(decremented).toHaveLength(1);
    expect(InventoryDecrementedV1.payload.parse(decremented[0]).remaining).toEqual([
      { variantId: variant, onHand: 3 },
    ]);
  });

  it('release returns held stock, once; a sold reservation cannot be released', async () => {
    const [variant] = await stockUp(h.stock, [5]);
    const orderId = randomUUID();
    const { body } = await reserve(orderId, [{ variantId: variant!, quantity: 2 }]).expect(201);
    await request(h.http)
      .post(`/api/v1/internal/reservations/${body.id}/release`)
      .send({ reason: 'PAYMENT_FAILED' })
      .expect(200);
    await request(h.http)
      .post(`/api/v1/internal/reservations/${body.id}/release`)
      .send({ reason: 'PAYMENT_FAILED' })
      .expect(200);
    expect(await level(variant!)).toEqual({ onHand: 5, reserved: 0 });
    expect(
      InventoryReleasedV1.payload.parse((await eventsOf('InventoryReleased', orderId))[0]).reason,
    ).toBe('PAYMENT_FAILED');

    const sold = await reserve(randomUUID(), [{ variantId: variant!, quantity: 1 }]).expect(201);
    await request(h.http).post(`/api/v1/internal/reservations/${sold.body.id}/confirm`).expect(200);
    await request(h.http)
      .post(`/api/v1/internal/reservations/${sold.body.id}/release`)
      .send({ reason: 'ORDER_CANCELLED' })
      .expect(409);
  });

  it('expires stale reservations back into available stock', async () => {
    const [variant] = await stockUp(h.stock, [3]);
    const orderId = randomUUID();
    const { body } = await reserve(orderId, [{ variantId: variant!, quantity: 3 }], 60).expect(201);
    expect(await h.reservations.expireDue(100, new Date(Date.now() + 30_000))).toBe(0);
    expect(
      await h.reservations.expireDue(100, new Date(Date.now() + 120_000)),
    ).toBeGreaterThanOrEqual(1);
    expect(await level(variant!)).toEqual({ onHand: 3, reserved: 0 });
    expect((await h.reservations.get(body.id)).status).toBe('EXPIRED');
    expect(
      InventoryReservationExpiredV1.payload.parse(
        (await eventsOf('InventoryReservationExpired', orderId))[0],
      ),
    ).toMatchObject({ orderId });
  });

  it('a payment after expiry still sells if stock remains, and refuses if it is gone', async () => {
    const [variant] = await stockUp(h.stock, [1]);
    const late = await reserve(randomUUID(), [{ variantId: variant!, quantity: 1 }], 60).expect(
      201,
    );
    await h.reservations.expireDue(100, new Date(Date.now() + 120_000));
    // Someone else bought the last unit in the meantime...
    const other = await reserve(randomUUID(), [{ variantId: variant!, quantity: 1 }]).expect(201);
    await request(h.http)
      .post(`/api/v1/internal/reservations/${other.body.id}/confirm`)
      .expect(200);
    // ...so the late payment must be refunded, not oversold.
    const res = await request(h.http)
      .post(`/api/v1/internal/reservations/${late.body.id}/confirm`)
      .expect(409);
    expect(res.body.error.code).toBe('INSUFFICIENT_STOCK');
    expect(await level(variant!)).toEqual({ onHand: 0, reserved: 0 });

    const [restocked] = await stockUp(h.stock, [2]);
    const late2 = await reserve(randomUUID(), [{ variantId: restocked!, quantity: 1 }], 60).expect(
      201,
    );
    await h.reservations.expireDue(100, new Date(Date.now() + 120_000));
    await request(h.http)
      .post(`/api/v1/internal/reservations/${late2.body.id}/confirm`)
      .expect(200);
    expect(await level(restocked!)).toEqual({ onHand: 1, reserved: 0 });
  });
});

describe('database invariants', () => {
  it('rejects reserving more than is on hand even if application code tried', async () => {
    const [variant] = await stockUp(h.stock, [1]);
    await expect(
      h.db
        .update(inventoryItems)
        .set({ reserved: sql`${inventoryItems.onHand} + 1` })
        .where(eq(inventoryItems.variantId, variant!)),
    ).rejects.toThrow();
    await expect(
      h.db.update(inventoryItems).set({ onHand: -1 }).where(eq(inventoryItems.variantId, variant!)),
    ).rejects.toThrow();
  });
});

describe('internal reads', () => {
  it('reports availability and syncs catalog variants', async () => {
    const [variant] = await stockUp(h.stock, [4]);
    const unknown = randomUUID();
    const res = await request(h.http)
      .post('/api/v1/internal/availability')
      .send({ variantIds: [variant, unknown] })
      .expect(200);
    expect(res.body).toEqual([
      expect.objectContaining({ variantId: variant, available: 4, status: 'LOW_STOCK' }),
    ]);
    const synced = await request(h.http)
      .post('/api/v1/internal/variants/sync')
      .send({ variants: [{ variantId: unknown, sku: 'NEW-SKU-1' }] })
      .expect(200);
    expect(synced.body).toEqual({ synced: 1 });
    expect(await level(unknown)).toEqual({ onHand: 0, reserved: 0 });
  });
});
