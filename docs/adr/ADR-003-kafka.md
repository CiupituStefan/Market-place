# ADR-003: Kafka with a transactional outbox, inbox deduplication and dead-letter topics

- Status: Accepted
- Date: 2026-10-05

## Context

Services own their data (ADR-001) but must learn about each other's changes: stock levels change
catalog availability, new catalog variants need stock records, a paid order empties a cart, a
cancelled order must stop being payable. Publishing to a broker inside a request ("dual write")
loses events when the broker is down or the process dies between the commit and the publish.
Brokers deliver at least once; consumers see duplicates and must not double-apply them.

## Decision

- **Apache Kafka** (Amazon MSK in AWS, Phase 16): one topic per bounded context, keyed by aggregate
  id, so events of one product/order/payment are ordered within a partition. Versioned JSON
  envelopes validated by Zod contracts in `packages/events`.
- **Transactional outbox** in every producing service, published by a relay in `@market/messaging`:
  ordered by an identity column, one active relay per service (advisory lock), idempotent producer
  with `acks=all`.
- **Inbox table** per consuming service; database-only handlers run in the same transaction as the
  inbox insert (exactly-once effects); handlers with external effects are idempotent and run outside it.
- **Retries in place, then dead-letter topics** (`<topic>.dlq`) with the failure in headers. Retrying
  in place blocks one partition briefly but preserves ordering; a separate retry topic would reorder.
- **Client: `@platformatic/kafka`** — pure JavaScript (no native librdkafka build in images),
  TypeScript types, maintained, TLS + SASL/SCRAM.
- Synchronous REST stays for the interactive checkout saga (ADR-014).

## Alternatives considered

- **KafkaJS**: the long-time default, but unmaintained since 2023.
- **`@confluentinc/kafka-javascript`** (librdkafka): fast and feature-complete, but a native addon whose
  prebuilt binaries are downloaded at install time — heavier images and fragile CI.
- **SQS/SNS**: fully managed and simpler, but no ordered, replayable log per key; ordering per
  aggregate would need FIFO queues per consumer, and replaying history for a new consumer is impossible.
- **Debezium CDC on the outbox**: no polling, but another distributed system (Kafka Connect) to run.
  The polling relay is a few hundred lines and good for thousands of events per second; revisit if
  that ceiling is reached.
- **Publishing in the request after commit**: loses events on crashes.

## Consequences

- Every producing service runs a relay; every consumer has an inbox table and a migration for it.
- End-to-end delivery is asynchronous: e.g. catalog availability follows stock with a sub-second
  delay. The UI must not assume read-your-writes across services.
- Dead letters need an operational routine: alert on DLQ traffic (Phase 19), fix, re-publish.
- MSK must be sized for retention and partitions; topics are created by IaC in production.
