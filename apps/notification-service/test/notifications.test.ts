import { randomUUID } from 'node:crypto';
import {
  NotificationRequestedV1,
  OrderCancelledV1,
  OrderCreatedV1,
  OrderDeliveredV1,
  OrderPaidV1,
  OrderShippedV1,
  PaymentFailedV1,
  PaymentRefundedV1,
} from '@market/events';
import type { NotificationPreferences } from '@market/types';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { newsletterSubscribers, notificationLogs } from '../src/db/schema.js';
import { PermanentDeliveryError } from '../src/delivery/provider.js';
import { createHarness, eur, orderCreated, type Harness } from './harness.js';

/** The URL a button in the email points to. */
const linkTo = (text: string, path: string) => {
  const match = new RegExp(`https://shop\\.test${path}\\?token=([\\w.-]+)`).exec(text);
  if (!match?.[1]) throw new Error(`no ${path} link in:\n${text}`);
  return match[1];
};

describe('notification-service', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await createHarness();
  });

  afterAll(async () => {
    await h.close();
  });

  beforeEach(async () => {
    // Every test starts with an empty queue; earlier rows stay as history.
    await h.dispatcher.dispatch(new Date(Date.now() + 10 * 86_400_000));
  });

  const logsFor = (recipient: string) =>
    h.db.select().from(notificationLogs).where(eq(notificationLogs.recipient, recipient));

  describe('requested notifications (auth links)', () => {
    const request_ = (email: string, key = randomUUID()) =>
      h.deliver(
        NotificationRequestedV1,
        {
          notificationKey: `EMAIL_VERIFICATION:${key}`,
          channel: 'EMAIL',
          template: 'EMAIL_VERIFICATION',
          recipient: { userId: randomUUID(), email },
          data: {
            firstName: 'Ana',
            link: 'https://shop.test/verify-email?token=abc',
            expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
          },
        },
        randomUUID(),
      );

    it('queues, sends once, and erases the single-use link after delivery', async () => {
      const email = 'Ana@Example.com';
      const { result, eventId } = await request_(email);
      expect(result).toBe('processed');
      expect(await h.redeliver(eventId)).toBe('duplicate');

      expect(await h.dispatcher.dispatch()).toEqual({ sent: 1, retried: 0, failed: 0 });
      const [sent] = h.email.to('ana@example.com');
      expect(sent?.subject).toBe('Confirm your email address');
      expect(sent?.text).toContain('Hi Ana,');
      expect(sent?.text).toContain('https://shop.test/verify-email?token=abc');
      expect(sent?.html).toContain('href="https://shop.test/verify-email?token=abc"');
      // Security emails cannot be unsubscribed from.
      expect(sent?.headers['List-Unsubscribe']).toBeUndefined();

      const [log] = await logsFor('ana@example.com');
      expect(log).toMatchObject({ status: 'SENT', attempts: 1, data: null });
      expect(log?.providerMessageId).toMatch(/^log-/);

      expect(await h.dispatcher.dispatch()).toEqual({ sent: 0, retried: 0, failed: 0 });
      expect(h.email.to('ana@example.com')).toHaveLength(1);
    });

    it('sends one email per notification key, even from two different events', async () => {
      const email = `twice-${randomUUID().slice(0, 6)}@example.com`;
      const key = randomUUID();
      await request_(email, key);
      await request_(email, key);
      await h.dispatcher.dispatch();
      expect(h.email.to(email)).toHaveLength(1);
    });

    it('dead-letters a request whose data does not fit the template', async () => {
      const before = h.dlq.published.length;
      const { result } = await h.deliver(
        NotificationRequestedV1,
        {
          notificationKey: randomUUID(),
          channel: 'EMAIL',
          template: 'PASSWORD_RESET',
          recipient: { userId: null, email: 'broken@example.com' },
          data: { link: 'not a url' },
        },
        randomUUID(),
      );
      expect(result).toBe('dead-lettered');
      expect(h.dlq.published.length).toBe(before + 1);
      expect(await logsFor('broken@example.com')).toHaveLength(0);
    });
  });

  describe('order emails', () => {
    it('confirms a paid order with the server-computed totals', async () => {
      const order = orderCreated({ email: 'buyer1@example.com' });
      await h.deliver(OrderCreatedV1, order, order.orderId);
      const paid = await h.deliver(
        OrderPaidV1,
        {
          orderId: order.orderId,
          orderNumber: order.orderNumber,
          paymentId: randomUUID(),
          reservationId: randomUUID(),
          cartId: null,
          total: order.total,
          paidAt: new Date().toISOString(),
        },
        order.orderId,
      );
      expect(paid.result).toBe('processed');
      await h.dispatcher.dispatch();

      const [mail] = h.email.to('buyer1@example.com');
      expect(mail?.subject).toBe(`Order ${order.orderNumber} confirmed`);
      expect(mail?.text).toContain('2 × Forge 75 — Black / Gateron Yellow  €259.98');
      expect(mail?.text).toContain('Discount (WELCOME10)  −€26.00');
      expect(mail?.text).toContain('Shipping  Free');
      expect(mail?.text).toContain('Total paid  €233.98');
      expect(mail?.text).toContain(`https://shop.test/order/${order.orderId}`);
      // Escaped in HTML.
      expect(mail?.html).toContain('2 × Forge 75 — Black / Gateron Yellow');
    });

    it('records but does not email events older than MAX_EVENT_AGE_HOURS (topic replays)', async () => {
      const lastWeek = new Date(Date.now() - 7 * 86_400_000);
      const order = orderCreated({ email: 'replayed@example.com' });
      await h.deliver(OrderCreatedV1, order, order.orderId, lastWeek);
      await h.deliver(
        OrderPaidV1,
        {
          orderId: order.orderId,
          orderNumber: order.orderNumber,
          paymentId: randomUUID(),
          reservationId: null,
          cartId: null,
          total: order.total,
          paidAt: lastWeek.toISOString(),
        },
        order.orderId,
        lastWeek,
      );
      await h.dispatcher.dispatch();
      expect(h.email.to('replayed@example.com')).toHaveLength(0);
      expect(await logsFor('replayed@example.com')).toMatchObject([
        { template: 'ORDER_CONFIRMATION', status: 'SUPPRESSED', suppressedReason: 'event too old' },
      ]);
    });

    it('retries (then dead-letters) an OrderPaid that arrives before its OrderCreated', async () => {
      const orderId = randomUUID();
      const { result } = await h.deliver(
        OrderPaidV1,
        {
          orderId,
          orderNumber: 'CSE-X',
          paymentId: randomUUID(),
          reservationId: null,
          cartId: null,
          total: eur(100),
          paidAt: new Date().toISOString(),
        },
        orderId,
      );
      // maxAttempts is 1 in the harness; in production the consumer retries first.
      expect(result).toBe('dead-lettered');
    });

    it('sends shipping and delivery updates unless the shopper turned them off', async () => {
      const userId = randomUUID();
      const a = orderCreated({ userId, email: 'shipper@example.com' });
      await h.deliver(OrderCreatedV1, a, a.orderId);
      await h.deliver(
        OrderShippedV1,
        {
          orderId: a.orderId,
          carrier: 'DHL',
          trackingNumber: 'JD0001',
          trackingUrl: 'https://track.example/JD0001',
          shippedAt: new Date().toISOString(),
        },
        a.orderId,
      );
      await h.dispatcher.dispatch();
      const [shipped] = h.email.to('shipper@example.com');
      expect(shipped?.subject).toBe(`Order ${a.orderNumber} is on its way`);
      expect(shipped?.text).toContain('Track your parcel: https://track.example/JD0001');
      // Optional category: one-click unsubscribe (RFC 8058) and a footer link.
      expect(shipped?.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
      const oneClick =
        /<(https:\/\/api\.shop\.test\/api\/v1\/notifications\/unsubscribe\?token=[\w.-]+)>/.exec(
          shipped?.headers['List-Unsubscribe'] ?? '',
        )?.[1];
      expect(oneClick).toBeDefined();

      // The mail client's one-click POST (form body, no cookies, no login).
      const token = new URL(oneClick ?? '').searchParams.get('token') ?? '';
      await request(h.http)
        .post(`/api/v1/notifications/unsubscribe?token=${token}`)
        .type('form')
        .send('List-Unsubscribe=One-Click')
        .expect(200, { scope: 'order-updates' });

      await h.deliver(
        OrderDeliveredV1,
        { orderId: a.orderId, deliveredAt: new Date().toISOString() },
        a.orderId,
      );
      await h.dispatcher.dispatch();
      expect(h.email.to('shipper@example.com')).toHaveLength(1);
      const delivered = (await logsFor('shipper@example.com')).find(
        (log) => log.template === 'ORDER_DELIVERED',
      );
      expect(delivered).toMatchObject({
        status: 'SUPPRESSED',
        suppressedReason: 'order updates turned off',
      });
    });

    it('emails one payment failure per order, and refunds', async () => {
      const order = orderCreated({ email: 'declined@example.com' });
      await h.deliver(OrderCreatedV1, order, order.orderId);
      const failed = {
        paymentId: randomUUID(),
        orderId: order.orderId,
        stripePaymentIntentId: 'pi_1',
        amount: order.total,
        failureCode: 'card_declined',
        failureMessage: 'Your card was declined.',
      };
      await h.deliver(PaymentFailedV1, { ...failed, stripeEventId: 'evt_1' }, failed.paymentId);
      await h.deliver(PaymentFailedV1, { ...failed, stripeEventId: 'evt_2' }, failed.paymentId);
      await h.deliver(
        PaymentRefundedV1,
        {
          paymentId: failed.paymentId,
          orderId: order.orderId,
          stripePaymentIntentId: 'pi_1',
          amount: order.total,
          refundId: randomUUID(),
          stripeRefundId: 're_1',
          refunded: eur(5_000),
          totalRefunded: eur(5_000),
          isFullRefund: false,
        },
        failed.paymentId,
      );
      await h.dispatcher.dispatch();
      const subjects = h.email.to('declined@example.com').map((m) => m.subject);
      expect(subjects).toEqual([
        `Payment for order ${order.orderNumber} did not go through`,
        `Refund of €50.00 for order ${order.orderNumber}`,
      ]);
    });

    it('emails cancellations the shopper did not trigger at checkout, not payment timeouts', async () => {
      const timedOut = orderCreated({ email: 'cancel@example.com' });
      const byStore = orderCreated({ email: 'cancel@example.com' });
      for (const order of [timedOut, byStore])
        await h.deliver(OrderCreatedV1, order, order.orderId);
      const cancel = (order: typeof timedOut, reason: 'PAYMENT_TIMEOUT' | 'OUT_OF_STOCK') =>
        h.deliver(
          OrderCancelledV1,
          {
            orderId: order.orderId,
            orderNumber: order.orderNumber,
            reservationId: null,
            reason,
            refundRequired: reason === 'OUT_OF_STOCK',
          },
          order.orderId,
        );
      await cancel(timedOut, 'PAYMENT_TIMEOUT');
      await cancel(byStore, 'OUT_OF_STOCK');
      await h.dispatcher.dispatch();
      const mails = h.email.to('cancel@example.com');
      expect(mails.map((m) => m.subject)).toEqual([`Order ${byStore.orderNumber} was cancelled`]);
      expect(mails[0]?.text).toContain('because an item is no longer in stock');
      expect(mails[0]?.text).toContain('We are refunding your payment in full');
    });
  });

  describe('delivery', () => {
    const queue = async (email: string) => {
      await h.deliver(
        NotificationRequestedV1,
        {
          notificationKey: randomUUID(),
          channel: 'EMAIL',
          template: 'PASSWORD_RESET',
          recipient: { userId: null, email },
          data: {
            link: 'https://shop.test/reset-password?token=t',
            expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
          },
        },
        randomUUID(),
      );
      const [row] = await logsFor(email);
      return row!;
    };

    it('retries transient failures with backoff, then sends', async () => {
      const row = await queue('flaky@example.com');
      h.email.failures.push(new Error('connection reset'));
      const now = new Date();
      expect(await h.dispatcher.dispatch(now)).toEqual({ sent: 0, retried: 1, failed: 0 });
      const [afterFailure] = await logsFor('flaky@example.com');
      expect(afterFailure).toMatchObject({
        status: 'QUEUED',
        attempts: 1,
        lastError: 'connection reset',
      });
      expect(afterFailure!.nextAttemptAt.getTime()).toBeGreaterThan(now.getTime() + 25_000);

      // Not due yet.
      expect(await h.dispatcher.dispatch(now)).toEqual({ sent: 0, retried: 0, failed: 0 });
      expect(await h.dispatcher.dispatch(new Date(now.getTime() + 60_000))).toMatchObject({
        sent: 1,
      });
      const [sent] = await logsFor('flaky@example.com');
      expect(sent).toMatchObject({ id: row.id, status: 'SENT', attempts: 2, lastError: null });
    });

    it('fails permanent rejections at once; staff can queue them again', async () => {
      const row = await queue('rejected@example.com');
      h.email.failures.push(new PermanentDeliveryError('Address does not exist'));
      expect(await h.dispatcher.dispatch()).toMatchObject({ failed: 1 });

      const staff = `Bearer ${await h.token(randomUUID(), { roles: ['STAFF'] })}`;
      const shopper = `Bearer ${await h.token(randomUUID())}`;
      await request(h.http)
        .get('/api/v1/notifications/manage/logs?status=FAILED')
        .set('Authorization', shopper)
        .expect(403);
      const page = await request(h.http)
        .get('/api/v1/notifications/manage/logs?recipient=rejected@example.com')
        .set('Authorization', staff)
        .expect(200);
      expect(page.body).toMatchObject({
        total: 1,
        items: [
          { id: row.id, status: 'FAILED', resendable: true, lastError: 'Address does not exist' },
        ],
      });

      await request(h.http)
        .post(`/api/v1/notifications/manage/logs/${row.id}/retry`)
        .set('Authorization', staff)
        .expect(200);
      expect(await h.dispatcher.dispatch()).toMatchObject({ sent: 1 });
      // A sent email has no data left: it cannot be "retried" into a duplicate.
      await request(h.http)
        .post(`/api/v1/notifications/manage/logs/${row.id}/retry`)
        .set('Authorization', staff)
        .expect(409);
    });

    it('gives up after the maximum number of attempts', async () => {
      await queue('down@example.com');
      let now = Date.now();
      for (let i = 0; i < 8; i++) {
        h.email.failures.push(new Error('SES throttled'));
        await h.dispatcher.dispatch(new Date(now));
        now += 2 * 3_600_000;
      }
      const [row] = await logsFor('down@example.com');
      expect(row).toMatchObject({ status: 'FAILED', attempts: 8 });
    });
  });

  describe('newsletter', () => {
    const subscribe = (email: string) =>
      request(h.http).post('/api/v1/newsletter/subscriptions').send({ email });

    it('double opt-in: confirm link, welcome email with one-click unsubscribe', async () => {
      await subscribe('Fan@Example.com').expect(202, { status: 'pending_confirmation' });
      await subscribe('fan@example.com').expect(202); // within the cooldown: no second email
      await h.dispatcher.dispatch();
      const confirmations = h.email.to('fan@example.com');
      expect(confirmations).toHaveLength(1);
      const token = linkTo(confirmations[0]!.text, '/newsletter/confirm');

      await request(h.http).post('/api/v1/newsletter/confirm').send({ token }).expect(200);
      await request(h.http).post('/api/v1/newsletter/confirm').send({ token }).expect(200);
      await request(h.http)
        .post('/api/v1/newsletter/confirm')
        .send({ token: 'x'.repeat(40) })
        .expect(400)
        .expect(({ body }) => {
          expect(body.error.code).toBe('INVALID_TOKEN');
        });

      await h.dispatcher.dispatch();
      const welcome = h.email.to('fan@example.com')[1];
      expect(welcome?.subject).toBe('Welcome to the CSE Keyboards newsletter');
      expect(welcome?.headers['List-Unsubscribe']).toContain(
        '/api/v1/notifications/unsubscribe?token=',
      );

      const unsubscribe = linkTo(welcome!.text, '/unsubscribe');
      await request(h.http)
        .post('/api/v1/notifications/unsubscribe')
        .send({ token: unsubscribe })
        .expect(200, { scope: 'newsletter' });
      const [row] = await h.db
        .select()
        .from(newsletterSubscribers)
        .where(eq(newsletterSubscribers.email, 'fan@example.com'));
      expect(row?.status).toBe('UNSUBSCRIBED');
    });

    it('rejects forged unsubscribe tokens and invalid addresses', async () => {
      await request(h.http)
        .post('/api/v1/notifications/unsubscribe')
        .send({ token: 'eyJzY29wZSI6Im5ld3NsZXR0ZXIifQ.forged-signature' })
        .expect(400);
      await subscribe('not-an-email').expect(400);
    });

    it('does not reveal that an address is already subscribed', async () => {
      const auth = `Bearer ${await h.token(randomUUID(), { email: 'member@example.com' })}`;
      await request(h.http)
        .put('/api/v1/notifications/preferences')
        .set('Authorization', auth)
        .send({ newsletter: true })
        .expect(200);
      await subscribe('member@example.com').expect(202, { status: 'pending_confirmation' });
      await h.dispatcher.dispatch();
      // Only the welcome email: no confirmation link for an existing subscriber.
      expect(h.email.to('member@example.com').map((m) => m.subject)).toEqual([
        'Welcome to the CSE Keyboards newsletter',
      ]);
    });
  });

  describe('preferences', () => {
    it('reads defaults and updates order updates and the newsletter', async () => {
      const userId = randomUUID();
      const auth = `Bearer ${await h.token(userId, { email: 'prefs@example.com', verified: false })}`;
      await request(h.http).get('/api/v1/notifications/preferences').expect(401);
      const initial = await request(h.http)
        .get('/api/v1/notifications/preferences')
        .set('Authorization', auth)
        .expect(200);
      expect(initial.body).toEqual({ orderUpdates: true, newsletter: 'NONE' });

      const updated = await request(h.http)
        .put('/api/v1/notifications/preferences')
        .set('Authorization', auth)
        .send({ orderUpdates: false, newsletter: true })
        .expect(200);
      // Unverified account email: a confirmation link first.
      expect(updated.body as NotificationPreferences).toEqual({
        orderUpdates: false,
        newsletter: 'PENDING',
      });

      await request(h.http)
        .put('/api/v1/notifications/preferences')
        .set('Authorization', auth)
        .send({})
        .expect(400);
    });

    it('asks tokens without an email claim to sign in again for newsletter changes', async () => {
      const auth = `Bearer ${await h.token(randomUUID())}`;
      await request(h.http)
        .put('/api/v1/notifications/preferences')
        .set('Authorization', auth)
        .send({ newsletter: true })
        .expect(401);
    });
  });
});
