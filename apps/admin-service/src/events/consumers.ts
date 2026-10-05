import {
  OrderCancelledV1,
  OrderCreatedV1,
  OrderPaidV1,
  PaymentRefundedV1,
  Topics,
} from '@market/events';
import { on, type ConsumerDefinition } from '@market/messaging';
import type { SalesProjection } from '../analytics/projection.js';
import { SERVICE_NAME } from '../config.js';
import type { Database } from '../db/database.js';

/** The sales read model's inputs. All handlers are exactly-once (database only). */
export function adminConsumers(projection: SalesProjection): ConsumerDefinition<Database>[] {
  return [
    {
      name: `${SERVICE_NAME}.orders`,
      topics: [Topics.ORDER],
      handlers: [
        on(OrderCreatedV1, (event, tx: Database) => projection.onOrderCreated(tx, event)),
        on(OrderPaidV1, (event, tx: Database) => projection.onOrderPaid(tx, event)),
        on(OrderCancelledV1, (event, tx: Database) => projection.onOrderCancelled(tx, event)),
      ],
    },
    {
      name: `${SERVICE_NAME}.payments`,
      topics: [Topics.PAYMENT],
      handlers: [
        on(PaymentRefundedV1, (event, tx: Database) => projection.onPaymentRefunded(tx, event)),
      ],
    },
  ];
}
