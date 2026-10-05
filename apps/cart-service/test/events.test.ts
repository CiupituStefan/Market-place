import { randomUUID } from 'node:crypto';
import { createEvent, OrderPaidV1 } from '@market/events';
import { createLogger } from '@market/logger';
import { EventProcessor, InMemoryPublisher } from '@market/messaging';
import type { Cart } from '@market/types';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DATABASE, type Database } from '../src/db/database.js';
import { cartConsumers } from '../src/events/consumers.js';
import { cartCookie, createHarness, type Harness } from './harness.js';

describe('OrderPaid → empty cart', () => {
  let h: Harness;
  let processor: EventProcessor<Database>;

  beforeAll(async () => {
    h = await createHarness();
    processor = new EventProcessor(
      h.app.get<Database>(DATABASE),
      new InMemoryPublisher(),
      cartConsumers()[0]!,
      {
        maxAttempts: 1,
        retryDelayMs: 1,
        logger: createLogger({ service: 'test', level: 'silent' }),
      },
    );
  });

  afterAll(async () => {
    await h.close();
  });

  function orderPaid(cartId: string | null) {
    const orderId = randomUUID();
    const envelope = createEvent(
      OrderPaidV1,
      {
        orderId,
        orderNumber: 'CSE-100001',
        paymentId: randomUUID(),
        reservationId: null,
        cartId,
        total: { amount: 100_00, currency: 'EUR' },
        paidAt: new Date().toISOString(),
      },
      { producer: 'order-service', aggregateId: orderId, correlationId: 'test' },
    );
    return {
      topic: OrderPaidV1.topic,
      partition: 0,
      offset: '1',
      key: orderId,
      value: JSON.stringify(envelope),
      headers: {},
    };
  }

  it('empties the paid cart once and leaves other carts alone', async () => {
    const variant = h.catalog.addVariant(100_00);
    h.inventory.stock.set(variant.variantId, 10);
    const add = () =>
      request(h.http)
        .post('/api/v1/cart/items')
        .send({ variantId: variant.variantId, quantity: 1 })
        .expect(201);
    const paid = await add();
    const other = await add();
    const paidCart = paid.body as Cart;

    const message = orderPaid(paidCart.id);
    expect(await processor.process(message)).toBe('processed');
    expect(await processor.process(message)).toBe('duplicate');

    const cartOf = async (res: request.Response) =>
      (
        await request(h.http)
          .get('/api/v1/cart')
          .set('Cookie', cartCookie(res.headers['set-cookie'])!)
      ).body as Cart;
    expect((await cartOf(paid)).items).toEqual([]);
    expect((await cartOf(other)).items).toHaveLength(1);
  });

  it('ignores orders without a cart', async () => {
    expect(await processor.process(orderPaid(null))).toBe('processed');
  });
});
