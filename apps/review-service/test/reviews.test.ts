import { randomUUID } from 'node:crypto';
import { createEvent, OrderCancelledV1, OrderCreatedV1, OrderPaidV1 } from '@market/events';
import { EventProcessor, InMemoryPublisher } from '@market/messaging';
import type { ProductReview, ReviewPage } from '@market/types';
import { asc, eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { outboxEvents } from '../src/db/schema.js';
import { reviewConsumers } from '../src/events/consumers.js';
import { PurchaseProjection } from '../src/purchases/purchases.js';
import { createHarness, silentLogger, type Harness } from './harness.js';

const body = 'Thocky, solid, the gasket mount makes long sessions comfortable.';

describe('review-service', () => {
  let h: Harness;
  let staff: string;

  beforeAll(async () => {
    h = await createHarness();
    staff = `Bearer ${await h.token(randomUUID(), { roles: ['STAFF'] })}`;
  });

  afterAll(async () => {
    await h.close();
  });

  async function shopper(options: { verified?: boolean } = {}) {
    const userId = randomUUID();
    return { userId, auth: `Bearer ${await h.token(userId, options)}` };
  }

  const write = (auth: string, productId: string, overrides: Record<string, unknown> = {}) =>
    request(h.http)
      .post('/api/v1/reviews')
      .set('Authorization', auth)
      .send({ productId, rating: 5, title: 'Love it', body, authorName: 'Ana P.', ...overrides });

  const list = async (productId: string, query = '', auth?: string) => {
    const req = request(h.http).get(`/api/v1/reviews?productId=${productId}${query}`);
    if (auth) req.set('Authorization', auth);
    return (await req.expect(200)).body as ReviewPage;
  };

  const ratingEvents = async (productId: string) =>
    (
      await h.db
        .select()
        .from(outboxEvents)
        .where(eq(outboxEvents.messageKey, productId))
        .orderBy(asc(outboxEvents.sequence))
    )
      .map(
        (row) =>
          row.envelope as { eventType: string; payload: { average?: number; count?: number } },
      )
      .filter((e) => e.eventType === 'ProductRatingChanged')
      .map((e) => [e.payload.average, e.payload.count]);

  describe('writing', () => {
    it('publishes a review, updates the summary and announces the new aggregate', async () => {
      const { productId } = h.catalog.addProduct();
      const a = await shopper();
      const b = await shopper();
      const created = (await write(a.auth, productId).expect(201)).body as ProductReview;
      expect(created).toMatchObject({
        status: 'PUBLISHED',
        rating: 5,
        verifiedPurchase: false,
        mine: true,
      });
      await write(b.auth, productId, { rating: 2, title: 'Not for me' }).expect(201);

      const page = await list(productId);
      expect(page.summary).toMatchObject({
        average: 3.5,
        count: 2,
        distribution: { 1: 0, 2: 1, 3: 0, 4: 0, 5: 1 },
      });
      expect(page.items.map((r) => r.mine)).toEqual([false, false]);
      expect(await ratingEvents(productId)).toEqual([
        [5, 1],
        [3.5, 2],
      ]);
    });

    it('allows one review per product, editable, and deletable by its author only', async () => {
      const { productId } = h.catalog.addProduct();
      const me = await shopper();
      const other = await shopper();
      const review = (await write(me.auth, productId).expect(201)).body as ProductReview;
      expect((await write(me.auth, productId).expect(409)).body.error.message).toMatch(
        /already reviewed/,
      );

      const edited = await request(h.http)
        .patch(`/api/v1/reviews/${review.id}`)
        .set('Authorization', me.auth)
        .send({ rating: 4, title: 'Still great', body, authorName: 'Ana P.' })
        .expect(200);
      expect(edited.body).toMatchObject({ rating: 4, editedAt: expect.any(String) });
      await request(h.http)
        .patch(`/api/v1/reviews/${review.id}`)
        .set('Authorization', other.auth)
        .send({ rating: 1, title: 'Hijack', body, authorName: 'Mallory' })
        .expect(404);
      await request(h.http)
        .delete(`/api/v1/reviews/${review.id}`)
        .set('Authorization', other.auth)
        .expect(404);
      await request(h.http)
        .delete(`/api/v1/reviews/${review.id}`)
        .set('Authorization', me.auth)
        .expect(204);
      expect((await list(productId)).summary.count).toBe(0);
      expect((await ratingEvents(productId)).at(-1)).toEqual([0, 0]);
    });

    it('requires a signed-in shopper with a confirmed email, a real product and sane text', async () => {
      const { productId } = h.catalog.addProduct();
      await write('', productId).expect(401);
      const unverified = await shopper({ verified: false });
      expect((await write(unverified.auth, productId).expect(403)).body.error.code).toBe(
        'EMAIL_NOT_VERIFIED',
      );
      const me = await shopper();
      await write(me.auth, randomUUID()).expect(404);
      const draft = h.catalog.addProduct('DRAFT');
      await write(me.auth, draft.productId).expect(404);
      const short = await write(me.auth, productId, { body: 'meh' }).expect(400);
      expect(short.body.error.details[0]).toMatchObject({
        path: 'body',
        message: 'The review needs at least 20 characters',
      });
      await write(me.auth, productId, { rating: 6 }).expect(400);
    });

    it('holds reviews with links or contact details for moderation', async () => {
      const { productId } = h.catalog.addProduct();
      const me = await shopper();
      const held = (
        await write(me.auth, productId, { body: `${body} More at www.cheap-keebs.example` }).expect(
          201,
        )
      ).body as ProductReview;
      expect(held.status).toBe('PENDING');
      expect((await list(productId)).items).toEqual([]);
      const mine = await request(h.http)
        .get(`/api/v1/reviews/mine?productId=${productId}`)
        .set('Authorization', me.auth)
        .expect(200);
      expect(mine.body.review).toMatchObject({ id: held.id, status: 'PENDING' });
      expect(await ratingEvents(productId)).toEqual([]);
    });
  });

  describe('votes and reports', () => {
    it('counts one helpfulness vote per shopper, changeable, never on your own review', async () => {
      const { productId } = h.catalog.addProduct();
      const author = await shopper();
      const voter = await shopper();
      const review = (await write(author.auth, productId).expect(201)).body as ProductReview;
      const vote = (auth: string, value: string | null) =>
        request(h.http)
          .put(`/api/v1/reviews/${review.id}/vote`)
          .set('Authorization', auth)
          .send({ vote: value });

      expect((await vote(voter.auth, 'helpful').expect(200)).body).toMatchObject({
        helpfulCount: 1,
        myVote: 'helpful',
      });
      expect((await vote(voter.auth, 'helpful').expect(200)).body.helpfulCount).toBe(1);
      expect((await vote(voter.auth, 'not_helpful').expect(200)).body).toMatchObject({
        helpfulCount: 0,
        notHelpfulCount: 1,
        myVote: 'not_helpful',
      });
      expect((await vote(voter.auth, null).expect(200)).body).toMatchObject({
        notHelpfulCount: 0,
        myVote: null,
      });
      await vote(author.auth, 'helpful').expect(403);
    });

    it('sorts by helpfulness and filters by stars and verified purchases', async () => {
      const { productId } = h.catalog.addProduct();
      const [a, b, c] = [await shopper(), await shopper(), await shopper()];
      const low = (await write(a.auth, productId, { rating: 1, title: 'Broke' }).expect(201))
        .body as ProductReview;
      await write(b.auth, productId, { rating: 4, title: 'Good' }).expect(201);
      await request(h.http)
        .put(`/api/v1/reviews/${low.id}/vote`)
        .set('Authorization', c.auth)
        .send({ vote: 'helpful' });
      expect((await list(productId)).items.map((r) => r.title)).toEqual(['Broke', 'Good']);
      expect((await list(productId, '&sort=highest')).items.map((r) => r.rating)).toEqual([4, 1]);
      expect((await list(productId, '&rating=4')).items).toHaveLength(1);
      expect((await list(productId, '&verified=1')).items).toEqual([]);
      expect((await list(productId, '', c.auth)).items.find((r) => r.id === low.id)?.myVote).toBe(
        'helpful',
      );
    });

    it('sends a review back to moderation after 3 reports from different shoppers', async () => {
      const { productId } = h.catalog.addProduct();
      const author = await shopper();
      const review = (await write(author.auth, productId).expect(201)).body as ProductReview;
      const report = (auth: string) =>
        request(h.http)
          .post(`/api/v1/reviews/${review.id}/report`)
          .set('Authorization', auth)
          .send({ reason: 'spam' });
      const first = await shopper();
      await report(first.auth).expect(204);
      await report(first.auth).expect(204); // the same shopper twice counts once
      await report((await shopper()).auth).expect(204);
      expect((await list(productId)).summary.count).toBe(1);
      await report((await shopper()).auth).expect(204);
      expect((await list(productId)).summary.count).toBe(0);
      await report(author.auth).expect(404); // hidden now
    });
  });

  describe('moderation (back office)', () => {
    it('is staff only, and publishing or rejecting updates the rating', async () => {
      const { productId } = h.catalog.addProduct();
      const me = await shopper();
      const held = (
        await write(me.auth, productId, { body: `${body} mail me: a@b.example.com` }).expect(201)
      ).body as ProductReview;
      await request(h.http).get('/api/v1/reviews/manage').set('Authorization', me.auth).expect(403);
      const queue = await request(h.http)
        .get('/api/v1/reviews/manage')
        .set('Authorization', staff)
        .expect(200);
      expect(queue.body.items.find((r: { id: string }) => r.id === held.id)).toMatchObject({
        moderationNote: 'Contains an email address',
      });
      const moderate = (status: string) =>
        request(h.http)
          .post(`/api/v1/reviews/manage/${held.id}/status`)
          .set('Authorization', staff)
          .send({ status, note: null })
          .expect(200);
      await moderate('PUBLISHED');
      expect((await list(productId)).summary.count).toBe(1);
      await moderate('REJECTED');
      expect((await list(productId)).summary.count).toBe(0);
      expect(await ratingEvents(productId)).toEqual([
        [5, 1],
        [0, 0],
      ]);
    });

    it('lists one customer’s reviews in every status', async () => {
      const me = await shopper();
      const published = h.catalog.addProduct().productId;
      const held = h.catalog.addProduct().productId;
      await write(me.auth, published).expect(201);
      await write(me.auth, held, { body: `${body} call +40 712 345 678` }).expect(201);
      const res = await request(h.http)
        .get(`/api/v1/reviews/manage?userId=${me.userId}`)
        .set('Authorization', staff)
        .expect(200);
      expect(res.body.items.map((r: { status: string }) => r.status).sort()).toEqual([
        'PENDING',
        'PUBLISHED',
      ]);
    });
  });

  describe('verified purchases (order events)', () => {
    const processor = () =>
      new EventProcessor(
        h.db,
        new InMemoryPublisher(),
        reviewConsumers(new PurchaseProjection(h.db, h.catalog))[0]!,
        { maxAttempts: 1, retryDelayMs: 1, logger: silentLogger },
      );
    const deliver = (envelope: { eventId: string; aggregateId: string }) =>
      processor().process({
        topic: 'orders.order.events',
        partition: 0,
        offset: '1',
        key: envelope.aggregateId,
        value: JSON.stringify(envelope),
        headers: {},
      });
    const meta = (orderId: string) => ({
      producer: 'order-service',
      aggregateId: orderId,
      correlationId: 'test',
    });

    function created(orderId: string, userId: string, variantId: string) {
      const eur = (amount: number) => ({ amount, currency: 'EUR' as const });
      return createEvent(
        OrderCreatedV1,
        {
          orderId,
          orderNumber: 'CSE-1',
          userId,
          email: 'a@example.com',
          lines: [
            {
              kind: 'variant',
              variantId,
              configurationId: null,
              sku: 'SKU-1',
              name: 'Board',
              quantity: 1,
              unitPrice: eur(100_00),
            },
          ],
          shippingCountry: 'RO',
          couponCode: null,
          subtotal: eur(100_00),
          discount: eur(0),
          shipping: eur(0),
          tax: eur(17_36),
          total: eur(100_00),
        },
        meta(orderId),
      );
    }
    const paid = (orderId: string) =>
      createEvent(
        OrderPaidV1,
        {
          orderId,
          orderNumber: 'CSE-1',
          paymentId: randomUUID(),
          reservationId: null,
          cartId: null,
          total: { amount: 100_00, currency: 'EUR' },
          paidAt: new Date().toISOString(),
        },
        meta(orderId),
      );

    it('marks reviews from paying customers as verified, before or after they write them', async () => {
      const { productId, variantIds } = h.catalog.addProduct();
      const buyer = await shopper();
      const orderId = randomUUID();
      expect(await deliver(created(orderId, buyer.userId, variantIds[1]!))).toBe('processed');
      // Created but not paid yet: no badge.
      const review = (await write(buyer.auth, productId).expect(201)).body as ProductReview;
      expect(review.verifiedPurchase).toBe(false);
      const paidEvent = paid(orderId);
      expect(await deliver(paidEvent)).toBe('processed');
      expect(await deliver(paidEvent)).toBe('duplicate');
      expect((await list(productId, '&verified=1')).items.map((r) => r.id)).toEqual([review.id]);
      expect((await list(productId)).summary.verifiedCount).toBe(1);

      // A second product bought and paid before reviewing: verified from the start.
      const second = h.catalog.addProduct();
      const order2 = randomUUID();
      await deliver(created(order2, buyer.userId, second.variantIds[0]!));
      await deliver(paid(order2));
      expect(
        ((await write(buyer.auth, second.productId).expect(201)).body as ProductReview)
          .verifiedPurchase,
      ).toBe(true);
    });

    it('withdraws the badge when the only order of the product is cancelled', async () => {
      const { productId, variantIds } = h.catalog.addProduct();
      const buyer = await shopper();
      const orderId = randomUUID();
      await deliver(created(orderId, buyer.userId, variantIds[0]!));
      await deliver(paid(orderId));
      await write(buyer.auth, productId).expect(201);
      await deliver(
        createEvent(
          OrderCancelledV1,
          {
            orderId,
            orderNumber: 'CSE-1',
            reservationId: null,
            reason: 'ADMIN',
            refundRequired: true,
          },
          meta(orderId),
        ),
      );
      expect((await list(productId)).items[0]?.verifiedPurchase).toBe(false);
    });

    it('ignores guest orders', async () => {
      const { variantIds } = h.catalog.addProduct();
      const orderId = randomUUID();
      const event = created(orderId, randomUUID(), variantIds[0]!);
      const guest = { ...event, payload: { ...event.payload, userId: null } };
      expect(await deliver(guest)).toBe('processed');
    });
  });
});
