# ADR-014: Orchestrated checkout saga in order-service, with persisted state and idempotent steps

- Status: Accepted
- Date: 2026-10-05

## Context

Placing an order touches three services that own their data: cart-service (prices, discount
codes), inventory-service (stock) and order-service (the order). There is no distributed
transaction across their databases (rule 9). Shoppers double-click, networks retry, processes
crash between steps, and payments can arrive late or twice (rule 7). Overselling is not allowed
(rule 8) and the frontend never decides a price (rule 4).

## Decision

1. **Orchestration, not choreography.** order-service drives checkout synchronously over the
   internal REST APIs and answers the shopper with the outcome (order placed, out of stock, price
   changed, code expired). Kafka events (Phase 10) announce what happened; they do not drive this
   request.
2. **State is persisted before each remote step.** The order is inserted as `PENDING` first, so a
   crash always leaves something to compensate. Steps: reserve stock → claim discount →
   `PENDING_PAYMENT` + `OrderCreated` (outbox) in one transaction.
3. **Every remote step is idempotent per order id** (reservation unique per order, redemption PK
   per order, releases are no-ops when repeated), so retries and compensations are safe.
4. **Compensation**: a failed step releases what was taken and marks the order `FAILED`; the sweeper
   compensates `PENDING` orders older than `CHECKOUT_STALE_SECONDS`.
5. **Idempotency-Key** on `POST /orders`, scoped per user or visitor cart, stored with a request
   hash; failures release the key.
6. **Payment vs. cancellation** are serialized by a row lock on the order held for the whole
   operation, including the idempotent remote calls. Late or duplicate payments never oversell: the
   order is flagged for refund instead.

## Alternatives considered

- **Choreography over Kafka** (OrderCreated → inventory reserves → …): no single place that knows
  whether checkout succeeded, the shopper would have to poll, and every failure path becomes a
  chain of compensating events. Better for long-running, non-interactive processes.
- **Reserve before inserting the order**: no orphan `FAILED` rows, but a crash after reserving and
  claiming the code would leave a discount use with no order to release it.
- **Optimistic concurrency (version column) for payment vs. cancel**: avoids holding a lock across
  HTTP calls, but the loser has already released stock or confirmed it in another service, which
  then needs its own compensation.

## Consequences

- An order-service row lock can be held for up to the remote timeouts (5 s per call). At our scale
  this is fine; the pool size bounds concurrent checkouts per replica.
- `FAILED` orders accumulate for audit; customers never see them (back office does).
- A reservation created just before a crash is not released explicitly; it expires with its TTL
  (the payment window). The discount claim is released by the sweeper.
- payment-service (Phase 9) must call `payment-succeeded` / `payment-failed` from verified
  webhooks, cancel the PaymentIntent when an order is cancelled, and refund orders flagged
  `refundRequired`.
