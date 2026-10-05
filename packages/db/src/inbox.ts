import { index, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Consumer inbox (idempotent consumption). A consuming service re-exports this
 * table from its schema; recording an event id in the same transaction as the
 * handler's own writes makes processing effectively exactly-once, even though
 * Kafka delivers at least once.
 */
export const inboxEvents = pgTable(
  'inbox_events',
  {
    /** Consumer name (one service may run several consumers). */
    consumer: text('consumer').notNull(),
    eventId: uuid('event_id').notNull(),
    eventType: text('event_type').notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.consumer, table.eventId] }),
    index('inbox_events_processed_idx').on(table.processedAt),
  ],
);
