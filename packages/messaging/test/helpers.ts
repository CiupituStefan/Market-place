import { randomUUID } from 'node:crypto';
import { Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { enqueueEvent } from '@market/db';
import { createTestDatabase } from '@market/db/testing';
import { createEvent, InventoryStockChangedV1 } from '@market/events';
import { createLogger, type Logger } from '@market/logger';
import * as schema from './schema.js';

export const migrationsFolder = fileURLToPath(new URL('./migrations', import.meta.url));

export const silentLogger: Logger = createLogger({
  service: 'messaging-test',
  destination: new Writable({
    write: (_chunk, _encoding, callback) => {
      callback();
    },
  }),
});

export function testDatabase() {
  return createTestDatabase({ schema, migrationsFolder });
}

export type TestDb = Awaited<ReturnType<typeof testDatabase>>['db'];

export function stockChanged(variantId: string = randomUUID(), available = 3) {
  return {
    variantId,
    sku: `SKU-${variantId.slice(0, 6)}`,
    onHand: available,
    reserved: 0,
    available,
    availability: available === 0 ? ('OUT_OF_STOCK' as const) : ('IN_STOCK' as const),
  };
}

/** Writes an event to the outbox, as a service's transaction would. */
export async function enqueue(db: TestDb, aggregateId: string, available: number) {
  await enqueueEvent(db, InventoryStockChangedV1, stockChanged(aggregateId, available), {
    producer: 'test-service',
    aggregateId,
  });
}

/** A Kafka message carrying a valid envelope. */
export function messageFor(payload = stockChanged(), overrides: { eventId?: string } = {}) {
  const envelope = createEvent(InventoryStockChangedV1, payload, {
    producer: 'inventory-service',
    aggregateId: payload.variantId,
    correlationId: 'req-1',
    ...(overrides.eventId ? { eventId: overrides.eventId } : {}),
  });
  return {
    topic: InventoryStockChangedV1.topic,
    partition: 0,
    offset: '42',
    key: payload.variantId,
    value: JSON.stringify(envelope),
    headers: { eventType: envelope.eventType },
    envelope,
  };
}
