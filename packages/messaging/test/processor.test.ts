import { randomUUID } from 'node:crypto';
import { inboxEvents } from '@market/db';
import { InventoryStockChangedV1, ProductCreatedV1 } from '@market/events';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EventProcessor, on, onIdempotent, PermanentEventError } from '../src/consumer.js';
import { InMemoryPublisher } from '../src/publisher.js';
import { messageFor, silentLogger, stockChanged, testDatabase, type TestDb } from './helpers.js';
import { notes } from './schema.js';

describe('EventProcessor', () => {
  let db: TestDb;
  let close: () => Promise<void>;
  let deadLetters: InMemoryPublisher;
  let calls: number;
  let failTimes: number;
  let permanent: boolean;

  beforeEach(async () => {
    ({ db, close } = await testDatabase());
    deadLetters = new InMemoryPublisher();
    calls = 0;
    failTimes = 0;
    permanent = false;
  });

  afterEach(async () => {
    await close();
  });

  function processor(maxAttempts = 3) {
    return new EventProcessor(
      db,
      deadLetters,
      {
        name: 'test-consumer',
        topics: ['inventory.stock.events'],
        handlers: [
          on(InventoryStockChangedV1, async (event, tx: TestDb) => {
            calls += 1;
            // The handler's write and the inbox row commit (or roll back) together.
            await tx
              .insert(notes)
              .values({ text: `${event.payload.sku}:${String(event.payload.available)}` });
            if (permanent) throw new PermanentEventError('cannot ever work');
            if (failTimes > 0) {
              failTimes -= 1;
              throw new Error('temporary failure');
            }
          }),
        ],
      },
      { maxAttempts, retryDelayMs: 1, logger: silentLogger },
    );
  }

  it('handles an event once, even when Kafka delivers it twice', async () => {
    const message = messageFor();
    const p = processor();
    expect(await p.process(message)).toBe('processed');
    expect(await p.process(message)).toBe('duplicate');
    expect(calls).toBe(1);
    expect(await db.select().from(notes)).toHaveLength(1);
    expect(await db.select().from(inboxEvents)).toMatchObject([
      {
        consumer: 'test-consumer',
        eventId: message.envelope.eventId,
        eventType: 'InventoryStockChanged',
      },
    ]);
  });

  it('retries transient failures without leaving partial writes', async () => {
    failTimes = 2;
    expect(await processor(3).process(messageFor())).toBe('processed');
    expect(calls).toBe(3);
    // The two failed attempts were rolled back: one note, one inbox row.
    expect(await db.select().from(notes)).toHaveLength(1);
    expect(await db.select().from(inboxEvents)).toHaveLength(1);
  });

  it('dead-letters after the last attempt, with the error attached, and can be replayed', async () => {
    failTimes = 99;
    const message = messageFor(stockChanged(randomUUID(), 0));
    expect(await processor(3).process(message)).toBe('dead-lettered');
    expect(calls).toBe(3);
    expect(deadLetters.published).toEqual([
      {
        topic: 'inventory.stock.events.dlq',
        key: message.key,
        value: message.value,
        headers: expect.objectContaining({
          eventType: 'InventoryStockChanged',
          'dlq-reason': 'handler-failed',
          'dlq-error': 'Error: temporary failure',
          'dlq-consumer': 'test-consumer',
          'dlq-attempts': '3',
          'dlq-original-topic': 'inventory.stock.events',
          'dlq-original-offset': '42',
        }),
      },
    ]);
    // Nothing was recorded, so replaying the dead letter once fixed processes it.
    expect(await db.select().from(inboxEvents)).toEqual([]);
    failTimes = 0;
    expect(await processor().process(message)).toBe('processed');
  });

  it('does not retry permanent failures', async () => {
    permanent = true;
    expect(await processor(5).process(messageFor())).toBe('dead-lettered');
    expect(calls).toBe(1);
  });

  it('dead-letters malformed and unknown messages without calling handlers', async () => {
    const p = processor();
    const base = messageFor();
    expect(await p.process({ ...base, value: 'not json' })).toBe('dead-lettered');
    const unknown = JSON.stringify({ ...base.envelope, eventVersion: 99 });
    expect(await p.process({ ...base, value: unknown })).toBe('dead-lettered');
    const badPayload = JSON.stringify({ ...base.envelope, payload: { variantId: 'nope' } });
    expect(await p.process({ ...base, value: badPayload })).toBe('dead-lettered');
    expect(deadLetters.published.map((m) => m.headers['dlq-reason'])).toEqual([
      'invalid-event',
      'invalid-event',
      'invalid-event',
    ]);
    expect(calls).toBe(0);
  });

  it('ignores valid events it has no handler for', async () => {
    const productId = randomUUID();
    const { createEvent } = await import('@market/events');
    const envelope = createEvent(
      ProductCreatedV1,
      {
        productId,
        slug: 'board',
        name: 'Board',
        brand: 'CSE',
        categoryId: randomUUID(),
        status: 'DRAFT',
        variants: [],
      },
      { producer: 'product-service', aggregateId: productId, correlationId: 'x' },
    );
    expect(await processor().process({ ...messageFor(), value: JSON.stringify(envelope) })).toBe(
      'ignored',
    );
    expect(deadLetters.published).toEqual([]);
  });

  it('runs idempotent handlers outside the inbox transaction, once per event', async () => {
    let effects = 0;
    const outside = new EventProcessor(
      db,
      deadLetters,
      {
        name: 'outside-consumer',
        topics: ['inventory.stock.events'],
        handlers: [
          onIdempotent(InventoryStockChangedV1, async () => {
            effects += 1;
            // May use the database freely (its own transactions): no inbox transaction is open.
            await db.transaction(async (tx) => {
              await tx.insert(notes).values({ text: 'own transaction' });
            });
          }),
        ],
      },
      { maxAttempts: 2, retryDelayMs: 1, logger: silentLogger },
    );
    const message = messageFor();
    expect(await outside.process(message)).toBe('processed');
    expect(await outside.process(message)).toBe('duplicate');
    expect(effects).toBe(1);
  });
});
