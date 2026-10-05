import { randomUUID } from 'node:crypto';
import { outboxEvents } from '@market/db';
import { isNull } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { OutboxRelay } from '../src/outbox-relay.js';
import { InMemoryPublisher } from '../src/publisher.js';
import { enqueue, silentLogger, testDatabase, type TestDb } from './helpers.js';

const availableIn = (value: string) =>
  (JSON.parse(value) as { payload: { available: number } }).payload.available;

describe('OutboxRelay', () => {
  let db: TestDb;
  let close: () => Promise<void>;
  let publisher: InMemoryPublisher;
  let relay: OutboxRelay;

  beforeEach(async () => {
    ({ db, close } = await testDatabase());
    publisher = new InMemoryPublisher();
    relay = new OutboxRelay(db, publisher, {
      name: 'test-service',
      batchSize: 3,
      intervalMs: 10,
      retentionDays: 7,
      logger: silentLogger,
    });
  });

  afterEach(async () => {
    await relay.stop();
    await close();
  });

  it('publishes in commit order, keyed by aggregate, with metadata headers', async () => {
    const a = randomUUID();
    const b = randomUUID();
    // Same transaction → same created_at: ordering must come from the sequence.
    await db.transaction(async (tx) => {
      await enqueue(tx, a, 5);
      await enqueue(tx, b, 1);
      await enqueue(tx, a, 4);
    });
    expect(await relay.relayOnce()).toBe(3);
    expect(publisher.published.map((m) => [m.key, availableIn(m.value)])).toEqual([
      [a, 5],
      [b, 1],
      [a, 4],
    ]);
    expect(publisher.published[0]).toMatchObject({
      topic: 'inventory.stock.events',
      headers: { eventType: 'InventoryStockChanged', eventVersion: '1' },
    });
    expect(await db.select().from(outboxEvents).where(isNull(outboxEvents.publishedAt))).toEqual(
      [],
    );
    expect(await relay.relayOnce()).toBe(0);
  });

  it('works in batches', async () => {
    for (let i = 0; i < 7; i += 1) await enqueue(db, randomUUID(), i);
    expect(await relay.relayOnce()).toBe(3);
    expect(await relay.relayOnce()).toBe(3);
    expect(await relay.relayOnce()).toBe(1);
    expect(publisher.published.map((m) => availableIn(m.value))).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('keeps unpublished rows (and counts attempts) when the broker fails', async () => {
    await enqueue(db, randomUUID(), 1);
    publisher.failNext = 1;
    await expect(relay.relayOnce()).rejects.toThrow('broker unavailable');
    const [row] = await db.select().from(outboxEvents);
    expect(row).toMatchObject({ publishedAt: null, attempts: 1 });
    expect(await relay.relayOnce()).toBe(1);
  });

  it('runs on its own loop and drains the outbox', async () => {
    for (let i = 0; i < 5; i += 1) await enqueue(db, randomUUID(), i);
    relay.start();
    await expect.poll(() => publisher.published.length, { timeout: 5_000 }).toBe(5);
  });

  it('purges published rows after the retention period', async () => {
    await enqueue(db, randomUUID(), 1);
    await enqueue(db, randomUUID(), 2);
    await relay.relayOnce();
    expect(await relay.purge(new Date())).toBe(0);
    expect(await relay.purge(new Date(Date.now() + 8 * 24 * 60 * 60 * 1000))).toBe(2);
  });
});
