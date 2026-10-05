import { OrderCancelledV1, OrderCreatedV1, OrderPaidV1, Topics } from '@market/events';
import { on, onIdempotent, type ConsumerDefinition } from '@market/messaging';
import { SERVICE_NAME } from '../config.js';
import type { Database } from '../db/database.js';
import type { PurchaseProjection } from '../purchases/purchases.js';

/** What review-service reacts to on Kafka: the verified-purchase projection. */
export function reviewConsumers(projection: PurchaseProjection): ConsumerDefinition<Database>[] {
  return [
    {
      name: `${SERVICE_NAME}.orders`,
      topics: [Topics.ORDER],
      handlers: [
        // Resolves variants through product-service: outside the inbox transaction, idempotent.
        onIdempotent(OrderCreatedV1, (event) => projection.onOrderCreated(event)),
        on(OrderPaidV1, (event, tx: Database) => projection.onOrderPaid(tx, event)),
        on(OrderCancelledV1, (event, tx: Database) => projection.onOrderCancelled(tx, event)),
      ],
    },
  ];
}
