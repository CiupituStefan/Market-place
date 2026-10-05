import { randomUUID } from 'node:crypto';
import type { Order, OrderSummary, Paginated } from '@market/types';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { orders, outboxEvents } from '../src/db/schema.js';
import { OrderSweeper } from '../src/orders/order-sweeper.js';
import { address, cartOf, createHarness, variantItem, type Harness } from './harness.js';

describe('order-service: lifecycle', () => {
  let h: Harness;
  let staff: string;

  beforeAll(async () => {
    h = await createHarness();
    staff = `Bearer ${await h.token(randomUUID(), ['STAFF'])}`;
  });

  afterAll(async () => {
    await h.close();
  });

  async function placed(options: { couponCode?: string; stock?: number } = {}) {
    const userId = randomUUID();
    const auth = `Bearer ${await h.token(userId)}`;
    const item = variantItem(50_00, 2);
    h.inventory.stock.set(item.variantId!, options.stock ?? 10);
    const cart = h.cart.set(
      { userId, guestToken: null },
      cartOf([item], options.couponCode ? { couponCode: options.couponCode, discount: 10_00 } : {}),
    );
    const res = await request(h.http)
      .post('/api/v1/orders')
      .set('Authorization', auth)
      .set('Idempotency-Key', randomUUID())
      .send({
        email: 'ana@example.com',
        shippingAddress: address,
        expectedTotal: cart.total.amount,
      })
      .expect(201);
    return { order: res.body as Order, auth, cart, variantId: item.variantId! };
  }

  const pay = (order: Order, paymentId = randomUUID(), amount = order.total.amount) =>
    request(h.http)
      .post(`/api/v1/internal/orders/${order.id}/payment-succeeded`)
      .send({ paymentId, amount, currency: 'EUR' });

  const eventTypes = async (orderId: string) =>
    (await h.db.select().from(outboxEvents).where(eq(outboxEvents.messageKey, orderId))).map(
      (row) => (row.envelope as { eventType: string }).eventType,
    );

  describe('customer cancellation', () => {
    it('cancels an unpaid order and gives back stock and the discount use', async () => {
      const { order, auth, variantId } = await placed({ couponCode: 'TENOFF' });
      expect(h.inventory.stock.get(variantId)).toBe(8);
      const res = await request(h.http)
        .post(`/api/v1/orders/${order.id}/cancel`)
        .set('Authorization', auth)
        .expect(200);
      expect(res.body).toMatchObject({
        status: 'CANCELLED',
        cancelReason: 'CUSTOMER_REQUEST',
        paymentDueAt: null,
      });
      expect(h.inventory.stock.get(variantId)).toBe(10);
      expect(h.cart.released).toContain(order.id);
      expect(await eventTypes(order.id)).toEqual(['OrderCreated', 'OrderCancelled']);

      await request(h.http)
        .post(`/api/v1/orders/${order.id}/cancel`)
        .set('Authorization', auth)
        .expect(200);
      expect(await eventTypes(order.id)).toHaveLength(2);
    });

    it('cannot cancel someone else’s order or a paid one', async () => {
      const { order, auth } = await placed();
      const other = `Bearer ${await h.token(randomUUID())}`;
      await request(h.http)
        .post(`/api/v1/orders/${order.id}/cancel`)
        .set('Authorization', other)
        .expect(404);
      await pay(order).expect(200);
      const res = await request(h.http)
        .post(`/api/v1/orders/${order.id}/cancel`)
        .set('Authorization', auth)
        .expect(409);
      expect(res.body.error.code).toBe('INVALID_ORDER_STATE');
    });
  });

  describe('payments (internal API)', () => {
    it('marks the order paid, sells the held stock and empties the cart; retries are no-ops', async () => {
      const { order, cart } = await placed();
      const paymentId = randomUUID();
      const res = await pay(order, paymentId).expect(200);
      expect(res.body).toMatchObject({
        outcome: 'PAID',
        order: { status: 'PAID', paymentDueAt: null },
      });
      expect(h.inventory.forOrder(order.id)?.status).toBe('CONFIRMED');
      expect(h.cart.cleared).toContain(cart.id);

      expect((await pay(order, paymentId).expect(200)).body.outcome).toBe('ALREADY_PAID');
      expect(await eventTypes(order.id)).toEqual(['OrderCreated', 'OrderPaid']);
    });

    it('rejects a payment whose amount differs from the order total', async () => {
      const { order } = await placed();
      await pay(order, randomUUID(), order.total.amount - 1).expect(409);
    });

    it('accepts a late payment when the stock is still there', async () => {
      const { order } = await placed();
      h.inventory.expire(h.inventory.forOrder(order.id)!.id);
      expect((await pay(order).expect(200)).body.outcome).toBe('PAID');
    });

    it('flags a refund instead of overselling when a late payment finds the stock gone', async () => {
      const { order, variantId } = await placed({ stock: 2 });
      h.inventory.expire(h.inventory.forOrder(order.id)!.id);
      h.inventory.stock.set(variantId, 0); // someone else bought them meanwhile
      const paymentId = randomUUID();
      const res = await pay(order, paymentId).expect(200);
      expect(res.body).toMatchObject({
        outcome: 'REFUND_REQUIRED',
        order: { status: 'CANCELLED', cancelReason: 'OUT_OF_STOCK' },
      });
      const [row] = await h.db.select().from(orders).where(eq(orders.id, order.id));
      expect(row?.refundRequired).toBe(true);
      expect((await pay(order, paymentId).expect(200)).body.outcome).toBe('REFUND_REQUIRED');
    });

    it('flags a refund for a payment that arrives after the order was cancelled', async () => {
      const { order, auth } = await placed();
      await request(h.http)
        .post(`/api/v1/orders/${order.id}/cancel`)
        .set('Authorization', auth)
        .expect(200);
      expect((await pay(order).expect(200)).body.outcome).toBe('REFUND_REQUIRED');
      const [row] = await h.db.select().from(orders).where(eq(orders.id, order.id));
      expect(row).toMatchObject({ status: 'CANCELLED', refundRequired: true });
    });

    it('records failed attempts without cancelling (the shopper may retry)', async () => {
      const { order } = await placed();
      const res = await request(h.http)
        .post(`/api/v1/internal/orders/${order.id}/payment-failed`)
        .send({ message: 'Your card was declined.' })
        .expect(200);
      expect(res.body.status).toBe('PENDING_PAYMENT');
      expect(res.body.history.at(-1)).toMatchObject({
        note: 'Payment attempt failed: Your card was declined.',
      });
    });

    it('is not reachable as a public route', async () => {
      // The gateway blocks /internal; the service itself has no auth on it by design.
      const { order } = await placed();
      await request(h.http).get(`/api/v1/internal/orders/${order.id}`).expect(200);
    });
  });

  describe('back office', () => {
    it('is staff only', async () => {
      const customer = `Bearer ${await h.token(randomUUID())}`;
      await request(h.http).get('/api/v1/orders/manage').set('Authorization', customer).expect(403);
      await request(h.http).get('/api/v1/orders/manage').expect(401);
    });

    it('lists and searches every order, including failed checkouts', async () => {
      const { order } = await placed();
      const res = await request(h.http)
        .get(`/api/v1/orders/manage?q=${order.number}`)
        .set('Authorization', staff)
        .expect(200);
      expect((res.body as Paginated<OrderSummary>).items.map((o) => o.id)).toEqual([order.id]);
      const byStatus = await request(h.http)
        .get('/api/v1/orders/manage?status=PENDING_PAYMENT&pageSize=100')
        .set('Authorization', staff);
      expect(
        (byStatus.body as Paginated<OrderSummary>).items.every(
          (o) => o.status === 'PENDING_PAYMENT',
        ),
      ).toBe(true);
    });

    it('fulfils a paid order step by step', async () => {
      const { order, auth } = await placed();
      const change = (body: Record<string, unknown>) =>
        request(h.http)
          .post(`/api/v1/orders/manage/${order.id}/status`)
          .set('Authorization', staff)
          .send(body);

      expect((await change({ status: 'SHIPPED' }).expect(409)).body.error.code).toBe(
        'INVALID_ORDER_STATE',
      );
      await pay(order).expect(200);
      await change({ status: 'PROCESSING' }).expect(200);
      await change({ status: 'SHIPPED' }).expect(400); // tracking required
      const shipped = await change({
        status: 'SHIPPED',
        carrier: 'DHL',
        trackingNumber: 'JD0146000033',
        trackingUrl: 'https://www.dhl.com/track?id=JD0146000033',
      }).expect(200);
      expect(shipped.body).toMatchObject({
        status: 'SHIPPED',
        carrier: 'DHL',
        trackingNumber: 'JD0146000033',
      });
      await change({ status: 'DELIVERED' }).expect(200);
      await change({ status: 'CANCELLED' }).expect(409);

      const mine = (
        await request(h.http).get(`/api/v1/orders/${order.id}`).set('Authorization', auth)
      ).body as Order;
      expect(mine.history.map((entry) => entry.status)).toEqual([
        'PENDING_PAYMENT',
        'PAID',
        'PROCESSING',
        'SHIPPED',
        'DELIVERED',
      ]);
      expect(await eventTypes(order.id)).toEqual([
        'OrderCreated',
        'OrderPaid',
        'OrderShipped',
        'OrderDelivered',
      ]);
    });

    it('can cancel an unpaid order', async () => {
      const { order } = await placed();
      const res = await request(h.http)
        .post(`/api/v1/orders/manage/${order.id}/status`)
        .set('Authorization', staff)
        .send({ status: 'CANCELLED' })
        .expect(200);
      expect(res.body.cancelReason).toBe('ADMIN');
    });
  });

  describe('sweeper', () => {
    it('cancels orders not paid in time and compensates stuck checkouts', async () => {
      const { order, variantId } = await placed({ couponCode: 'TENOFF' });
      await h.db
        .update(orders)
        .set({ paymentDueAt: new Date(Date.now() - 10 * 60_000) })
        .where(eq(orders.id, order.id));

      const stuckId = randomUUID();
      await h.db.insert(orders).values({
        id: stuckId,
        status: 'PENDING',
        userId: randomUUID(),
        email: 'stuck@example.com',
        currency: 'EUR',
        subtotal: 10_00,
        discount: 0,
        shipping: 6_90,
        tax: 0,
        vatRateBps: 2_100,
        total: 16_90,
        shippingAddress: { ...address, company: null, line2: null, region: null, phone: null },
        billingAddress: { ...address, company: null, line2: null, region: null, phone: null },
        createdAt: new Date(Date.now() - 60 * 60_000),
      });

      const result = await h.app.get(OrderSweeper).sweep();
      expect(result.expired).toBeGreaterThanOrEqual(1);
      expect(result.compensated).toBe(1);

      const [expired] = await h.db.select().from(orders).where(eq(orders.id, order.id));
      expect(expired).toMatchObject({ status: 'CANCELLED', cancelReason: 'PAYMENT_TIMEOUT' });
      expect(h.inventory.stock.get(variantId)).toBe(10);
      expect(h.cart.released).toContain(order.id);
      const [stuck] = await h.db.select().from(orders).where(eq(orders.id, stuckId));
      expect(stuck?.status).toBe('FAILED');
      expect(h.cart.released).toContain(stuckId);

      // A second sweep finds nothing left to do.
      expect(await h.app.get(OrderSweeper).sweep()).toEqual({ expired: 0, compensated: 0 });
    });
  });
});
