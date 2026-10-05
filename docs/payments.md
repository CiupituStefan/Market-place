# Payments

Card payments use **Stripe PaymentIntents** with the **Payment Element**. The rules this design
enforces:

1. Card number, CVV and expiry never touch our servers, logs or databases. They are typed into
   Stripe's iframe and sent straight to Stripe (PCI scope: SAQ A).
2. The amount is the order total from order-service. The browser sends only an order id.
3. **Stripe's webhook is the only source of truth for payment status.** A "success" in the browser
   (`confirmPayment` result or the return redirect) only shows "confirming…"; the order becomes
   `PAID` when the verified `payment_intent.succeeded` webhook has been processed.
4. Webhooks are idempotent: duplicate deliveries are acknowledged without effect.

## Flow

```
browser            web (Next.js)          api-gateway     payment-service          order-service      Stripe
  │ place order ─────────────────────────────────────────────────────────────────▶ PENDING_PAYMENT
  │ open order page ─▶ POST /payments/create-intent {orderId} ─▶ access check ───▶ (owner? unpaid?)
  │                                                       create PaymentIntent(amount = order.total) ──▶
  │◀──────────────── clientSecret, publishableKey ────────────────────────────────
  │ Payment Element (iframe) ── card details ──────────────────────────────────────────────────────▶
  │ confirmPayment ─────────────────────────────────────────────────────────────────────────────────▶
  │ "confirming…" (polls the order)                                                                 │
  │                                       ◀── POST /payments/webhook (Stripe-Signature) ────────────┘
  │                                  verify HMAC + timestamp, dedupe event id
  │                                  payment SUCCEEDED ─▶ payment-succeeded ─▶ confirm stock, PAID
  │◀──────────────── order page shows Paid ───────────────────────────────────────
```

## Webhook handling

`POST /api/v1/payments/webhook` (routed by the gateway as a machine endpoint: no CSRF check, no
per-IP rate limit, raw body forwarded byte-for-byte).

1. Verify `Stripe-Signature` over the **raw bytes** with the endpoint secret
   (`STRIPE_WEBHOOK_SECRET`) and a 5-minute timestamp tolerance (replay protection). Failure → `400`.
2. Skip events already in `webhook_events` (inbox) → `200 {duplicate: true}`.
3. Handle the event; every step is idempotent (conditional status updates, idempotent
   order-service calls, refunds keyed per payment).
4. Record the event id. If anything failed, answer `5xx`: Stripe retries for up to three days.

| Event                                     | Effect                                                                               |
| ----------------------------------------- | ------------------------------------------------------------------------------------ |
| `payment_intent.succeeded`                | payment `SUCCEEDED`, `PaymentSucceeded`; order-service confirms stock and marks PAID |
| `payment_intent.payment_failed`           | last error recorded, `PaymentFailed`; order timeline note (the shopper may retry)    |
| `payment_intent.processing` / `.canceled` | payment `PROCESSING` / `CANCELED`                                                    |
| `refund.created` / `.updated` / `.failed` | refund settled; payment `PARTIALLY_REFUNDED` / `REFUNDED`; order told once           |

If the amount received differs from the payment amount, or order-service answers
`REFUND_REQUIRED` (paid after cancellation, or stock gone after the hold expired), the payment is
**refunded automatically** — an order is never shipped without stock or without full payment.

## Refunds

Back office: `POST /api/v1/payments/manage/:paymentId/refunds {amount?, reason}` (STAFF/ADMIN).
Partial refunds are allowed; the payment row is locked and pending refunds are reserved, so the
total can never exceed what was paid (also a `CHECK` constraint; race-tested on PostgreSQL). Each
refund carries a Stripe idempotency key. A full refund moves the order to `REFUNDED`. Refunds do
not restock automatically: returned goods are inspected and received in the back office.

## Data (`payments` database)

`payments` (one per PaymentIntent; at most one open per order), `refunds`, `webhook_events`,
`outbox_events`. Only Stripe ids, amounts, statuses and error messages are stored.

## Configuration

| Variable                    | Notes                                                                 |
| --------------------------- | --------------------------------------------------------------------- |
| `PAYMENT_PROVIDER`          | `stripe` (required in production) or `mock` (local development)       |
| `STRIPE_SECRET_KEY`         | `sk_test_…` / `sk_live_…` (live required in production); secret store |
| `STRIPE_PUBLISHABLE_KEY`    | `pk_…`, returned to the browser with the payment session              |
| `STRIPE_WEBHOOK_SECRET`     | `whsec_…` of the webhook endpoint; secret store                       |
| `WEBHOOK_TOLERANCE_SECONDS` | signature age limit (default 300)                                     |

Keys never live in Git: locally in an untracked `.env`, in Kubernetes from AWS Secrets Manager
(Phase 15/16).

## Local development

- **Without Stripe keys**: `PAYMENT_PROVIDER=mock`. The order page shows a clearly labelled test
  form ("Pay (test)" / "Simulate decline"). The mock produces events signed exactly like Stripe's
  and feeds them through the real verification and webhook handling.
- **With Stripe test keys**: set the three Stripe variables, then forward webhooks with the Stripe
  CLI: `stripe listen --forward-to localhost:4000/api/v1/payments/webhook` (it prints the
  `whsec_…` to use). Test cards: `4242 4242 4242 4242` (success), `4000 0025 0000 3155`
  (3-D Secure), `4000 0000 0000 9995` (declined).

## Known follow-ups

- Cancelling an order cancels its open PaymentIntent (payment-service consumes `OrderCancelled`).
  If the shopper paid in the same moment, the payment is refunded automatically when its webhook
  arrives.
- The Content-Security-Policy (Phase 20) must allow `js.stripe.com` (script, frame) and
  `api.stripe.com` (connect), plus `hooks.stripe.com` frames for 3-D Secure.
