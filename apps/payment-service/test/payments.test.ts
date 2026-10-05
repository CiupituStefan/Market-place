import { randomUUID } from 'node:crypto';
import { createEvent, OrderCancelledV1 } from '@market/events';
import { createLogger } from '@market/logger';
import { EventProcessor, InMemoryPublisher } from '@market/messaging';
import type { Payment, PaymentSession } from '@market/types';
import { eq } from 'drizzle-orm';
import Stripe from 'stripe';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DATABASE } from '../src/db/database.js';
import { outboxEvents, payments } from '../src/db/schema.js';
import { paymentConsumers } from '../src/events/consumers.js';
import { PaymentService } from '../src/payments/payment.service.js';
import { createHarness, orderOf, WEBHOOK_SECRET, type Harness } from './harness.js';

describe('payment-service', () => {
  let h: Harness;
  let staff: string;

  beforeAll(async () => {
    h = await createHarness();
    staff = `Bearer ${await h.token(randomUUID(), ['STAFF'])}`;
  });

  afterAll(async () => {
    await h.close();
  });

  async function buyer(total = 189_00) {
    const userId = randomUUID();
    const auth = `Bearer ${await h.token(userId)}`;
    const order = h.orders.add(orderOf(total), userId);
    const session = async () =>
      (
        await request(h.http)
          .post('/api/v1/payments/create-intent')
          .set('Authorization', auth)
          .send({ orderId: order.id })
          .expect(200)
      ).body as PaymentSession;
    return { userId, auth, order, session };
  }

  /** Delivers an event the way Stripe would (raw JSON + Stripe-Signature). */
  const deliver = (event: { rawBody: Buffer; signature: string }) =>
    request(h.http)
      .post('/api/v1/payments/webhook')
      .set('content-type', 'application/json')
      .set('stripe-signature', event.signature)
      .send(event.rawBody.toString());

  const confirm = (clientSecret: string, outcome: 'succeed' | 'fail') =>
    request(h.http).post('/api/v1/payments/mock/confirm').send({ clientSecret, outcome });

  const eventTypes = async (orderId: string) =>
    (await h.db.select().from(outboxEvents).where(eq(outboxEvents.messageKey, orderId))).map(
      (row) => (row.envelope as { eventType: string }).eventType,
    );

  describe('payment sessions', () => {
    it('creates one intent per order for the order total and reuses it', async () => {
      const { session, order } = await buyer(189_00);
      const first = await session();
      expect(first).toMatchObject({
        provider: 'mock',
        publishableKey: 'mock',
        amount: { amount: 189_00, currency: 'EUR' },
        status: 'REQUIRES_PAYMENT',
        clientSecret: expect.stringMatching(/^pi_mock_\w+_secret_\w+$/),
      });
      const again = await session();
      expect(again.clientSecret).toBe(first.clientSecret);
      expect(again.paymentId).toBe(first.paymentId);
      expect(await eventTypes(order.id)).toEqual(['PaymentCreated']);
    });

    it('creates a single intent under concurrent requests', async () => {
      const { session, order } = await buyer();
      const results = await Promise.all([session(), session(), session()]);
      expect(new Set(results.map((r) => r.clientSecret)).size).toBe(1);
      expect(await h.db.select().from(payments).where(eq(payments.orderId, order.id))).toHaveLength(
        1,
      );
    });

    it('only lets the order’s owner pay, and only while it is unpaid', async () => {
      const { order } = await buyer();
      const stranger = `Bearer ${await h.token(randomUUID())}`;
      await request(h.http)
        .post('/api/v1/payments/create-intent')
        .set('Authorization', stranger)
        .send({ orderId: order.id })
        .expect(404);

      const paid = await buyer();
      h.orders.orders.get(paid.order.id)!.order.status = 'PAID';
      const res = await request(h.http)
        .post('/api/v1/payments/create-intent')
        .set('Authorization', paid.auth)
        .send({ orderId: paid.order.id })
        .expect(409);
      expect(res.body.error.message).toBe('This order is already paid');
    });

    it('never takes an amount from the browser', async () => {
      const { order, auth } = await buyer();
      await request(h.http)
        .post('/api/v1/payments/create-intent')
        .set('Authorization', auth)
        .send({ orderId: order.id, amount: 1 })
        .expect(400);
    });
  });

  describe('webhooks', () => {
    it('rejects unsigned, tampered and stale events', async () => {
      const payload = JSON.stringify({
        id: 'evt_x',
        object: 'event',
        type: 'ping',
        data: { object: {} },
      });
      await request(h.http)
        .post('/api/v1/payments/webhook')
        .set('content-type', 'application/json')
        .send(payload)
        .expect(400);
      const signature = Stripe.webhooks.generateTestHeaderString({
        payload,
        secret: WEBHOOK_SECRET,
      });
      const tampered = await deliver({
        rawBody: Buffer.from(payload.replace('ping', 'pong')),
        signature,
      });
      expect(tampered.status).toBe(400);
      expect(tampered.body.error.code).toBe('WEBHOOK_SIGNATURE_INVALID');
      const stale = Stripe.webhooks.generateTestHeaderString({
        payload,
        secret: WEBHOOK_SECRET,
        timestamp: Math.floor(Date.now() / 1000) - 3_600,
      });
      await deliver({ rawBody: Buffer.from(payload), signature: stale }).expect(400);
      const wrongSecret = Stripe.webhooks.generateTestHeaderString({
        payload,
        secret: 'whsec_other',
      });
      await deliver({ rawBody: Buffer.from(payload), signature: wrongSecret }).expect(400);
      await deliver({ rawBody: Buffer.from(payload), signature }).expect(200);
    });

    it('marks the payment succeeded and tells order-service, once per event', async () => {
      const { session, order } = await buyer(120_00);
      const { clientSecret, paymentId } = await session();
      const event = h.provider.confirm(clientSecret, 'succeed');
      expect((await deliver(event).expect(200)).body).toEqual({ received: true, duplicate: false });
      expect((await deliver(event).expect(200)).body).toEqual({ received: true, duplicate: true });

      expect(h.orders.succeeded.filter((c) => c.orderId === order.id)).toEqual([
        { orderId: order.id, paymentId, amount: 120_00, currency: 'EUR' },
      ]);
      const [row] = await h.db.select().from(payments).where(eq(payments.id, paymentId));
      expect(row?.status).toBe('SUCCEEDED');
      expect(await eventTypes(order.id)).toEqual(['PaymentCreated', 'PaymentSucceeded']);
    });

    it('answers 5xx when order-service is down, so Stripe retries the event', async () => {
      const { session, order } = await buyer();
      const event = h.provider.confirm((await session()).clientSecret, 'succeed');
      h.orders.down = true;
      try {
        await deliver(event).expect(503);
      } finally {
        h.orders.down = false;
      }
      await deliver(event).expect(200);
      expect(h.orders.succeeded.filter((c) => c.orderId === order.id)).toHaveLength(1);
    });

    it('records failed attempts and lets the shopper retry with the same intent', async () => {
      const { session, order } = await buyer();
      const { clientSecret } = await session();
      await confirm(clientSecret, 'fail').expect(200);
      expect(h.orders.failed).toContainEqual({
        orderId: order.id,
        message: 'Your card was declined.',
      });
      expect((await session()).clientSecret).toBe(clientSecret);
      await confirm(clientSecret, 'succeed').expect(200);
      expect(h.orders.succeeded.some((c) => c.orderId === order.id)).toBe(true);
    });

    it('refunds automatically when the order cannot be fulfilled', async () => {
      const { session, order } = await buyer(75_00);
      const { clientSecret, paymentId } = await session();
      h.orders.outcome = 'REFUND_REQUIRED';
      try {
        await confirm(clientSecret, 'succeed').expect(200);
      } finally {
        h.orders.outcome = 'PAID';
      }
      const payment = (
        await request(h.http)
          .get(`/api/v1/payments/manage/${paymentId}`)
          .set('Authorization', staff)
      ).body as Payment;
      expect(payment).toMatchObject({ status: 'REFUNDED', refunded: { amount: 75_00 } });
      expect(payment.refunds).toEqual([
        expect.objectContaining({ reason: 'order_unfulfillable', status: 'SUCCEEDED' }),
      ]);
      expect(h.orders.refundedCalls).toContainEqual({
        orderId: order.id,
        amount: 75_00,
        full: true,
      });
      expect(await eventTypes(order.id)).toEqual([
        'PaymentCreated',
        'PaymentSucceeded',
        'PaymentRefunded',
      ]);
    });

    it('ignores events for intents it does not know', async () => {
      const payload = JSON.stringify({
        id: `evt_${randomUUID()}`,
        object: 'event',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            object: 'payment_intent',
            id: 'pi_other',
            status: 'succeeded',
            amount: 1,
            amount_received: 1,
            currency: 'eur',
            metadata: {},
          },
        },
      });
      const signature = Stripe.webhooks.generateTestHeaderString({
        payload,
        secret: WEBHOOK_SECRET,
      });
      await deliver({ rawBody: Buffer.from(payload), signature }).expect(200);
    });
  });

  describe('refunds (back office)', () => {
    async function paidPayment(total = 100_00) {
      const b = await buyer(total);
      const { clientSecret, paymentId } = await b.session();
      await confirm(clientSecret, 'succeed').expect(200);
      return { ...b, paymentId };
    }

    const refund = (paymentId: string, body: Record<string, unknown>, auth = staff) =>
      request(h.http)
        .post(`/api/v1/payments/manage/${paymentId}/refunds`)
        .set('Authorization', auth)
        .send(body);

    it('is staff only', async () => {
      const { paymentId, auth } = await paidPayment();
      await refund(paymentId, { reason: 'requested_by_customer' }, auth).expect(403);
      await request(h.http).get(`/api/v1/payments/manage?orderId=${randomUUID()}`).expect(401);
    });

    it('refunds in parts and never more than was paid', async () => {
      const { paymentId, order } = await paidPayment(100_00);
      const partial = (
        await refund(paymentId, { amount: 30_00, reason: 'requested_by_customer' }).expect(201)
      ).body as Payment;
      expect(partial).toMatchObject({ status: 'PARTIALLY_REFUNDED', refunded: { amount: 30_00 } });
      const tooMuch = await refund(paymentId, {
        amount: 70_01,
        reason: 'requested_by_customer',
      }).expect(422);
      expect(tooMuch.body.error).toMatchObject({
        code: 'REFUND_EXCEEDS_PAYMENT',
        message: 'At most 70.00 EUR can still be refunded',
      });
      const rest = (await refund(paymentId, { reason: 'requested_by_customer' }).expect(201))
        .body as Payment;
      expect(rest).toMatchObject({ status: 'REFUNDED', refunded: { amount: 100_00 } });
      expect(h.orders.refundedCalls.filter((c) => c.orderId === order.id)).toEqual([
        { orderId: order.id, amount: 30_00, full: false },
        { orderId: order.id, amount: 70_00, full: true },
      ]);
      // Fully refunded: nothing left to refund.
      await refund(paymentId, { reason: 'requested_by_customer' }).expect(409);
    });

    it('cannot refund an unpaid payment', async () => {
      const { session } = await buyer();
      const { paymentId } = await session();
      expect((await refund(paymentId, { reason: 'duplicate' }).expect(409)).body.error.code).toBe(
        'INVALID_ORDER_STATE',
      );
    });

    it('settles a pending refund from the refund.updated webhook', async () => {
      const { paymentId, order } = await paidPayment(50_00);
      h.provider.nextRefundStatus = 'pending';
      const pending = (await refund(paymentId, { reason: 'requested_by_customer' }).expect(201))
        .body as Payment;
      expect(pending.refunds[0]?.status).toBe('PENDING');
      expect(pending.status).toBe('SUCCEEDED');
      // The pending amount is reserved: nothing more can be refunded meanwhile.
      await refund(paymentId, { amount: 1, reason: 'duplicate' }).expect(422);

      const providerRefund = h.provider.refunds.at(-1)!;
      const event = h.provider.refundEvent(providerRefund.id, 'succeeded');
      await deliver(event).expect(200);
      await deliver(event).expect(200);
      const settled = (
        await request(h.http)
          .get(`/api/v1/payments/manage/${paymentId}`)
          .set('Authorization', staff)
      ).body as Payment;
      expect(settled).toMatchObject({
        status: 'REFUNDED',
        refunds: [expect.objectContaining({ status: 'SUCCEEDED' })],
      });
      expect(h.orders.refundedCalls.filter((c) => c.orderId === order.id)).toHaveLength(1);
    });

    it('lists the payments of an order', async () => {
      const { paymentId, order } = await paidPayment();
      const res = await request(h.http)
        .get(`/api/v1/payments/manage?orderId=${order.id}`)
        .set('Authorization', staff)
        .expect(200);
      expect((res.body as Payment[]).map((p) => p.id)).toEqual([paymentId]);
    });
  });

  describe('OrderCancelled (Kafka)', () => {
    const cancelled = (orderId: string, refundRequired: boolean) => {
      const envelope = createEvent(
        OrderCancelledV1,
        {
          orderId,
          orderNumber: 'CSE-1',
          reservationId: null,
          reason: 'CUSTOMER_REQUEST',
          refundRequired,
        },
        { producer: 'order-service', aggregateId: orderId, correlationId: 'test' },
      );
      return {
        topic: OrderCancelledV1.topic,
        partition: 0,
        offset: '1',
        key: orderId,
        value: JSON.stringify(envelope),
        headers: {},
      };
    };
    const processor = () =>
      new EventProcessor(
        h.app.get(DATABASE),
        new InMemoryPublisher(),
        paymentConsumers(h.app.get(PaymentService))[0]!,
        {
          maxAttempts: 1,
          retryDelayMs: 1,
          logger: createLogger({ service: 'test', level: 'silent' }),
        },
      );

    it('cancels the open payment intent, once, so the order can no longer be paid', async () => {
      const { session, order } = await buyer();
      const { clientSecret, paymentId } = await session();
      const message = cancelled(order.id, false);
      expect(await processor().process(message)).toBe('processed');
      expect(await processor().process(message)).toBe('duplicate');
      const [row] = await h.db.select().from(payments).where(eq(payments.id, paymentId));
      expect(row?.status).toBe('CANCELED');
      await confirm(clientSecret, 'succeed').expect(409);
    });

    it('refunds a captured payment when the cancellation requires it, never twice', async () => {
      const { session, order } = await buyer(60_00);
      const { clientSecret, paymentId } = await session();
      h.orders.outcome = 'REFUND_REQUIRED';
      try {
        await confirm(clientSecret, 'succeed').expect(200); // webhook path refunds
      } finally {
        h.orders.outcome = 'PAID';
      }
      expect(await processor().process(cancelled(order.id, true))).toBe('processed'); // event path
      const payment = (
        await request(h.http)
          .get(`/api/v1/payments/manage/${paymentId}`)
          .set('Authorization', staff)
      ).body as Payment;
      expect(payment.refunds).toHaveLength(1);
      expect(payment).toMatchObject({ status: 'REFUNDED', refunded: { amount: 60_00 } });
    });
  });
});
