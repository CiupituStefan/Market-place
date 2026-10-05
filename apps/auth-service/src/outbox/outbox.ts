import { createEvent, type EventDefinition, type PayloadOf } from '@market/events';
import { getRequestContext } from '@market/logger';
import type { Database } from '../db/database.js';
import { outboxEvents } from '../db/schema.js';
import { SERVICE_NAME } from '../config.js';

/**
 * Stores a validated event in the outbox using the caller's transaction, so the
 * event exists if and only if the state change committed.
 */
export async function enqueueEvent<D extends EventDefinition>(
  tx: Database,
  definition: D,
  payload: PayloadOf<D>,
  aggregateId: string,
): Promise<void> {
  const envelope = createEvent(definition, payload, {
    producer: SERVICE_NAME,
    aggregateId,
    correlationId: getRequestContext()?.requestId ?? 'system',
  });
  await tx.insert(outboxEvents).values({
    id: envelope.eventId,
    topic: definition.topic,
    messageKey: aggregateId,
    envelope,
  });
}
