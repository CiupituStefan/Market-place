import {
  InventoryDecrementedV1,
  InventoryReleasedV1,
  InventoryReservationExpiredV1,
  InventoryReservedV1,
  InventoryStockChangedV1,
  NotificationRequestedV1,
  OrderCancelledV1,
  OrderCreatedV1,
  OrderDeliveredV1,
  OrderPaidV1,
  OrderShippedV1,
  PaymentCreatedV1,
  PaymentFailedV1,
  PaymentRefundedV1,
  PaymentSucceededV1,
  ProductCreatedV1,
  ProductUpdatedV1,
  ProductRatingChangedV1,
  ReviewCreatedV1,
} from './contracts/index.js';
import type { EventDefinition } from './define.js';
import { EnvelopeSchema, type EventEnvelope } from './envelope.js';

/**
 * Every event a consumer is able to decode. A new contract (or a new version of an
 * existing one) must be added here, otherwise consumers dead-letter it.
 */
export const ALL_EVENTS: readonly EventDefinition[] = [
  ProductCreatedV1,
  ProductUpdatedV1,
  InventoryReservedV1,
  InventoryReservationExpiredV1,
  InventoryReleasedV1,
  InventoryDecrementedV1,
  InventoryStockChangedV1,
  OrderCreatedV1,
  OrderPaidV1,
  OrderCancelledV1,
  OrderShippedV1,
  OrderDeliveredV1,
  PaymentCreatedV1,
  PaymentSucceededV1,
  PaymentFailedV1,
  PaymentRefundedV1,
  ReviewCreatedV1,
  ProductRatingChangedV1,
  NotificationRequestedV1,
];

const registry = new Map<string, EventDefinition>(
  ALL_EVENTS.map((definition) => [key(definition.type, definition.version), definition]),
);

function key(type: string, version: number): string {
  return `${type}@v${version}`;
}

export function findDefinition(type: string, version: number): EventDefinition | undefined {
  return registry.get(key(type, version));
}

export class UnknownEventError extends Error {
  constructor(type: string, version: number) {
    super(`Unknown event ${key(type, version)}`);
    this.name = 'UnknownEventError';
  }
}

/**
 * Parses a raw Kafka message value into a validated envelope. Throws on invalid
 * JSON, an invalid envelope, an unknown type/version or an invalid payload; the
 * consumer should route such messages to the dead-letter topic.
 */
export function parseEvent(raw: string | Buffer): EventEnvelope {
  const json: unknown = JSON.parse(typeof raw === 'string' ? raw : raw.toString('utf8'));
  const envelope = EnvelopeSchema.parse(json);
  const definition = findDefinition(envelope.eventType, envelope.eventVersion);
  if (!definition) throw new UnknownEventError(envelope.eventType, envelope.eventVersion);
  return { ...envelope, payload: definition.payload.parse(envelope.payload) };
}

/** Narrows a parsed envelope to a specific contract. */
export function isEvent<D extends EventDefinition>(
  envelope: EventEnvelope,
  definition: D,
): envelope is EventEnvelope<D> {
  return envelope.eventType === definition.type && envelope.eventVersion === definition.version;
}
