import { OrderCancelledV1, Topics } from '@market/events';
import { onIdempotent, type ConsumerDefinition } from '@market/messaging';
import { SERVICE_NAME } from '../config.js';
import type { Database } from '../db/database.js';
import type { PaymentService } from '../payments/payment.service.js';

/** What payment-service reacts to on Kafka. */
export function paymentConsumers(payments: PaymentService): ConsumerDefinition<Database>[] {
  return [
    {
      name: `${SERVICE_NAME}.orders`,
      topics: [Topics.ORDER],
      handlers: [
        // Stripe calls and its own transactions: idempotent, outside the inbox transaction.
        onIdempotent(OrderCancelledV1, (event) =>
          payments.onOrderCancelled(event.payload.orderId, event.payload.refundRequired),
        ),
      ],
    },
  ];
}
