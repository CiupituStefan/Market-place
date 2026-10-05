import {
  NotificationRequestedV1,
  OrderCancelledV1,
  OrderCreatedV1,
  OrderDeliveredV1,
  OrderPaidV1,
  OrderShippedV1,
  PaymentFailedV1,
  PaymentRefundedV1,
  Topics,
} from '@market/events';
import { on, type ConsumerDefinition } from '@market/messaging';
import { SERVICE_NAME } from '../config.js';
import type { Database } from '../db/database.js';
import type { OrderNotifications } from '../orders/order-notifications.js';

/** Everything that results in an email. All handlers are exactly-once (database only). */
export function notificationConsumers(
  handlers: OrderNotifications,
): ConsumerDefinition<Database>[] {
  return [
    {
      name: `${SERVICE_NAME}.requests`,
      topics: [Topics.NOTIFICATION],
      handlers: [
        on(NotificationRequestedV1, (event, tx: Database) =>
          handlers.onNotificationRequested(tx, event),
        ),
      ],
    },
    {
      name: `${SERVICE_NAME}.orders`,
      topics: [Topics.ORDER],
      handlers: [
        on(OrderCreatedV1, (event, tx: Database) => handlers.onOrderCreated(tx, event)),
        on(OrderPaidV1, (event, tx: Database) => handlers.onOrderPaid(tx, event)),
        on(OrderShippedV1, (event, tx: Database) => handlers.onOrderShipped(tx, event)),
        on(OrderDeliveredV1, (event, tx: Database) => handlers.onOrderDelivered(tx, event)),
        on(OrderCancelledV1, (event, tx: Database) => handlers.onOrderCancelled(tx, event)),
      ],
    },
    {
      name: `${SERVICE_NAME}.payments`,
      topics: [Topics.PAYMENT],
      handlers: [
        on(PaymentFailedV1, (event, tx: Database) => handlers.onPaymentFailed(tx, event)),
        on(PaymentRefundedV1, (event, tx: Database) => handlers.onPaymentRefunded(tx, event)),
      ],
    },
  ];
}
