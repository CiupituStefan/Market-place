# ADR-012: Pessimistic row locking with database invariants for stock

- Status: Accepted
- Date: 2026-10-05

## Context

Limited keyboard runs sell out in minutes; many shoppers check out the last units at the same
time. Selling a unit twice means cancelling a paid order. Payments can also arrive late (after a
reservation expired) or be delivered twice.

## Decision

- Reserve stock with `SELECT … FOR UPDATE` on the inventory rows, **locked in variant-id order**,
  then update `reserved`, all in one transaction (pessimistic locking).
- Enforce `0 <= reserved <= on_hand` with CHECK constraints as a last line of defence.
- One reservation per order (unique index) for idempotent retries; idempotent confirm/release.
- Expire reservations with a `FOR UPDATE SKIP LOCKED` sweeper that runs in every replica.
- Prove the behaviour with concurrency tests on a real PostgreSQL in CI.

## Alternatives considered

- **Optimistic concurrency (version column + retry)**: no lock waits, but under a flash sale most
  attempts conflict and retry; more complex and slower exactly when it matters.
- **Single conditional UPDATE per line** (`… WHERE on_hand - reserved >= q`): correct for one line,
  but multi-line orders still need all-or-nothing semantics and a deterministic lock order.
- **Redis counters (DECR)**: fast, but a second source of truth that must be reconciled with the
  database and is lost on failover without careful persistence.
- **Queue all checkouts through one worker**: serialises everything, simple, but becomes the
  bottleneck and a single point of failure.

## Consequences

- Hot SKUs serialise on their row lock; transactions are short (a few statements), so throughput
  stays far above our expected checkout rate. If a single SKU ever needs more, it can be split into
  stock buckets.
- Stock correctness does not depend on Kafka or on other services being up.
