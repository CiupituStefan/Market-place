# payment-service

Default port: **4006**

## Responsibilities

- Creates Stripe PaymentIntents for orders (amount always taken from order-service, never from the client).
- Stripe webhook endpoint: signature verification, idempotent processing keyed by Stripe event ID.
- Full and partial refunds.
- **Never** stores card number, CVC or expiry — only Stripe IDs, status, amount, currency, timestamps.

## Owned data

`payments` database: `payments`, `refunds`, `payment_events` (processed Stripe events, unique on `stripe_event_id`).

No other service may access this data store directly; other services go through this service's REST API or its events.

## Events

- Publishes: `PaymentCreated`, `PaymentSucceeded`, `PaymentFailed`, `PaymentRefunded`
- Consumes: `OrderCancelled` (cancel open intent)

Contracts live in [`packages/events`](../../packages/events).

## Development

```bash
pnpm --filter @market/payment-service dev        # watch mode
pnpm --filter @market/payment-service test       # unit + integration tests
pnpm --filter @market/payment-service build && pnpm --filter @market/payment-service start
```

Health probes: `GET /health/live`, `GET /health/ready`.

> Phase 1 status: skeleton (config, structured logging, health probes, tests). Domain logic arrives in its phase — see the root README roadmap.
