import { enqueueEvent as enqueue } from '@market/db';
import type { EventDefinition, PayloadOf } from '@market/events';
import { SERVICE_NAME } from '../config.js';
import type { Database } from '../db/database.js';

/** Writes an event to this service's outbox inside the caller's transaction. */
export async function enqueueEvent<D extends EventDefinition>(
  tx: Database,
  definition: D,
  payload: PayloadOf<D>,
  aggregateId: string,
): Promise<void> {
  await enqueue(tx, definition, payload, { producer: SERVICE_NAME, aggregateId });
}
