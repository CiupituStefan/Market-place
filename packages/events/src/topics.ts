/**
 * Kafka topics, one per owning bounded context. Every event published to a topic
 * is keyed by its aggregate ID, so all events for one product/order/payment land
 * in the same partition and are consumed in order.
 *
 * The event *version* lives in the envelope, not in the topic name: consumers can
 * handle several versions side by side during a migration.
 */
export const Topics = {
  PRODUCT: 'catalog.product.events',
  INVENTORY: 'inventory.stock.events',
  ORDER: 'orders.order.events',
  PAYMENT: 'payments.payment.events',
  REVIEW: 'reviews.review.events',
  NOTIFICATION: 'notifications.requests',
} as const;
export type Topic = (typeof Topics)[keyof typeof Topics];

/** Dead-letter topic for a source topic: events that repeatedly failed processing. */
export function deadLetterTopic(topic: Topic): string {
  return `${topic}.dlq`;
}
