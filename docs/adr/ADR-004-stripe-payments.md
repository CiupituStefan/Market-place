# ADR-004: Stripe PaymentIntents + Payment Element, webhook as the source of truth

- Status: Accepted
- Date: 2026-10-05

## Context

We sell to EU consumers: cards with Strong Customer Authentication (3-D Secure), wallets and local
methods. We must never store card data, never trust the browser for payment status, and process
webhooks idempotently (rules 5–7). The team should not operate PCI-scoped infrastructure.

## Decision

- **Stripe PaymentIntents** created server-side by payment-service for the order total read from
  order-service; one open intent per order (partial unique index), Stripe idempotency keys on every
  mutating call.
- **Payment Element** (Stripe-hosted iframe) in the browser: card data goes to Stripe only; we stay
  at PCI SAQ A. `automatic_payment_methods` lets Stripe offer cards, wallets and local methods
  without code changes.
- **The verified webhook is the only thing that marks an order paid.** Signature verification
  over the raw body with timestamp tolerance; an inbox table makes deliveries idempotent; failures
  return 5xx so Stripe retries.
- A **provider interface** with a **mock provider** for local development without keys. It signs
  its events with the real Stripe signing scheme, so the production verification path is always
  exercised. It is refused by configuration in production.

## Alternatives considered

- **Stripe Checkout (hosted page)**: least code, but the shopper leaves the store, and order and
  payment UX split across two sites. The Payment Element keeps checkout on-site with the same PCI
  scope.
- **Card fields posting to our API**: PCI SAQ D, explicitly excluded by the requirements.
- **Confirming payment from the browser's result**: forgeable and lost when the tab closes.
- **Charges API**: legacy; no SCA support.

## Consequences

- payment-service needs the raw request body (Nest `rawBody`) and the gateway must forward
  webhooks untouched (it does: machine route, streaming proxy).
- The shopper sees "confirming…" for a moment between paying and the webhook; the order page polls.
- Webhook delivery is at-least-once and unordered: every handler is idempotent and tolerant of
  events arriving for states that have already moved on.
