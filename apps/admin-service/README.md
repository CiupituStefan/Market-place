# admin-service

Default port: **4009**

## Responsibilities

- Back-office API used by `/admin`: STAFF/ADMIN only.
- Composes admin views by calling owning services over REST (it never reads their databases).
- Analytics read model (revenue, orders, AOV, best sellers, inventory alerts) built from Kafka events.
- Audit log of admin actions.

## Owned data

`admin` database: `analytics_daily`, `product_sales`, `inventory_alerts`, `audit_log` (projections only).

No other service may access this data store directly; other services go through this service's REST API or its events.

## Events

- Publishes: —
- Consumes: `OrderPaid`, `OrderCancelled`, `PaymentRefunded`, `InventoryDecremented`, `ProductCreated`

Contracts live in [`packages/events`](../../packages/events).

## Development

```bash
pnpm --filter @market/admin-service dev        # watch mode
pnpm --filter @market/admin-service test       # unit + integration tests
pnpm --filter @market/admin-service build && pnpm --filter @market/admin-service start
```

Health probes: `GET /health/live`, `GET /health/ready`.

> Phase 1 status: skeleton (config, structured logging, health probes, tests). Domain logic arrives in its phase — see the root README roadmap.
