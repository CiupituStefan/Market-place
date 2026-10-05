import { randomUUID } from 'node:crypto';
import type { Order, PlacedOrder } from '@market/types';
import { DomainError, ErrorCode } from '@market/types';
import { asc, eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { idempotencyKeys, orders, outboxEvents } from '../src/db/schema.js';
import {
  address,
  cartOf,
  configurationItem,
  createHarness,
  variantItem,
  type Harness,
} from './harness.js';

describe('order-service: checkout', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await createHarness();
  });

  afterAll(async () => {
    await h.close();
  });

  /** A signed-in shopper with a cart of the given items, stock for them, and a place() helper. */
  async function shopper(
    items = [variantItem(120_00, 2)],
    options: { couponCode?: string; discount?: number } = {},
  ) {
    const userId = randomUUID();
    const auth = `Bearer ${await h.token(userId)}`;
    for (const item of items) if (item.variantId) h.inventory.stock.set(item.variantId, 10);
    const cart = h.cart.set({ userId, guestToken: null }, cartOf(items, options));
    const place = (key = randomUUID(), body: Record<string, unknown> = {}) =>
      request(h.http)
        .post('/api/v1/orders')
        .set('Authorization', auth)
        .set('Idempotency-Key', key)
        .send({
          email: 'Ana@Example.com',
          shippingAddress: address,
          expectedTotal: cart.total.amount,
          ...body,
        });
    return { userId, auth, cart, place };
  }

  const events = async (orderId: string) =>
    (
      await h.db
        .select()
        .from(outboxEvents)
        .where(eq(outboxEvents.messageKey, orderId))
        .orderBy(asc(outboxEvents.sequence))
    ).map((row) => (row.envelope as { eventType: string }).eventType);

  it('places an order from the server-priced cart and holds the stock', async () => {
    const { cart, place } = await shopper();
    const res = await place().expect(201);
    const order = res.body as PlacedOrder;
    expect(order).toMatchObject({
      status: 'PENDING_PAYMENT',
      number: expect.stringMatching(/^CSE-\d{6}$/),
      email: 'ana@example.com',
      subtotal: { amount: 240_00, currency: 'EUR' },
      shipping: { amount: 0 },
      total: { amount: 240_00 },
      vatRateBps: 2_100,
      tax: { amount: 41_65 },
      accessToken: null,
      billingAddress: { country: 'RO', line2: null },
    });
    expect(order.items[0]).toMatchObject({
      quantity: 2,
      unitPrice: { amount: 120_00 },
      lineTotal: { amount: 240_00 },
    });
    expect(order.history.map((entry) => entry.status)).toEqual(['PENDING_PAYMENT']);
    expect(new Date(order.paymentDueAt!).getTime()).toBeGreaterThan(Date.now() + 25 * 60_000);

    const reservation = h.inventory.forOrder(order.id);
    expect(reservation?.status).toBe('ACTIVE');
    expect(h.inventory.stock.get(cart.items[0]!.variantId!)).toBe(8);
    expect(await events(order.id)).toEqual(['OrderCreated']);
  });

  it('computes VAT at the destination country rate on the same gross total', async () => {
    const { place } = await shopper([variantItem(119_00)]);
    const order = (
      await place(undefined, { shippingAddress: { ...address, country: 'DE' } }).expect(201)
    ).body as Order;
    expect(order.total.amount).toBe(119_00);
    expect(order.vatRateBps).toBe(1_900);
    expect(order.tax.amount).toBe(19_00);
  });

  it('requires an Idempotency-Key and replays retries instead of ordering twice', async () => {
    const { place, auth } = await shopper();
    await request(h.http)
      .post('/api/v1/orders')
      .set('Authorization', auth)
      .send({ email: 'a@b.co', shippingAddress: address, expectedTotal: 1 })
      .expect(400);

    const key = randomUUID();
    const first = (await place(key).expect(201)).body as Order;
    const retry = await place(key).expect(200);
    expect(retry.headers['idempotent-replayed']).toBe('true');
    expect((retry.body as Order).id).toBe(first.id);

    const reused = await place(key, { notes: 'different' }).expect(422);
    expect(reused.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
    const mine = await request(h.http).get('/api/v1/orders').set('Authorization', auth).expect(200);
    expect(mine.body.total).toBe(1);
  });

  it('refuses a total the shopper did not see, then accepts the corrected one with the same key', async () => {
    const { place, cart } = await shopper();
    const key = randomUUID();
    const res = await place(key, { expectedTotal: cart.total.amount - 1 }).expect(409);
    expect(res.body.error.code).toBe('PRICE_CHANGED');
    await place(key).expect(201);
  });

  it('rejects empty carts and carts with unavailable items', async () => {
    const empty = await shopper([]);
    expect((await empty.place().expect(422)).body.error.code).toBe('CART_EMPTY');

    const blocked = await shopper();
    blocked.cart.canCheckout = false;
    blocked.cart.notices = [
      { code: 'INSUFFICIENT_STOCK', message: 'Only 1 left', itemId: blocked.cart.items[0]!.id },
    ];
    const res = await blocked.place().expect(409);
    expect(res.body.error.details).toEqual([
      { path: blocked.cart.items[0]!.id, message: 'Only 1 left' },
    ]);
  });

  it('fails cleanly when stock ran out: no visible order, nothing held', async () => {
    const { place, cart, auth } = await shopper();
    h.inventory.stock.set(cart.items[0]!.variantId!, 1);
    const key = randomUUID();
    expect((await place(key).expect(409)).body.error.code).toBe('INSUFFICIENT_STOCK');

    const failed = await h.db.select().from(orders).where(eq(orders.cartId, cart.id!));
    expect(failed.map((o) => [o.status, o.failureReason])).toEqual([
      ['FAILED', 'INSUFFICIENT_STOCK'],
    ]);
    expect(await h.db.select().from(idempotencyKeys).where(eq(idempotencyKeys.key, key))).toEqual(
      [],
    );
    const mine = await request(h.http).get('/api/v1/orders').set('Authorization', auth);
    expect(mine.body.items).toEqual([]);
    await request(h.http)
      .get(`/api/v1/orders/${failed[0]!.id}`)
      .set('Authorization', auth)
      .expect(404);
  });

  it('gives the stock back when the discount code can no longer be claimed', async () => {
    const { place, cart } = await shopper([variantItem(100_00)], {
      couponCode: 'LAUNCH20',
      discount: 20_00,
    });
    h.cart.redeemError = new DomainError(
      ErrorCode.COUPON_EXPIRED,
      'This code has been fully redeemed',
    );
    try {
      expect((await place().expect(422)).body.error.message).toBe(
        'This code has been fully redeemed',
      );
    } finally {
      h.cart.redeemError = null;
    }
    expect(h.inventory.stock.get(cart.items[0]!.variantId!)).toBe(10);
    const [failed] = await h.db.select().from(orders).where(eq(orders.cartId, cart.id!));
    expect(failed?.status).toBe('FAILED');
    expect(h.cart.released).toContain(failed?.id);
  });

  it('claims the discount code for the order', async () => {
    const { place } = await shopper([variantItem(100_00)], {
      couponCode: 'LAUNCH20',
      discount: 20_00,
    });
    const order = (await place().expect(201)).body as Order;
    expect(order).toMatchObject({
      couponCode: 'LAUNCH20',
      discount: { amount: 20_00 },
      total: { amount: 86_90 },
    });
    expect(h.cart.redemptions.get(order.id)).toBe('LAUNCH20');
  });

  it('orders configurator builds without a stock reservation', async () => {
    const { place } = await shopper([configurationItem(170_00)]);
    const order = (await place().expect(201)).body as Order;
    expect(order.items[0]).toMatchObject({
      kind: 'configuration',
      configurator: 'custom-75',
      variantId: null,
    });
    expect(h.inventory.forOrder(order.id)).toBeUndefined();
  });

  it('lets guests check out with their cart cookie and view the order with its token', async () => {
    const guestToken = 'g'.repeat(43);
    const item = variantItem(60_00);
    h.inventory.stock.set(item.variantId!, 5);
    const cart = h.cart.set({ userId: null, guestToken }, cartOf([item]));
    const key = randomUUID();
    const placeAsGuest = () =>
      request(h.http)
        .post('/api/v1/orders')
        .set('Cookie', `cse_cart=${guestToken}`)
        .set('Idempotency-Key', key)
        .send({
          email: 'guest@example.com',
          shippingAddress: address,
          expectedTotal: cart.total.amount,
        });
    const order = (await placeAsGuest().expect(201)).body as PlacedOrder;
    expect(order.accessToken).toMatch(/^[A-Za-z0-9_-]{43}$/);

    // A replay never re-issues (or invalidates) the token.
    expect(((await placeAsGuest().expect(200)).body as PlacedOrder).accessToken).toBeNull();

    // The browser that placed it can always view it through its cart cookie.
    await request(h.http)
      .get(`/api/v1/orders/${order.id}`)
      .set('Cookie', `cse_cart=${guestToken}`)
      .expect(200);
    await request(h.http)
      .get(`/api/v1/orders/${order.id}`)
      .set('Cookie', `cse_cart=${'h'.repeat(43)}`)
      .expect(404);

    await request(h.http)
      .get(`/api/v1/orders/${order.id}`)
      .set('x-order-token', order.accessToken!)
      .expect(200);
    await request(h.http).get(`/api/v1/orders/${order.id}`).expect(404);
    await request(h.http)
      .get(`/api/v1/orders/${order.id}`)
      .set('x-order-token', 'x'.repeat(43))
      .expect(404);
    const stranger = await h.token(randomUUID());
    await request(h.http)
      .get(`/api/v1/orders/${order.id}`)
      .set('Authorization', `Bearer ${stranger}`)
      .expect(404);
    const staff = await h.token(randomUUID(), ['STAFF']);
    await request(h.http)
      .get(`/api/v1/orders/${order.id}`)
      .set('Authorization', `Bearer ${staff}`)
      .expect(200);
  });

  it('refuses anonymous checkout without a cart', async () => {
    await request(h.http)
      .post('/api/v1/orders')
      .set('Idempotency-Key', randomUUID())
      .send({ email: 'x@example.com', shippingAddress: address, expectedTotal: 0 })
      .expect(422);
  });

  it('validates addresses and countries', async () => {
    const { place } = await shopper();
    const res = await place(undefined, { shippingAddress: { ...address, country: 'US' } }).expect(
      400,
    );
    expect(res.body.error.details[0].path).toBe('shippingAddress.country');
  });

  it('answers 503 when cart-service is down, without leaving anything behind', async () => {
    const { place } = await shopper();
    h.cart.down = true;
    try {
      await place().expect(503);
    } finally {
      h.cart.down = false;
    }
  });
});
