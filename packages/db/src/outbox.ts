import { createEvent, type EventDefinition, type PayloadOf } from '@market/events';
import { getRequestContext } from '@market/logger';
import { sql } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import type { Database } from './postgres.js';

/**
 * Transactional outbox. Every service that publishes events re-exports this table
 * from its own schema, so each service's database has its own outbox. A relay
 * (Phase 10) publishes rows to Kafka and stamps `published_at`.
 */
export const outboxEvents = pgTable(
  'outbox_events',
  {
    /** Equals the envelope's eventId. */
    id: uuid('id').primaryKey(),
    topic: text('topic').notNull(),
    /** Kafka message key (aggregate id) for per-entity ordering. */
    messageKey: text('message_key').notNull(),
    envelope: jsonb('envelope').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    attempts: integer('attempts').notNull().default(0),
  },
  (table) => [
    index('outbox_events_unpublished_idx')
      .on(table.createdAt)
      .where(sql`${table.publishedAt} IS NULL`),
  ],
);

/**
 * Validates and stores an event using the caller's transaction: the event exists
 * if and only if the state change committed (no dual-write problem).
 */
export async function enqueueEvent<D extends EventDefinition>(
  tx: Database,
  definition: D,
  payload: PayloadOf<D>,
  meta: { producer: string; aggregateId: string },
): Promise<string> {
  const envelope = createEvent(definition, payload, {
    producer: meta.producer,
    aggregateId: meta.aggregateId,
    correlationId: getRequestContext()?.requestId ?? 'system',
  });
  await tx.insert(outboxEvents).values({
    id: envelope.eventId,
    topic: definition.topic,
    messageKey: meta.aggregateId,
    envelope,
  });
  return envelope.eventId;
}
