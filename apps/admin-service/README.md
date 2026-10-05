# admin-service

Default port: **4009**

## Responsibilities

- Analytics for the back office (`/admin`, STAFF and ADMIN only): revenue, orders, average order
  value, refunds, discounts, best sellers and per-customer lifetime figures.
- A **read model built only from Kafka events**: it never reads another service's database and
  never calls them. Every other back-office screen talks to the service that owns the data
  directly through the gateway (`/orders/manage`, `/inventory`, `/products/manage`, ...), so there
  is no second copy of business rules here. See
  [ADR-016](../../docs/adr/ADR-016-admin-dashboard.md).

## Owned data

`admin` database (projections only):

| Table           | Built from                              | Purpose                                        |
| --------------- | --------------------------------------- | ---------------------------------------------- |
| `sales_orders`  | OrderCreated, OrderPaid, OrderCancelled | totals, discount, status, paid/cancelled times |
| `sales_lines`   | OrderCreated                            | units and line revenue for best sellers        |
| `sales_refunds` | PaymentRefunded                         | refunds counted on the day they settle         |
| `inbox_events`  | —                                       | consumed event ids (exactly-once handlers)     |

## Definitions

- **Gross sales**: totals (VAT and shipping included, after discounts) of orders paid in the
  range. A payment that arrives after cancellation still counts; its refund offsets it.
- **Net sales** = gross sales − refunds settled in the range.
- **AOV** = gross sales / paid orders.
- **Best sellers**: units of paid, not cancelled orders; revenue is line revenue before
  order-level discounts.
- Days are **store-local** (`ANALYTICS_TIME_ZONE`, Europe/Bucharest): PostgreSQL converts range
  bounds, so daylight-saving changes are handled.

## API (through the gateway, `/api/v1`, STAFF/ADMIN)

| Method & path                                     | Purpose                                                     |
| ------------------------------------------------- | ----------------------------------------------------------- |
| `GET /admin/analytics/summary?from&to`            | figures for the range and the same-length period before it  |
| `GET /admin/analytics/daily?from&to`              | per-day gross sales, refunds, paid orders (empty days kept) |
| `GET /admin/analytics/best-sellers?from&to&limit` | top variants by units                                       |
| `GET /admin/analytics/customers/:userId`          | lifetime orders, spend, refunds, first/last order           |

`from`/`to` are inclusive `YYYY-MM-DD`; default is the last 30 days; at most one year.

## Events

- Publishes: —
- Consumes: `OrderCreated`, `OrderPaid`, `OrderCancelled` (`admin-service.orders`),
  `PaymentRefunded` (`admin-service.payments`).

## Development

```bash
pnpm --filter @market/admin-service dev
pnpm --filter @market/admin-service test
pnpm --filter @market/admin-service db:generate
```

Health probes: `GET /health/live`, `GET /health/ready`.
