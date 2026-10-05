# @market/messaging

Kafka plumbing shared by every service: the outbox relay, idempotent consumers with retries and
dead-letter topics, and topic setup. Design: [docs/events.md](../../docs/events.md),
[ADR-003](../../docs/adr/ADR-003-kafka.md).

```ts
await startMessaging({
  serviceName: 'payment-service',
  config, // messagingEnv
  db,
  logger,
  publishes: [Topics.PAYMENT], // runs the outbox relay
  consumers: [
    {
      name: 'payment-service.orders', // consumer group + inbox namespace
      topics: [Topics.ORDER],
      handlers: [
        on(SomeDbOnlyEvent, (event, tx) => applyInSameTransaction(tx, event)), // exactly once
        onIdempotent(OrderCancelledV1, (event) => cancelAtStripe(event)), // external effects
      ],
    },
  ],
});
```

Tests: PGlite suites for the relay and the processor; `test/kafka.test.ts` runs end to end on a
real broker when `KAFKA_BROKERS` is set (CI provides one).
