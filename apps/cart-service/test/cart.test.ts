import { randomUUID } from 'node:crypto';
import type { Cart } from '@market/types';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cartCookie, createHarness, type Harness } from './harness.js';

const vatOf = (total: number) => Math.round((total * 2_100) / 12_100);

describe('cart-service: cart', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await createHarness();
  });

  afterAll(async () => {
    await h.close();
  });

  /** A fresh visitor: returns helpers bound to its cart cookie. */
  async function visitor(variantId: string, quantity = 1) {
    const res = await request(h.http)
      .post('/api/v1/cart/items')
      .send({ variantId, quantity })
      .expect(201);
    const cookie = cartCookie(res.headers['set-cookie']);
    expect(cookie).toBeDefined();
    return { cookie: cookie!, cart: res.body as Cart };
  }

  it('reports readiness from its own database only', async () => {
    await request(h.http).get('/health/ready').expect(200);
  });

  it('returns an empty cart to a new visitor without creating one', async () => {
    const res = await request(h.http).get('/api/v1/cart').expect(200);
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body).toMatchObject({ id: null, items: [], itemCount: 0, canCheckout: false });
  });

  it('creates a visitor cart with an httpOnly cookie and prices it on the server', async () => {
    const variant = h.catalog.addVariant(120_00);
    h.inventory.stock.set(variant.variantId, 10);
    const res = await request(h.http)
      .post('/api/v1/cart/items')
      .send({ variantId: variant.variantId, quantity: 2 })
      .expect(201);
    const setCookie = String(res.headers['set-cookie']);
    expect(setCookie).toMatch(/cse_cart=[A-Za-z0-9_-]{43}/);
    expect(setCookie).toMatch(/HttpOnly/);
    expect(setCookie).toMatch(/SameSite=Lax/);
    const cart = res.body as Cart;
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0]).toMatchObject({
      sku: variant.sku,
      quantity: 2,
      unitPrice: { amount: 120_00, currency: 'EUR' },
      lineTotal: { amount: 240_00 },
      available: true,
      availableQuantity: 10,
    });
    expect(cart.subtotal.amount).toBe(240_00);
    expect(cart.shipping.amount).toBe(0); // above the free-shipping threshold
    expect(cart.total.amount).toBe(240_00);
    expect(cart.tax.amount).toBe(vatOf(240_00));
    expect(cart.canCheckout).toBe(true);
  });

  it('ignores prices sent by the client', async () => {
    const variant = h.catalog.addVariant(50_00);
    const res = await request(h.http)
      .post('/api/v1/cart/items')
      .send({ variantId: variant.variantId, quantity: 1, unitPrice: 1 })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('charges shipping below the free-shipping threshold', async () => {
    const variant = h.catalog.addVariant(40_00);
    h.inventory.stock.set(variant.variantId, 5);
    const { cart } = await visitor(variant.variantId);
    expect(cart.shipping.amount).toBe(6_90);
    expect(cart.total.amount).toBe(46_90);
  });

  it('adds up quantities, caps a line at 10 and keeps carts separate per visitor', async () => {
    const variant = h.catalog.addVariant(10_00);
    h.inventory.stock.set(variant.variantId, 100);
    const { cookie } = await visitor(variant.variantId, 6);
    const again = await request(h.http)
      .post('/api/v1/cart/items')
      .set('Cookie', cookie)
      .send({ variantId: variant.variantId, quantity: 4 })
      .expect(201);
    expect(again.headers['set-cookie']).toBeUndefined();
    expect((again.body as Cart).items[0]?.quantity).toBe(10);
    const over = await request(h.http)
      .post('/api/v1/cart/items')
      .set('Cookie', cookie)
      .send({ variantId: variant.variantId, quantity: 1 })
      .expect(409);
    expect(over.body.error.code).toBe('CONFLICT');

    const other = await visitor(variant.variantId, 1);
    expect(other.cart.id).not.toBe((again.body as Cart).id);
  });

  it('refuses more than the sellable stock', async () => {
    const variant = h.catalog.addVariant(30_00);
    h.inventory.stock.set(variant.variantId, 2);
    const res = await request(h.http)
      .post('/api/v1/cart/items')
      .send({ variantId: variant.variantId, quantity: 3 })
      .expect(409);
    expect(res.body.error).toMatchObject({
      code: 'INSUFFICIENT_STOCK',
      message: 'Only 2 left in stock',
    });
    h.inventory.stock.set(variant.variantId, 0);
    const none = await request(h.http)
      .post('/api/v1/cart/items')
      .send({ variantId: variant.variantId, quantity: 1 })
      .expect(409);
    expect(none.body.error.message).toBe('This item is out of stock');
  });

  it('still accepts items while inventory-service is down', async () => {
    const variant = h.catalog.addVariant(30_00);
    h.inventory.down = true;
    try {
      const { cart } = await visitor(variant.variantId);
      expect(cart.items[0]).toMatchObject({ available: true, availableQuantity: null });
    } finally {
      h.inventory.down = false;
    }
  });

  it('rejects unknown and unpublished products', async () => {
    await request(h.http)
      .post('/api/v1/cart/items')
      .send({ variantId: randomUUID(), quantity: 1 })
      .expect(404);
    const draft = h.catalog.addVariant(10_00, { productStatus: 'DRAFT' });
    const res = await request(h.http)
      .post('/api/v1/cart/items')
      .send({ variantId: draft.variantId, quantity: 1 })
      .expect(404);
    expect(res.body.error.code).toBe('VARIANT_NOT_FOUND');
  });

  it('flags a price change once and uses the new price', async () => {
    const variant = h.catalog.addVariant(80_00);
    h.inventory.stock.set(variant.variantId, 5);
    const { cookie } = await visitor(variant.variantId);
    h.catalog.setPrice(variant.variantId, 70_00);
    const first = (await request(h.http).get('/api/v1/cart').set('Cookie', cookie).expect(200))
      .body as Cart;
    expect(first.notices).toEqual([expect.objectContaining({ code: 'PRICE_CHANGED' })]);
    expect(first.subtotal.amount).toBe(70_00);
    const second = (await request(h.http).get('/api/v1/cart').set('Cookie', cookie).expect(200))
      .body as Cart;
    expect(second.notices).toEqual([]);
  });

  it('blocks checkout when an item is archived or out of stock, and excludes it from totals', async () => {
    const kept = h.catalog.addVariant(60_00);
    const gone = h.catalog.addVariant(40_00);
    h.inventory.stock.set(kept.variantId, 5);
    h.inventory.stock.set(gone.variantId, 5);
    const { cookie } = await visitor(kept.variantId);
    await request(h.http)
      .post('/api/v1/cart/items')
      .set('Cookie', cookie)
      .send({ variantId: gone.variantId, quantity: 1 })
      .expect(201);

    h.catalog.variants.set(gone.variantId, { ...gone, productStatus: 'ARCHIVED' });
    let cart = (await request(h.http).get('/api/v1/cart').set('Cookie', cookie)).body as Cart;
    expect(cart.canCheckout).toBe(false);
    expect(cart.subtotal.amount).toBe(60_00);
    expect(cart.notices).toEqual([expect.objectContaining({ code: 'ITEM_UNAVAILABLE' })]);

    h.catalog.variants.set(gone.variantId, gone);
    h.inventory.stock.set(kept.variantId, 0);
    cart = (await request(h.http).get('/api/v1/cart').set('Cookie', cookie)).body as Cart;
    expect(cart.notices).toEqual([
      expect.objectContaining({
        code: 'INSUFFICIENT_STOCK',
        message: expect.stringMatching(/out of stock/),
      }),
    ]);
    expect(cart.canCheckout).toBe(false);
  });

  it('updates and removes lines, only in the owner’s cart', async () => {
    const variant = h.catalog.addVariant(25_00);
    h.inventory.stock.set(variant.variantId, 3);
    const { cookie, cart } = await visitor(variant.variantId);
    const itemId = cart.items[0]!.id;

    const updated = await request(h.http)
      .patch(`/api/v1/cart/items/${itemId}`)
      .set('Cookie', cookie)
      .send({ quantity: 3 })
      .expect(200);
    expect((updated.body as Cart).itemCount).toBe(3);
    await request(h.http)
      .patch(`/api/v1/cart/items/${itemId}`)
      .set('Cookie', cookie)
      .send({ quantity: 4 })
      .expect(409);
    await request(h.http)
      .patch(`/api/v1/cart/items/${itemId}`)
      .set('Cookie', cookie)
      .send({ quantity: 0 })
      .expect(400);

    const stranger = await visitor(variant.variantId);
    await request(h.http)
      .delete(`/api/v1/cart/items/${itemId}`)
      .set('Cookie', stranger.cookie)
      .expect(404);

    const removed = await request(h.http)
      .delete(`/api/v1/cart/items/${itemId}`)
      .set('Cookie', cookie)
      .expect(200);
    expect((removed.body as Cart).items).toEqual([]);
  });

  it('empties the cart', async () => {
    const variant = h.catalog.addVariant(25_00);
    h.inventory.stock.set(variant.variantId, 3);
    const { cookie } = await visitor(variant.variantId);
    const res = await request(h.http).delete('/api/v1/cart').set('Cookie', cookie).expect(200);
    expect((res.body as Cart).items).toEqual([]);
  });

  it('ignores forged or malformed cart cookies', async () => {
    const res = await request(h.http)
      .get('/api/v1/cart')
      .set('Cookie', 'cse_cart=not-a-token')
      .expect(200);
    expect(res.body).toMatchObject({ id: null, items: [] });
  });

  it('adds configurator builds priced by the catalog', async () => {
    const add = () =>
      request(h.http)
        .post('/api/v1/cart/configurations')
        .send({ configurator: 'custom-75', selection: { layout: 'ansi', switch: 'linear-pro' } });
    const res = await add().expect(201);
    const cart = res.body as Cart;
    expect(cart.items[0]).toMatchObject({
      kind: 'configuration',
      name: 'Custom 75%',
      optionsLabel: 'ANSI / Linear Pro',
      unitPrice: { amount: 170_00 },
      configurationId: expect.stringMatching(/^cfg_/),
      available: true,
    });
    const cookie = cartCookie(res.headers['set-cookie'])!;

    await request(h.http)
      .post('/api/v1/cart/configurations')
      .send({ configurator: 'custom-75', selection: { layout: 'ansi' } })
      .expect(400);

    h.catalog.discontinued.add('linear-pro');
    try {
      const later = (await request(h.http).get('/api/v1/cart').set('Cookie', cookie)).body as Cart;
      expect(later.items[0]?.available).toBe(false);
      expect(later.canCheckout).toBe(false);
    } finally {
      h.catalog.discontinued.delete('linear-pro');
    }
  });

  it('merges the visitor cart into the user cart on sign-in', async () => {
    const userId = randomUUID();
    const token = await h.token(userId);
    const shared = h.catalog.addVariant(20_00);
    const onlyGuest = h.catalog.addVariant(30_00);
    h.inventory.stock.set(shared.variantId, 50);
    h.inventory.stock.set(onlyGuest.variantId, 50);

    await request(h.http)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ variantId: shared.variantId, quantity: 2 })
      .expect(201);

    const { cookie } = await visitor(shared.variantId, 3);
    await request(h.http)
      .post('/api/v1/cart/items')
      .set('Cookie', cookie)
      .send({ variantId: onlyGuest.variantId, quantity: 1 })
      .expect(201);

    const merged = await request(h.http)
      .get('/api/v1/cart')
      .set('Cookie', cookie)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(String(merged.headers['set-cookie'])).toMatch(/cse_cart=;/);
    const cart = merged.body as Cart;
    const quantities = Object.fromEntries(cart.items.map((i) => [i.variantId, i.quantity]));
    expect(quantities).toEqual({ [shared.variantId]: 5, [onlyGuest.variantId]: 1 });

    // The visitor cart is gone: its cookie alone now finds nothing.
    const orphan = await request(h.http).get('/api/v1/cart').set('Cookie', cookie).expect(200);
    expect(orphan.body).toMatchObject({ id: null, items: [] });
  });

  it('rejects an invalid token instead of silently falling back to the visitor cart', async () => {
    const res = await request(h.http)
      .get('/api/v1/cart')
      .set('Authorization', 'Bearer not-a-jwt')
      .expect(401);
    expect(res.body.error.code).toBeDefined();
  });
});
