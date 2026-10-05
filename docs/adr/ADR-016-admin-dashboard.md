# ADR-016: Admin dashboard: owning services for operations, an event-built read model for analytics

- Status: Accepted
- Date: 2026-10-05

## Context

The back office manages products, inventory, orders, refunds, customers, reviews, discounts and
emails, and reports revenue, AOV and best sellers. That data lives in seven services with their
own databases (rule 9). Reports aggregate across orders and payments; operations must respect
each service's rules (the order state machine, stock never below reservations, refund limits).

## Decision

1. **Operations go to the owning service.** The `/admin` pages call each service's back-office
   endpoints through the gateway (`/orders/manage`, `/payments/manage`, `/inventory`,
   `/products/manage`, `/users`, `/discounts`, `/reviews/manage`, `/notifications/manage`). Each
   service enforces STAFF/ADMIN itself (and the gateway enforces it for `/admin/*`); business rules
   stay in one place. No admin "BFF" re-implements them.
2. **Analytics are a read model in admin-service**, projected from `OrderCreated`, `OrderPaid`,
   `OrderCancelled` and `PaymentRefunded` with exactly-once inbox handlers. Aggregations run in SQL
   over these tables; days are store-local and computed by PostgreSQL.
3. **Small additions where a view needed them**: `GET /users/:id`, a `userId` filter on
   `/orders/manage` and `/reviews/manage`, image ids in catalog responses, shared back-office
   schemas in `@market/types` (the web validates every response).
4. **The UI is a client-rendered section** of the Next.js app (`/admin`, no indexing), gated in
   the browser for UX and on the server for security. Charts are hand-written SVG (one series,
   one axis, hover/focus tooltips and a table view); no chart library for two chart types.

## Alternatives considered

- **admin-service as a BFF for every screen** — doubles every endpoint and its validation, and
  invites business rules to drift between two places.
- **Analytics by calling order-service and payment-service** — reporting load on transactional
  databases, N+1 calls for best sellers, and an availability coupling for a dashboard.
- **Pre-aggregated daily tables** (`analytics_daily`) — premature at this volume; the queries use
  indexes on `paid_at`/`refunded_at`. Add materialised rollups if they ever get slow.
- **A charting library** (Recharts, ECharts) — 100+ kB for a column chart and a ranked bar list.

## Consequences

- Analytics are eventually consistent (seconds behind). A fresh deployment rebuilds them by
  replaying the topics from the earliest offset.
- Revenue is reported in the catalog currency (`ANALYTICS_CURRENCY`); orders in another currency
  are kept but excluded until multi-currency reporting is needed.
- An audit log of admin actions is not built yet: services record the actor where it matters
  (order history, stock movements, refunds). A central audit trail is part of Phase 20.
