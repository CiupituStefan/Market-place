# payment-service

Default port: **4006**. Stripe PaymentIntents, the Stripe webhook and refunds. Stores Stripe ids,
amounts and statuses only — never card data. Full design: [docs/payments.md](../../docs/payments.md),
[ADR-004](../../docs/adr/ADR-004-stripe-payments.md).

## Responsibilities

- **Payment sessions**: `POST /payments/create-intent {orderId}` checks with order-service that the
  caller may see the order (owner, guest token or placing cart cookie) and that it is unpaid, then
  creates — or reuses — the PaymentIntent for the **order total**. One open intent per order
  (partial unique index); Stripe idempotency key `payment:<id>`.
- **Webhook** (`POST /payments/webhook`): Stripe-Signature verified over the raw body (timestamp
  tolerance), deduplicated by event id (`webhook_events`), then `payment_intent.*` and `refund.*`
  handling. Payment success is forwarded to order-service (`payment-succeeded`, idempotent); an
  order that cannot be fulfilled, or an amount mismatch, is refunded automatically.
- **Refunds** (STAFF/ADMIN): full or partial, locked against concurrent refunds, pending refunds
  reserved; settled synchronously or by `refund.updated`; order-service notified exactly once per
  refund (`order_notified_at`).
- Events through the outbox: `PaymentCreated`, `PaymentSucceeded`, `PaymentFailed`,
  `PaymentRefunded`.
- Consumes `OrderCancelled` (`payment-service.orders`): cancels the order's open PaymentIntent
  (unless the shopper's payment already went through, which is then refunded by the webhook path)
  and refunds captured payments when `refundRequired`.

## Providers

`PAYMENT_PROVIDER=stripe` (required in production) uses the Stripe SDK (API version pinned by the
SDK). `PAYMENT_PROVIDER=mock` is for local development without keys: intents live in memory and
`POST /payments/mock/confirm` produces events signed like Stripe's that go through the real
webhook path. The mock controller is not even registered with the Stripe provider.

## Data

`payments` database: `payments`, `refunds`, `webhook_events`, `outbox_events`.

## Commands

```bash
pnpm --filter @market/payment-service dev
pnpm --filter @market/payment-service test                     # PGlite suites (webhooks signed with Stripe's scheme)
TEST_DATABASE_URL=postgresql://postgres@localhost:5432/postgres \
  pnpm --filter @market/payment-service test                   # + race tests on real PostgreSQL
stripe listen --forward-to localhost:4000/api/v1/payments/webhook   # with real Stripe test keys
```
