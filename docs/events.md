# Events

Asynchronous communication between services uses Kafka. Every event is
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

## Reliable publishing: transactional outbox + relay

Services never publish directly. They insert the envelope into their own `outbox_events` table in the
same transaction as the state change (`enqueueEvent` from `@market/db`): the event exists if and only
if the change committed. The **outbox relay** (`@market/messaging`) then publishes it:

- rows go out in `sequence` order (an identity column: rows written in one transaction share
  `created_at`), in batches; a failed batch is retried as a whole before anything after it, so
  events of one aggregate reach their partition in commit order;
- every replica runs the relay loop, but a transaction-scoped advisory lock lets exactly one
  publish at a time (concurrent batches could reorder events);
- the producer is idempotent with `acks=all`;
- published rows are deleted after `OUTBOX_RETENTION_DAYS` (7); failed attempts are counted on the
  row (`attempts`) for alerting.

Delivery is **at least once**: a crash between Kafka's ack and marking the rows published re-sends
them. Consumers are idempotent.

## Consuming: inbox, retries, dead-letter topics

Each consumer is a Kafka consumer group named `<service>.<source>` (e.g. `payment-service.orders`).
Offsets are committed manually, after a message is handled, one message at a time (per-partition
order is kept; a crash re-delivers rather than loses).

| Situation                                                                 | What happens                                                                                                               |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Invalid JSON / envelope / payload, unknown version                        | sent to `<topic>.dlq` immediately (`dlq-reason: invalid-event`)                                                            |
| Valid event this consumer has no handler for                              | ignored (topics carry several event types)                                                                                 |
| Already in `inbox_events` for this consumer                               | acknowledged without effect (duplicate delivery)                                                                           |
| Handler fails                                                             | retried in place with exponential backoff (the partition waits, order is kept)                                             |
| Still failing after `CONSUMER_MAX_ATTEMPTS` (5), or `PermanentEventError` | sent to `<topic>.dlq` with `dlq-error`, attempts and the original topic/partition/offset in headers; consumption continues |

Two handler kinds:

- `on(Event, handler)` — database-only effects. The inbox row and the handler's writes commit in one
  transaction: **exactly-once** effects even though Kafka delivers at least once.
- `onIdempotent(Event, handler)` — effects outside the database (Stripe, other services) or handlers
  that manage their own transactions. Runs outside the inbox transaction; must be idempotent itself.

Dead letters keep the original value and key, so once the cause is fixed they can be re-published
to the source topic unchanged (their `eventId` was never recorded, so they are processed normally).

## Consumers today

| Consumer group                  | Events                                                                | Effect                                                                             | Kind                      |
| ------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------- |
| `product-service.inventory`     | InventoryStockChanged                                                 | variant availability + product roll-up (PREORDER kept at zero)                     | exactly once              |
| `inventory-service.catalog`     | ProductCreated, ProductUpdated                                        | stock record for every variant (at zero), SKU kept in sync                         | exactly once              |
| `cart-service.orders`           | OrderPaid                                                             | empties the cart the order came from                                               | exactly once              |
| `payment-service.orders`        | OrderCancelled                                                        | cancels the open PaymentIntent; refunds if `refundRequired`                        | idempotent                |
| `review-service.orders`         | OrderCreated, OrderPaid, OrderCancelled                               | verified-purchase projection (products resolved via product-service)               | idempotent / exactly once |
| `product-service.reviews`       | ProductRatingChanged                                                  | product rating average and count                                                   | exactly once              |
| `notification-service.requests` | NotificationRequested                                                 | queues the requested email (auth links)                                            | exactly once              |
| `notification-service.orders`   | OrderCreated, OrderPaid, OrderShipped, OrderDelivered, OrderCancelled | order contact projection; confirmation, shipping, delivery and cancellation emails | exactly once              |
| `notification-service.payments` | PaymentFailed, PaymentRefunded                                        | payment-failed (once per order) and refund emails                                  | exactly once              |
| `admin-service.orders`          | OrderCreated, OrderPaid, OrderCancelled                               | sales read model (revenue, AOV, best sellers)                                      | exactly once              |
| `admin-service.payments`        | PaymentRefunded                                                       | refunds in the sales read model                                                    | exactly once              |

Checkout itself (cart → order → reservation → discount → payment) stays synchronous and orchestrated
([ADR-014](adr/ADR-014-checkout-saga.md)): the shopper needs an answer now. Events carry the
consequences that may happen a moment later.

## Operations

- Topics: one per bounded context (below), plus `<topic>.dlq`. `KAFKA_TOPIC_PARTITIONS` (6) and
  `KAFKA_REPLICATION_FACTOR` (1 locally, 3 on MSK). Locally each service creates the topics it uses
  at startup (`KAFKA_CREATE_TOPICS`). On MSK every service has its own SCRAM user, limited by ACLs
  to the topics it publishes and consumes and to consumer groups named `<service>.*`; topics and
  ACLs come from one list, [`packages/events/src/access.ts`](../packages/events/src/access.ts)
  ([terraform README](../infrastructure/terraform/README.md#kafka-topics-and-acls)). A service
  that uses a topic or group outside its access refuses to start, in every environment.
- A new topic, or a service consuming another one: change `access.ts`, run
  `pnpm --filter @market/events acls` (regenerates `infrastructure/kafka/`; CI fails if
  forgotten), and apply the platform stack **before** deploying the code that needs it.
- Without `KAFKA_BROKERS` (local development) messaging is off and events wait in the outbox;
  production refuses to start without it.
- Tracing: the request's W3C trace context is stored with the outbox row and sent as the
  `traceparent` header; consumers continue the trace (producer and consumer spans), so a request
  and the events it caused are one trace ([observability](observability.md)).
- MSK: `KAFKA_SSL=true`, SASL/SCRAM via `KAFKA_SASL_*` (generated by Terraform into the Secrets
  Manager entry `AmazonMSK_cse-<env>_<service>`, synced into the pod by External Secrets).

## Catalog

| Topic                     | Event                                                                 | Producer          | Main consumers                       |
| ------------------------- | --------------------------------------------------------------------- | ----------------- | ------------------------------------ |
| `catalog.product.events`  | ProductCreated, ProductUpdated                                        | product-service   | inventory (stock records), search    |
| `inventory.stock.events`  | InventoryReserved                                                     | inventory-service | order, admin                         |
|                           | InventoryReleased                                                     | inventory-service | order, admin                         |
|                           | InventoryReservationExpired                                           | inventory-service | order (cancel unpaid order)          |
|                           | InventoryDecremented                                                  | inventory-service | admin (alerts)                       |
|                           | InventoryStockChanged                                                 | inventory-service | product-service (availability)       |
| `orders.order.events`     | OrderCreated, OrderPaid, OrderCancelled, OrderShipped, OrderDelivered | order-service     | notification, review, payment, admin |
| `payments.payment.events` | PaymentCreated, PaymentSucceeded, PaymentFailed, PaymentRefunded      | payment-service   | order, notification, admin           |
| `reviews.review.events`   | ReviewCreated, ProductRatingChanged                                   | review-service    | product-service (ratings)            |
| `notifications.requests`  | NotificationRequested                                                 | any service       | notification-service                 |

## Order events (Phase 8)

- `OrderCreated` is written when an order reaches `PENDING_PAYMENT` (stock held, discount claimed);
  lines carry `kind` (`variant` | `configuration`), so configurator builds have no `variantId`.
- `OrderPaid.reservationId` is null for orders that only contain built-to-order items.
- `OrderCancelled.reason` is one of `CUSTOMER_REQUEST`, `PAYMENT_TIMEOUT`, `PAYMENT_FAILED`,
  `OUT_OF_STOCK`, `ADMIN`; `refundRequired: true` tells payment-service a captured payment must be
  refunded (late payment after cancellation, or stock gone after the hold expired).
- `OrderPaid.cartId` (added in Phase 10, still before first publication) lets cart-service empty
  the cart without a synchronous call.
- The V1 order contracts were reshaped before anything was ever published; from now on, changes
  follow the versioning rule above.
