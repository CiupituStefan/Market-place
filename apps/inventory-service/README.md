# inventory-service

Default port: **4003**

## Responsibilities

- On-hand and reserved stock per variant.
- Reservations with expiry (atomic, row-locked; no overselling).
- Confirm reservation → stock decrement; release on payment failure / cancellation / expiry.
- Append-only stock movements ledger; low-stock alerts.

## Owned data

`inventory` database: `inventory`, `inventory_reservations`, `stock_movements`.

No other service may access this data store directly; other services go through this service's REST API or its events.

## Events

- Publishes: `InventoryReserved`, `InventoryReservationExpired`, `InventoryReleased`, `InventoryDecremented`
- Consumes: `OrderPaid` (confirm), `OrderCancelled` (release), `ProductCreated` (create stock rows)

Contracts live in [`packages/events`](../../packages/events).

## Development

```bash
pnpm --filter @market/inventory-service dev        # watch mode
pnpm --filter @market/inventory-service test       # unit + integration tests
pnpm --filter @market/inventory-service build && pnpm --filter @market/inventory-service start
```

Health probes: `GET /health/live`, `GET /health/ready`.

> Phase 1 status: skeleton (config, structured logging, health probes, tests). Domain logic arrives in its phase — see the root README roadmap.
