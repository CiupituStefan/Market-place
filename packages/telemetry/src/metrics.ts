import { metrics, type Attributes, type Counter, type Histogram } from '@opentelemetry/api';

/**
 * Domain metrics, next to the HTTP, database and runtime metrics the instrumentation
 * records. Names follow OpenTelemetry conventions; Prometheus sees them with dots turned into
 * underscores and a unit/_total suffix (e.g. cse_orders_created_total).
 * Created lazily: the meter is a no-op until the SDK is started.
 */
const meter = () => metrics.getMeter('cse');

let instruments:
  | {
      ordersCreated: Counter;
      ordersCancelled: Counter;
      checkoutsFailed: Counter;
      payments: Counter;
      eventsPublished: Counter;
      eventsConsumed: Counter;
      eventsDeadLettered: Counter;
      eventHandlingDuration: Histogram;
      outboxLag: Histogram;
    }
  | undefined;

function get() {
  instruments ??= {
    ordersCreated: meter().createCounter('cse.orders.created', {
      description: 'Orders placed (checkout accepted).',
    }),
    ordersCancelled: meter().createCounter('cse.orders.cancelled', {
      description: 'Orders cancelled, by reason.',
    }),
    checkoutsFailed: meter().createCounter('cse.checkouts.failed', {
      description: 'Checkouts that could not place an order, by error code.',
    }),
    payments: meter().createCounter('cse.payments', {
      description: 'Payment outcomes confirmed by the provider webhook, by outcome.',
    }),
    eventsPublished: meter().createCounter('cse.events.published', {
      description: 'Domain events published to Kafka from the outbox.',
    }),
    eventsConsumed: meter().createCounter('cse.events.consumed', {
      description: 'Domain events handled, by outcome (processed, duplicate, retried).',
    }),
    eventsDeadLettered: meter().createCounter('cse.events.dead_lettered', {
      description: 'Events moved to a dead-letter topic after their retries.',
    }),
    eventHandlingDuration: meter().createHistogram('cse.events.handling.duration', {
      unit: 's',
      description: 'Time spent handling one event.',
      advice: {
        explicitBucketBoundaries: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
      },
    }),
    outboxLag: meter().createHistogram('cse.outbox.lag', {
      unit: 's',
      description: 'Time from writing an event to the outbox to publishing it.',
      // The relay polls about once a second; the OutboxLagging alert fires at 60 s.
      advice: { explicitBucketBoundaries: [0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60, 120, 300, 900] },
    }),
  };
  return instruments;
}

export const domainMetrics = {
  orderCreated: (attributes: Attributes = {}) => {
    get().ordersCreated.add(1, attributes);
  },
  orderCancelled: (reason: string) => {
    get().ordersCancelled.add(1, { reason });
  },
  checkoutFailed: (reason: string) => {
    get().checkoutsFailed.add(1, { reason });
  },
  payment: (outcome: 'succeeded' | 'failed' | 'refunded') => {
    get().payments.add(1, { outcome });
  },
  eventPublished: (topic: string) => {
    get().eventsPublished.add(1, { topic });
  },
  eventConsumed: (
    topic: string,
    outcome: 'processed' | 'duplicate' | 'retried',
    seconds: number,
  ) => {
    get().eventsConsumed.add(1, { topic, outcome });
    get().eventHandlingDuration.record(seconds, { topic });
  },
  eventDeadLettered: (topic: string) => {
    get().eventsDeadLettered.add(1, { topic });
  },
  outboxLag: (topic: string, seconds: number) => {
    get().outboxLag.record(seconds, { topic });
  },
};
