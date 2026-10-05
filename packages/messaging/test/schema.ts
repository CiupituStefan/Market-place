import { inboxEvents, outboxEvents } from '@market/db';
import { pgTable, text, uuid } from 'drizzle-orm/pg-core';

/** Test-only schema: the shared outbox/inbox plus a table handlers write to. */
export { inboxEvents, outboxEvents };

export const notes = pgTable('notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  text: text('text').notNull(),
});
