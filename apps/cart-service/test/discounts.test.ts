import { randomUUID } from 'node:crypto';
import type { Cart, DiscountCode, WishlistItem } from '@market/types';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DiscountService } from '../src/discounts/discount.service.js';
import { cartCookie, createHarness, type Harness } from './harness.js';

describe('cart-service: discounts, wishlist and internal API', () => {
  let h: Harness;
  let staff: string;

  beforeAll(async () => {
    h = await createHarness();
    staff = `Bearer ${await h.token(randomUUID(), ['STAFF'])}`;
  });

  afterAll(async () => {
    await h.close();
  });

  async function createCode(body: Record<string, unknown>): Promise<DiscountCode> {
    const res = await request(h.http)
      .post('/api/v1/discounts')
      .set('Authorization', staff)
      .send(body)
      .expect(201);
    return res.body as DiscountCode;
  }

  async function guestCartWith(price: number) {
    const variant = h.catalog.addVariant(price);
    h.inventory.stock.set(variant.variantId, 10);
    const res = await request(h.http)
      .post('/api/v1/cart/items')
      .send({ variantId: variant.variantId, quantity: 1 })
      .expect(201);
    return cartCookie(res.headers['set-cookie'])!;
  }

  const apply = (cookie: string, code: string) =>
    request(h.http).post('/api/v1/cart/coupon').set('Cookie', cookie).send({ code });

  describe('back office', () => {
    it('is reserved to staff', async () => {
      await request(h.http).get('/api/v1/discounts').expect(401);
      const customer = await h.token(randomUUID());
      await request(h.http)
        .get('/api/v1/discounts')
        .set('Authorization', `Bearer ${customer}`)
        .expect(403);
    });

    it('creates codes upper-cased, rejects duplicates and impossible percentages', async () => {
      const code = await createCode({ code: 'spring-15', type: 'PERCENTAGE', value: 1_500 });
      expect(code).toMatchObject({ code: 'SPRING-15', usedCount: 0, active: true });
      await request(h.http)
        .post('/api/v1/discounts')
        .set('Authorization', staff)
        .send({ code: 'SPRING-15', type: 'FIXED', value: 100 })
        .expect(409);
      await request(h.http)
        .post('/api/v1/discounts')
        .set('Authorization', staff)
        .send({ code: 'TOO-MUCH', type: 'PERCENTAGE', value: 10_001 })
        .expect(400);
      await request(h.http)
        .post('/api/v1/discounts')
        .set('Authorization', staff)
        .send({
          code: 'BACKWARDS',
          type: 'FIXED',
          value: 100,
          startsAt: '2030-01-02T00:00:00Z',
          expiresAt: '2030-01-01T00:00:00Z',
        })
        .expect(400);
      const list = await request(h.http).get('/api/v1/discounts').set('Authorization', staff);
      expect((list.body as DiscountCode[]).map((c) => c.code)).toContain('SPRING-15');
    });

    it('patches only the fields sent', async () => {
      const code = await createCode({
        code: 'PATCHME',
        type: 'FIXED',
        value: 5_00,
        usageLimit: 10,
        minSubtotal: 20_00,
      });
      const res = await request(h.http)
        .patch(`/api/v1/discounts/${code.id}`)
        .set('Authorization', staff)
        .send({ active: false })
        .expect(200);
      expect(res.body).toMatchObject({
        active: false,
        usageLimit: 10,
        value: 5_00,
        minSubtotal: { amount: 20_00 },
      });
    });
  });

  describe('coupons in the cart', () => {
    it('applies a percentage code and recomputes the totals', async () => {
      await createCode({ code: 'TENOFF', type: 'PERCENTAGE', value: 1_000 });
      const cookie = await guestCartWith(200_00);
      const res = await apply(cookie, ' tenoff ').expect(200);
      const cart = res.body as Cart;
      expect(cart.couponCode).toBe('TENOFF');
      expect(cart.discount.amount).toBe(20_00);
      expect(cart.total.amount).toBe(180_00);
    });

    it('caps a fixed discount at the subtotal and charges shipping on what is left', async () => {
      await createCode({ code: 'BIGFIXED', type: 'FIXED', value: 500_00 });
      const cookie = await guestCartWith(60_00);
      const cart = (await apply(cookie, 'BIGFIXED').expect(200)).body as Cart;
      expect(cart.discount.amount).toBe(60_00);
      expect(cart.shipping.amount).toBe(6_90);
      expect(cart.total.amount).toBe(6_90);
    });

    it('explains why a code cannot be used', async () => {
      await createCode({
        code: 'EXPIRED1',
        type: 'FIXED',
        value: 100,
        expiresAt: '2020-01-01T00:00:00Z',
      });
      await createCode({ code: 'MIN100', type: 'FIXED', value: 100, minSubtotal: 100_00 });
      await createCode({ code: 'ONCEEACH', type: 'FIXED', value: 100, perCustomerLimit: 1 });
      const cookie = await guestCartWith(50_00);

      expect((await apply(cookie, 'NOPE').expect(422)).body.error.code).toBe('COUPON_INVALID');
      expect((await apply(cookie, 'EXPIRED1').expect(422)).body.error.code).toBe('COUPON_EXPIRED');
      expect((await apply(cookie, 'MIN100').expect(422)).body.error.message).toMatch(
        /at least 100.00 EUR/,
      );
      expect((await apply(cookie, 'ONCEEACH').expect(422)).body.error.message).toBe(
        'Sign in to use this code',
      );
    });

    it('drops a code that stops being valid, with a notice', async () => {
      const code = await createCode({ code: 'SHORTLIVED', type: 'FIXED', value: 10_00 });
      const cookie = await guestCartWith(50_00);
      await apply(cookie, 'SHORTLIVED').expect(200);
      await request(h.http)
        .patch(`/api/v1/discounts/${code.id}`)
        .set('Authorization', staff)
        .send({ active: false })
        .expect(200);
      const cart = (await request(h.http).get('/api/v1/cart').set('Cookie', cookie)).body as Cart;
      expect(cart.couponCode).toBeNull();
      expect(cart.discount.amount).toBe(0);
      expect(cart.notices).toEqual([expect.objectContaining({ code: 'COUPON_REMOVED' })]);
    });

    it('removes a code on request', async () => {
      const cookie = await guestCartWith(50_00);
      await apply(cookie, 'TENOFF').expect(200);
      const res = await request(h.http).delete('/api/v1/cart/coupon').set('Cookie', cookie);
      expect((res.body as Cart).couponCode).toBeNull();
    });
  });

  describe('internal API (order-service)', () => {
    it('returns the authoritative priced cart and clears it', async () => {
      const userId = randomUUID();
      const token = await h.token(userId);
      const variant = h.catalog.addVariant(45_00);
      h.inventory.stock.set(variant.variantId, 5);
      await request(h.http)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${token}`)
        .send({ variantId: variant.variantId, quantity: 2 })
        .expect(201);

      const priced = await request(h.http)
        .post('/api/v1/internal/carts/priced')
        .send({ userId })
        .expect(200);
      const cart = priced.body as Cart;
      expect(cart).toMatchObject({ itemCount: 2, subtotal: { amount: 90_00 }, canCheckout: true });

      await request(h.http).post(`/api/v1/internal/carts/${cart.id!}/clear`).expect(204);
      await request(h.http).post(`/api/v1/internal/carts/${cart.id!}/clear`).expect(204);
      const after = await request(h.http)
        .post('/api/v1/internal/carts/priced')
        .send({ userId })
        .expect(200);
      expect((after.body as Cart).items).toEqual([]);
      await request(h.http).post('/api/v1/internal/carts/priced').send({}).expect(400);
    });

    it('redeems a code once per order, enforces limits and gives uses back', async () => {
      await createCode({
        code: 'TWOUSES',
        type: 'FIXED',
        value: 5_00,
        usageLimit: 2,
        perCustomerLimit: 1,
      });
      const alice = randomUUID();
      const bob = randomUUID();
      const carol = randomUUID();
      const redeem = (orderId: string, userId: string | null) =>
        request(h.http)
          .post('/api/v1/internal/discounts/redeem')
          .send({ code: 'twouses', orderId, userId, subtotal: 50_00 });

      const order1 = randomUUID();
      const first = await redeem(order1, alice).expect(200);
      expect(first.body).toMatchObject({ orderId: order1, code: 'TWOUSES', value: 5_00 });
      await redeem(order1, alice).expect(200); // retry: same claim, not a second use
      expect((await redeem(randomUUID(), alice).expect(422)).body.error.message).toBe(
        'You have already used this code',
      );
      await redeem(randomUUID(), null).expect(422); // per-customer codes need a user
      await redeem(randomUUID(), bob).expect(200);
      expect((await redeem(randomUUID(), carol).expect(422)).body.error.code).toBe(
        'COUPON_EXPIRED',
      );

      const released = await request(h.http)
        .post('/api/v1/internal/discounts/release')
        .send({ orderId: order1 })
        .expect(200);
      expect(released.body).toEqual({ released: true });
      await request(h.http)
        .post('/api/v1/internal/discounts/release')
        .send({ orderId: order1 })
        .expect(200, { released: false });
      await redeem(randomUUID(), carol).expect(200);

      const codes = await h.app.get(DiscountService).list();
      expect(codes.find((c) => c.code === 'TWOUSES')?.usedCount).toBe(2);
    });
  });

  describe('wishlist', () => {
    it('requires sign-in', async () => {
      await request(h.http).get('/api/v1/wishlist').expect(401);
    });

    it('saves, lists and removes variants', async () => {
      const auth = `Bearer ${await h.token(randomUUID())}`;
      const variant = h.catalog.addVariant(99_00, {
        compareAtPrice: { amount: 120_00, currency: 'EUR' },
      });
      const sold = h.catalog.addVariant(10_00, { availability: 'OUT_OF_STOCK' });
      for (const v of [variant, sold, variant]) {
        await request(h.http)
          .post('/api/v1/wishlist/items')
          .set('Authorization', auth)
          .send({ variantId: v.variantId })
          .expect(201);
      }
      const list = (await request(h.http).get('/api/v1/wishlist').set('Authorization', auth))
        .body as WishlistItem[];
      expect(list).toHaveLength(2);
      expect(list.find((i) => i.variantId === variant.variantId)).toMatchObject({
        price: { amount: 99_00 },
        compareAtPrice: { amount: 120_00 },
        available: true,
      });
      expect(list.find((i) => i.variantId === sold.variantId)?.available).toBe(false);

      await request(h.http)
        .post('/api/v1/wishlist/items')
        .set('Authorization', auth)
        .send({ variantId: randomUUID() })
        .expect(404);

      const after = await request(h.http)
        .delete(`/api/v1/wishlist/items/${sold.variantId}`)
        .set('Authorization', auth)
        .expect(200);
      expect((after.body as WishlistItem[]).map((i) => i.variantId)).toEqual([variant.variantId]);
    });
  });
});
