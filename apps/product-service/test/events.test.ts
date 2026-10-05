import { randomUUID } from 'node:crypto';
import { createEvent, InventoryStockChangedV1 } from '@market/events';
import { createLogger } from '@market/logger';
import { EventProcessor, InMemoryPublisher } from '@market/messaging';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CatalogWriterService } from '../src/catalog/catalog-writer.service.js';
import { productVariants } from '../src/db/schema.js';
import { productConsumers } from '../src/events/consumers.js';
import { createHarness, type Harness } from './harness.js';

interface ProductView {
  availability: string;
  variants: { id: string; sku: string; availability: string }[];
}

describe('InventoryStockChanged → catalog availability', () => {
  let h: Harness;
  let processor: EventProcessor<Harness['db']>;

  beforeAll(async () => {
    h = await createHarness();
    processor = new EventProcessor(
      h.db,
      new InMemoryPublisher(),
      productConsumers(h.app.get(CatalogWriterService))[0]!,
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

  const product = async () =>
    (await request(h.http).get('/api/v1/products/cse-forge-75').expect(200)).body as ProductView;

  function stockChanged(variantId: string, sku: string, available: number) {
    const availability =
      available === 0 ? 'OUT_OF_STOCK' : available <= 5 ? 'LOW_STOCK' : 'IN_STOCK';
    const envelope = createEvent(
      InventoryStockChangedV1,
      { variantId, sku, onHand: available, reserved: 0, available, availability },
      { producer: 'inventory-service', aggregateId: variantId, correlationId: 'test' },
    );
    return {
      topic: envelope.eventType,
      partition: 0,
      offset: '1',
      key: variantId,
      value: JSON.stringify(envelope),
      headers: {},
    };
  }

  it('projects stock levels onto variants and the product rollup, once per event', async () => {
    const before = await product();
    const variants = before.variants;
    for (const variant of variants) {
      expect(await processor.process(stockChanged(variant.id, variant.sku, 0))).toBe('processed');
    }
    const soldOut = await product();
    expect(soldOut.variants.every((v) => v.availability === 'OUT_OF_STOCK')).toBe(true);
    expect(soldOut.availability).toBe('OUT_OF_STOCK');

    const message = stockChanged(variants[0]!.id, variants[0]!.sku, 3);
    expect(await processor.process(message)).toBe('processed');
    expect(await processor.process(message)).toBe('duplicate');
    const restocked = await product();
    expect(restocked.variants[0]?.availability).toBe('LOW_STOCK');
    expect(restocked.availability).toBe('LOW_STOCK');
  });

  it('keeps pre-order variants on pre-order while nothing is in stock', async () => {
    const [variant] = (await product()).variants;
    await h.db
      .update(productVariants)
      .set({ availability: 'PREORDER' })
      .where(eq(productVariants.id, variant!.id));
    await processor.process(stockChanged(variant!.id, variant!.sku, 0));
    expect((await product()).variants[0]?.availability).toBe('PREORDER');
    await processor.process(stockChanged(variant!.id, variant!.sku, 20));
    expect((await product()).variants[0]?.availability).toBe('IN_STOCK');
  });

  it('ignores variants that are no longer in the catalog', async () => {
    expect(await processor.process(stockChanged(randomUUID(), 'GONE-1', 4))).toBe('processed');
  });
});
