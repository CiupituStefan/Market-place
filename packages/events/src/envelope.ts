import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { EventDefinition, PayloadOf } from './define.js';

/**
 * Every Kafka message value is an envelope. Metadata is uniform across events so
 * that consumers, the DLQ tooling and tracing can work without knowing the payload.
 */
export const EnvelopeSchema = z.object({
  /** Unique per event. Consumers use it for idempotent processing (inbox table). */
  eventId: z.uuid(),
  eventType: z.string().min(1),
  eventVersion: z.int().positive(),
  occurredAt: z.iso.datetime(),
  /** Name of the producing service, e.g. "payment-service". */
  producer: z.string().min(1),
  /** ID of the entity the event is about; also used as the Kafka message key. */
  aggregateId: z.string().min(1),
  /** Request ID that started the chain (propagated from the HTTP x-request-id). */
  correlationId: z.string().min(1),
  /** eventId of the event that directly caused this one, if any. */
  causationId: z.uuid().nullable(),
  payload: z.unknown(),
});

export type EventEnvelope<D extends EventDefinition = EventDefinition> = Omit<
  z.infer<typeof EnvelopeSchema>,
  'eventType' | 'eventVersion' | 'payload'
> & {
  eventType: D['type'];
  eventVersion: D['version'];
  payload: PayloadOf<D>;
};

export interface EventMetadata {
  producer: string;
  aggregateId: string;
  correlationId: string;
  causationId?: string | null;
  /** Overridable for deterministic tests. */
  eventId?: string;
  occurredAt?: Date;
}

/**
 * Builds a validated envelope. Throws if the payload violates the contract, so a
 * malformed event can never be published.
 */
export function createEvent<D extends EventDefinition>(
  definition: D,
  payload: PayloadOf<D>,
  meta: EventMetadata,
): EventEnvelope<D> {
  const parsed = definition.payload.parse(payload) as PayloadOf<D>;
  return {
    eventId: meta.eventId ?? randomUUID(),
    eventType: definition.type,
    eventVersion: definition.version,
    occurredAt: (meta.occurredAt ?? new Date()).toISOString(),
    producer: meta.producer,
    aggregateId: meta.aggregateId,
    correlationId: meta.correlationId,
    causationId: meta.causationId ?? null,
    payload: parsed,
  };
}
