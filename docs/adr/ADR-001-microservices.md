# ADR-001: Microservices with database-per-service

- Status: Accepted
- Date: 2026-10-05

## Context

We are building an online store for mechanical keyboards and accessories. Requirements that shape
the architecture:

- Correctness under concurrency in a few critical flows: stock must never be oversold, a payment
  must be recorded exactly once even when Stripe redelivers a webhook, prices are always computed
  server-side.
- Independent scaling of very different workloads: catalog browsing and search are read-heavy and
  spiky (product drops), checkout is low-volume but must be strongly consistent, email sending is
  asynchronous and retryable.
- The product will grow (configurator, marketplace/sellers later), and the team wants clear
  ownership boundaries and independent deployability from the start.
- The project is also an explicit target for a production-grade platform: Docker, Kubernetes,
  Kafka, CI/CD on AWS.

## Decision

Split the backend into ten services, each owning one bounded context and its data:

| Service              | Owns                                                                  |
| -------------------- | --------------------------------------------------------------------- |
| api-gateway          | Nothing persistent. Routing, authN, rate limiting, request IDs, CORS  |
| auth-service         | Users, sessions, refresh tokens, verification/reset tokens            |
| product-service      | Catalog, variants, categories, attributes, configurator rules, search |
| inventory-service    | Stock, reservations, stock movements                                  |
| cart-service         | Carts, cart items, discount codes, wishlist                           |
| order-service        | Orders, items, status history, shipping addresses                     |
| payment-service      | Payments, refunds, processed Stripe events                            |
| notification-service | Preferences, delivery logs, newsletter subscribers                    |
| review-service       | Reviews, votes                                                        |
| admin-service        | Analytics read models and audit log (projections only)                |

Rules:

1. **Database-per-service.** Each service has its own PostgreSQL database and database user with
   privileges on that database only. No service reads or writes another service's tables. In
   production, databases may share one RDS cluster (separate databases + users) until load
   justifies separate clusters; the boundary is enforced by credentials, not by convention.
2. **Synchronous REST** for queries and commands that need an immediate answer
   (e.g. order-service asks inventory-service to reserve stock during checkout).
3. **Asynchronous Kafka events** for facts other services react to (e.g. `PaymentSucceeded` →
   order marked `PAID` → stock decremented → email sent). Contracts are versioned and centralised in
   `packages/events`.
4. **Reliable publishing.** Services write domain changes and the outgoing event in the same
   database transaction (transactional outbox) and a relay publishes to Kafka. This avoids the
   dual-write problem (DB committed, event lost).
5. **Idempotent consumption.** Every consumer records processed `eventId`s (inbox table) so Kafka's
   at-least-once delivery never applies an effect twice.
6. **No shared business logic libraries.** Shared packages contain contracts and infrastructure
   helpers only (types, events, config, logger). Domain logic lives in its owning service.

Boundary choices worth calling out:

- **Discount codes live in cart-service**, because the cart is where totals are computed. The
  admin dashboard manages them through cart-service's admin API.
- **Wishlist lives in cart-service** (a list of saved variants per user, same access pattern).
- **admin-service is a back-office facade plus analytics**: it composes data from owning services
  over REST and builds its own read models from events. It never owns core domain data.
- **Prices are owned by product-service.** Cart and order services always re-read prices from it;
  the frontend's numbers are display-only.

## Alternatives considered

- **Modular monolith** (one NestJS app, one database with a schema per module). Honest assessment:
  for a single store at launch this is cheaper to build and operate, with fewer failure modes
  (no network calls between modules, no distributed transactions). It was rejected because
  independent deployability and scaling, the Kafka-based event flow and the Kubernetes platform are
  explicit product requirements. If operating cost becomes a concern, the strict boundaries above
  make it possible to co-deploy services without rewriting them.
- **Shared database, separate services.** Rejected: it couples services through the schema and
  makes independent migrations and deployments impossible, giving the costs of both styles.
- **Fewer, larger services** (e.g. merging cart + order, or inventory + product). Viable, and the
  most likely fallback if the team is small. Kept separate because inventory needs strict
  row-level concurrency control that should not compete with catalog reads, and the checkout
  saga is clearer when each step has a single owner.

## Consequences

- Positive: clear ownership, independent scaling (product-service can scale out for a drop while
  payment-service stays small), failures are isolated (an email outage does not block checkout).
- Negative: distributed-systems complexity — eventual consistency between services, sagas instead
  of ACID transactions, more infrastructure (Kafka, ten deployments), harder local development.
- Required mitigations, each delivered in a later phase:
  - Correlation IDs on every request and event, plus OpenTelemetry tracing (Phase 19).
  - Outbox/inbox tables and dead-letter topics (Phase 10).
  - Contract tests on the shared event schemas (started in Phase 1: `packages/events` tests).
  - One-command local environment with Docker Compose (Phase 14).
