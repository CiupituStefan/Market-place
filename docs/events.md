# Events

Asynchronous communication between services uses Kafka (wired in Phase 10). Every event is
defined once, in `packages/events`, with a Zod schema and a version.

## Envelope

```json
{
  "eventId": "uuid",
  "eventType": "InventoryReserved",
  "eventVersion": 1,
  "occurredAt": "2026-10-05T10:00:00.000Z",
  "producer": "inventory-service",
  "aggregateId": "<order or entity id — also the Kafka message key>",
  "correlationId": "<x-request-id of the request that caused it>",
  "causationId": "<eventId that caused it, or null>",
  "payload": {}
}
```

- `createEvent()` validates the payload before anything is stored; `parseEvent()` validates on the
  consumer side and rejects unknown type/version pairs (dead-letter topic).
- Keyed by aggregate id: all events of one order/product/payment are ordered within a partition.
- Versioning: a breaking change adds `…V2` next to `…V1`; consumers support both during a migration.

## Reliable publishing: transactional outbox

Services never publish directly. They insert the envelope into their own `outbox_events` table in the
same transaction as the state change (`enqueueEvent` from `@market/db`). A relay (Phase 10) publishes
unpublished rows and stamps `published_at`. Consumers deduplicate by `eventId` (inbox table).

## Catalog

| Topic                     | Event                                                                 | Producer          | Main consumers                         |
| ------------------------- | --------------------------------------------------------------------- | ----------------- | -------------------------------------- |
| `catalog.product.events`  | ProductCreated, ProductUpdated                                        | product-service   | inventory (stock records), search      |
| `inventory.stock.events`  | InventoryReserved                                                     | inventory-service | order, admin                           |
|                           | InventoryReleased                                                     | inventory-service | order, admin                           |
|                           | InventoryReservationExpired                                           | inventory-service | order (cancel unpaid order)            |
|                           | InventoryDecremented                                                  | inventory-service | admin (alerts)                         |
|                           | InventoryStockChanged                                                 | inventory-service | product-service (availability)         |
| `orders.order.events`     | OrderCreated, OrderPaid, OrderCancelled, OrderShipped, OrderDelivered | order-service     | inventory, notification, review, admin |
| `payments.payment.events` | PaymentCreated, PaymentSucceeded, PaymentFailed, PaymentRefunded      | payment-service   | order, notification, admin             |
| `reviews.review.events`   | ReviewCreated                                                         | review-service    | product-service (ratings)              |
| `notifications.requests`  | NotificationRequested                                                 | any service       | notification-service                   |
