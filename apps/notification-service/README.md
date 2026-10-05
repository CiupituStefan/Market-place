# notification-service

Default port: **4007**

## Responsibilities

- Renders and sends transactional emails (order confirmation, shipping, password reset, ...).
- Deduplicates by notification key so a redelivered event never sends two emails.
- Notification preferences and newsletter subscriptions; delivery logs.

## Owned data

`notifications` database: `notification_preferences`, `notification_logs`, `newsletter_subscribers`.

No other service may access this data store directly; other services go through this service's REST API or its events.

## Events

- Publishes: —
- Consumes: `NotificationRequested`, `OrderPaid`, `OrderShipped`, `OrderDelivered`, `PaymentRefunded`

Contracts live in [`packages/events`](../../packages/events).

## Development

```bash
pnpm --filter @market/notification-service dev        # watch mode
pnpm --filter @market/notification-service test       # unit + integration tests
pnpm --filter @market/notification-service build && pnpm --filter @market/notification-service start
```

Health probes: `GET /health/live`, `GET /health/ready`.

> Phase 1 status: skeleton (config, structured logging, health probes, tests). Domain logic arrives in its phase — see the root README roadmap.
