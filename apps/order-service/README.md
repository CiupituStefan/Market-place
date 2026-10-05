# order-service

Default port: **4005**

## Responsibilities

- Checkout orchestration: priced cart snapshot → order → inventory reservation → payment intent.
- Order state machine: `PENDING_PAYMENT → PAID → FULFILLING → SHIPPED → DELIVERED`, plus `CANCELLED` / `REFUNDED`.
- Status history, shipping addresses, tracking information.
- Idempotent order creation (`Idempotency-Key` header).

## Owned data

`orders` database: `orders`, `order_items`, `order_status_history`, `shipping_addresses`.

No other service may access this data store directly; other services go through this service's REST API or its events.

## Events

- Publishes: `OrderCreated`, `OrderPaid`, `OrderCancelled`, `OrderShipped`, `OrderDelivered`, `NotificationRequested`
- Consumes: `PaymentSucceeded`, `PaymentFailed`, `PaymentRefunded`, `InventoryReservationExpired`

Contracts live in [`packages/events`](../../packages/events).

## Development

```bash
pnpm --filter @market/order-service dev        # watch mode
pnpm --filter @market/order-service test       # unit + integration tests
pnpm --filter @market/order-service build && pnpm --filter @market/order-service start
```

Health probes: `GET /health/live`, `GET /health/ready`.

> Phase 1 status: skeleton (config, structured logging, health probes, tests). Domain logic arrives in its phase — see the root README roadmap.
