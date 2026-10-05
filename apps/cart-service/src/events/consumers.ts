import { OrderPaidV1, Topics } from '@market/events';
import { on, type ConsumerDefinition } from '@market/messaging';
import { emptyCart } from '../cart/cart.service.js';
import { SERVICE_NAME } from '../config.js';
import type { Database } from '../db/database.js';

/** What cart-service reacts to on Kafka: a paid order empties the cart it came from. */
export function cartConsumers(): ConsumerDefinition<Database>[] {
  return [
    {
      name: `${SERVICE_NAME}.orders`,
      topics: [Topics.ORDER],
      handlers: [
        on(OrderPaidV1, async (event, tx: Database) => {
          if (event.payload.cartId) await emptyCart(tx, event.payload.cartId);
        }),
      ],
    },
  ];
}
