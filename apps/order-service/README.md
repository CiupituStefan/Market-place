# order-service

Default port: **4005**. Turns a cart into an order, holds stock while the shopper pays, and owns the
order lifecycle and fulfilment. Orders are snapshots: prices, names and addresses are copied at
checkout and never re-read from other services.

## Checkout (orchestrated saga)

```
POST /orders  (Idempotency-Key)
  1 claim key ─▶ 2 priced cart (cart-service) ─▶ 3 insert PENDING
  ─▶ 4 reserve stock (inventory-service) ─▶ 5 claim discount code (cart-service)
  ─▶ 6 PENDING_PAYMENT + OrderCreated (outbox), one transaction
```

- **Prices** come only from cart-service's priced cart. The request's `expectedTotal` is the total
  the shopper saw; any difference is `409 PRICE_CHANGED`, never a silent charge.
- **VAT** is recomputed for the destination country (`src/tax/vat.ts`, EU OSS standard rates) on
  the same VAT-inclusive total.
- **Compensation**: if step 4–6 fails, the reservation and discount claim are released and the
  order becomes `FAILED` (internal, invisible to the shopper). A crash mid-saga leaves a `PENDING`
  order that the sweeper compensates after `CHECKOUT_STALE_SECONDS`; a reservation made before the
  crash expires with its TTL. Every remote step is idempotent per order id.
- **Idempotency**: one order per `(user or visitor cart, key)`. A retry returns the same order
  (`200`, `Idempotent-Replayed: true`); the same key with a different body is
  `422 IDEMPOTENCY_KEY_REUSED`; a failed checkout releases its key.

## Lifecycle

```
PENDING ─▶ PENDING_PAYMENT ─▶ PAID ─▶ PROCESSING ─▶ SHIPPED ─▶ DELIVERED
   │              │             └──────────┴───────────▶ REFUNDED ◀──┘ (Phase 9)
   ▼              ▼
 FAILED       CANCELLED  (customer, store, or not paid within PAYMENT_WINDOW_SECONDS)
```

Every change goes through `assertTransition` (`src/orders/status.ts`), is written to
`order_status_history` with its actor, and emits its event through the outbox.

- **Payment** (internal, called by payment-service from verified Stripe webhooks in Phase 9):
  `payment-succeeded` confirms the reservation and marks the order `PAID` (idempotent per payment
  id; amount and currency must equal the order total). A payment that arrives after cancellation,
  or after the hold expired and the stock sold out, never oversells: the order is flagged
  `refund_required` and `OrderCancelled { refundRequired: true }` tells payment-service to refund.
  `payment-failed` only adds a timeline note — the shopper can retry until the window closes.
- **Races**: cancel and payment confirmation lock the order row (`SELECT … FOR UPDATE`) for the
  whole operation, including the idempotent calls to inventory/cart, so they serialize. Tested on
  real PostgreSQL; a mutation check confirmed the tests fail without the lock.
- **Sweeper** (every `SWEEP_INTERVAL_MS`, safe on several replicas): cancels unpaid orders after
  `PAYMENT_WINDOW_SECONDS` + `PAYMENT_GRACE_SECONDS` (stock and discount use given back) and
  compensates stuck checkouts.
- The cart is emptied by cart-service when it consumes `OrderPaid` (which carries the cart id).

## API

Customer (`/api/v1/orders`): `POST /` place (visitors via the `cse_cart` cookie, users via their
session), `GET /` my orders, `GET /:id`, `POST /:id/cancel` (unpaid only). Guests can view their
order from the browser that placed it (the `cse_cart` cookie, stored hashed on the order), and
receive an `accessToken` once (first response only, for links in emails) to send as
`x-order-token`. Every other viewer gets `404`.

Back office (`/api/v1/orders/manage`, STAFF/ADMIN): list (status filter, number/email search), get,
`POST /:id/status` → `PROCESSING`, `SHIPPED` (carrier + tracking number required), `DELIVERED`, or
`CANCELLED` (unpaid orders).

Internal (payment-service; not routable through the gateway): `GET /internal/orders/:id`,
`POST /internal/orders/:id/payment-succeeded {paymentId, amount, currency}`,
`POST /internal/orders/:id/payment-failed {message}`.

## Data

`orders` database: `orders` (totals, address snapshots, payment/fulfilment fields;
`CHECK total = subtotal − discount + shipping`), `order_items` (`CHECK line_total = unit_price ×
quantity`), `order_status_history`, `idempotency_keys`, `outbox_events`. Order numbers come from a
sequence: `CSE-100001`, …

## Events

Publishes `OrderCreated`, `OrderPaid`, `OrderCancelled`, `OrderShipped`, `OrderDelivered` through
the outbox relay. Payment status arrives synchronously from payment-service's verified webhook
handling (internal API), so it can answer `REFUND_REQUIRED` in the same request.

## Commands

```bash
pnpm --filter @market/order-service dev
pnpm --filter @market/order-service test                       # unit + PGlite integration
TEST_DATABASE_URL=postgresql://postgres@localhost:5432/postgres \
  pnpm --filter @market/order-service test                     # + race tests on real PostgreSQL
```
