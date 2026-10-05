import { randomUUID } from 'node:crypto';
import { createEvent, ProductCreatedV1, ProductUpdatedV1 } from '@market/events';
import { createLogger } from '@market/logger';
import { EventProcessor, InMemoryPublisher } from '@market/messaging';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inventoryItems } from '../src/db/schema.js';
import { inventoryConsumers } from '../src/events/consumers.js';
import { createHarness, type Harness } from './harness.js';

describe('catalog events → stock records', () => {
  let h: Harness;
  let processor: EventProcessor<Harness['db']>;

  beforeAll(async () => {
    h = await createHarness();
    processor = new EventProcessor(h.db, new InMemoryPublisher(), inventoryConsumers(h.stock)[0]!, {
      maxAttempts: 1,
      retryDelayMs: 1,
      logger: createLogger({ service: 'test', level: 'silent' }),
    });
  });

  afterAll(async () => {
    await h.close();
  });

  const variant = (sku: string) => ({
    variantId: randomUUID(),
    sku,
    price: { amount: 100_00, currency: 'EUR' as const },
    attributes: {},
  });

  function message<D extends typeof ProductCreatedV1 | typeof ProductUpdatedV1>(
    definition: D,
    payload: Parameters<typeof createEvent<D>>[1],
    productId: string,
  ) {
    const envelope = createEvent(definition, payload, {
      producer: 'product-service',
      aggregateId: productId,
      correlationId: 'test',
    });
    return {
      topic: definition.topic,
      partition: 0,
      offset: '1',
      key: productId,
      value: JSON.stringify(envelope),
      headers: {},
    };
  }

  it('creates stock records for new variants and keeps SKUs in sync, idempotently', async () => {
    const productId = randomUUID();
    const a = variant('NEW-A');
    const b = variant('NEW-B');
    const created = message(
      ProductCreatedV1,
      {
        productId,
        slug: 'new',
        name: 'New',
        brand: 'CSE',
        categoryId: randomUUID(),
        status: 'DRAFT',
        variants: [a],
      },
      productId,
    );
    expect(await processor.process(created)).toBe('processed');
    expect(await processor.process(created)).toBe('duplicate');

    const updated = message(
      ProductUpdatedV1,
      {
        productId,
        slug: 'new',
        name: 'New',
        status: 'PUBLISHED',
        variants: [{ ...a, sku: 'NEW-A2' }, b],
        changedFields: ['variants'],
      },
      productId,
    );
    expect(await processor.process(updated)).toBe('processed');

    const rows = await h.db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.variantId, a.variantId));
    expect(rows).toMatchObject([{ sku: 'NEW-A2', onHand: 0, reserved: 0 }]);
    const [second] = await h.db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.variantId, b.variantId));
    expect(second?.sku).toBe('NEW-B');
  });
});
