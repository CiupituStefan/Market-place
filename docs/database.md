# Databases

## Database-per-service

Each service owns one PostgreSQL database and one database role that can access only that
database. No service connects to another service's database; data crosses boundaries only through
APIs and events (ADR-001).

| Service           | Database        | Tables                                                                               |
| ----------------- | --------------- | ------------------------------------------------------------------------------------ |
| auth-service      | `auth`          | users, sessions, refresh_tokens, one_time_tokens, outbox_events                      |
| product-service   | `products`      | products, product_variants, categories, product_images, product_attributes (Phase 5) |
| inventory-service | `inventory`     | inventory, inventory_reservations, stock_movements (Phase 6)                         |
| cart-service      | `cart`          | carts, cart_items, discount_codes, wishlist_items (Phase 7)                          |
| order-service     | `orders`        | orders, order_items, order_status_history, shipping_addresses (Phase 8)              |
| payment-service   | `payments`      | payments, refunds, payment_events (Phase 9)                                          |
| notification-svc  | `notifications` | notification_preferences, notification_logs (Phase 11)                               |
| review-service    | `reviews`       | reviews, review_votes (Phase 12)                                                     |

In AWS the databases may share one RDS cluster at first; isolation is enforced by roles and
grants, so splitting a busy service onto its own cluster later is an operational change only.

## Access layer: Drizzle ORM

- Schema in TypeScript (`src/db/schema.ts`), queries are typed SQL with no runtime engine.
- `pnpm db:generate` produces reviewed, committed SQL migrations (`drizzle/`). CI fails if the
  schema changed without a migration, and applies all migrations to a real PostgreSQL 16.
- Production runs `db:migrate` as a pre-deploy Kubernetes Job; app pods never run DDL
  (`MIGRATE_ON_START` defaults to `false` in production).

## Conventions

- `uuid` primary keys (`gen_random_uuid()`), `timestamptz` everywhere, `created_at` on every table.
- Secrets at rest are hashed: passwords with Argon2id, tokens with SHA-256.
- Every table that publishes events has an `outbox_events` table written in the same transaction.
- Concurrency-sensitive updates use row locks (`SELECT … FOR UPDATE`) or atomic `UPDATE … RETURNING`.

## Shared plumbing (`@market/db`)

`connectPostgres`, `runMigrations`, `isUniqueViolation`, the `outbox_events` table definition
re-exported by every publishing service, `enqueueEvent` (validates the envelope, writes it in the
caller's transaction) and `@market/db/testing` (PGlite with migrations and extensions).

Inside a transaction, queries run sequentially: a transaction is a single connection.

## Tests

Integration tests run against **PGlite** (PostgreSQL compiled to WebAssembly, in-process) with the
real migrations applied: same SQL, constraints and indexes as production, no external database.
Concurrency tests that need several connections run against a real PostgreSQL via
`createPostgresTestDatabase` (a throwaway database per run) when `TEST_DATABASE_URL` is set; CI sets it.
