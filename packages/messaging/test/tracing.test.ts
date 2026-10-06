import { randomUUID } from 'node:crypto';
import { InventoryStockChangedV1 } from '@market/events';
import { context, propagation, SpanKind, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { EventProcessor, on } from '../src/consumer.js';
import { OutboxRelay } from '../src/outbox-relay.js';
import { InMemoryPublisher } from '../src/publisher.js';
import { enqueue, silentLogger, testDatabase, type TestDb } from './helpers.js';

/**
 * One trace from the request that changed state, through the outbox and Kafka, into the
 * consumer's handler: what lets an operator follow "order placed → stock reserved" end to end.
 */
const exporter = new InMemorySpanExporter();
const provider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });

beforeAll(() => {
  context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
  propagation.setGlobalPropagator(new W3CTraceContextPropagator());
  trace.setGlobalTracerProvider(provider);
});

afterAll(async () => {
  await provider.shutdown();
  trace.disable();
  propagation.disable();
  context.disable();
});

describe('trace context through the outbox and Kafka', () => {
  let db: TestDb;
  let close: () => Promise<void>;
  let publisher: InMemoryPublisher;

  beforeEach(async () => {
    ({ db, close } = await testDatabase());
    publisher = new InMemoryPublisher();
    exporter.reset();
  });

  afterEach(async () => {
    await close();
  });

  it('continues the request trace in the producer and consumer spans', async () => {
    const variant = randomUUID();

    // 1. The "HTTP request": a span active while the event is written to the outbox.
    const request = trace.getTracer('test').startSpan('POST /api/v1/orders');
    await context.with(trace.setSpan(context.active(), request), () => enqueue(db, variant, 2));
    request.end();
    const traceId = request.spanContext().traceId;

    // 2. The relay publishes later, outside the request.
    const relay = new OutboxRelay(db, publisher, {
      name: 'test-service',
      batchSize: 10,
      intervalMs: 10,
      retentionDays: 7,
      logger: silentLogger,
    });
    expect(await relay.relayOnce()).toBe(1);
    const [message] = publisher.published;
    expect(message?.headers.traceparent).toMatch(new RegExp(`^00-${traceId}-[0-9a-f]{16}-01$`));

    // 3. A consumer processes the message.
    let handlerTraceId: string | undefined;
    const processor = new EventProcessor(
      db,
      new InMemoryPublisher(),
      {
        name: 'test-consumer',
        topics: ['inventory.stock.events'],
        handlers: [
          on(InventoryStockChangedV1, () => {
            handlerTraceId = trace.getActiveSpan()?.spanContext().traceId;
            return Promise.resolve();
          }),
        ],
      },
      { maxAttempts: 1, retryDelayMs: 1, logger: silentLogger },
    );
    expect(
      await processor.process({
        topic: message?.topic ?? '',
        partition: 0,
        offset: '7',
        key: message?.key ?? null,
        value: message?.value ?? null,
        headers: message?.headers ?? {},
      }),
    ).toBe('processed');

    const spans = exporter.getFinishedSpans();
    const producer = spans.find((s) => s.kind === SpanKind.PRODUCER);
    const consumer = spans.find((s) => s.kind === SpanKind.CONSUMER);
    expect(producer?.name).toBe('publish inventory.stock.events');
    expect(producer?.spanContext().traceId).toBe(traceId);
    expect(producer?.parentSpanContext?.spanId).toBe(request.spanContext().spanId);
    expect(consumer?.name).toBe('process inventory.stock.events');
    expect(consumer?.spanContext().traceId).toBe(traceId);
    expect(consumer?.parentSpanContext?.spanId).toBe(producer?.spanContext().spanId);
    expect(consumer?.attributes).toMatchObject({
      'messaging.system': 'kafka',
      'messaging.consumer.group.name': 'test-consumer',
      'cse.event.outcome': 'processed',
    });
    // Work inside the handler (queries, calls) belongs to the same trace.
    expect(handlerTraceId).toBe(traceId);
  });

  it('starts a new trace for events written outside any request', async () => {
    await enqueue(db, randomUUID(), 1);
    const relay = new OutboxRelay(db, publisher, {
      name: 'test-service',
      batchSize: 10,
      intervalMs: 10,
      retentionDays: 7,
      logger: silentLogger,
    });
    await relay.relayOnce();
    const producer = exporter.getFinishedSpans().find((s) => s.kind === SpanKind.PRODUCER);
    expect(producer).toBeDefined();
    expect(producer?.parentSpanContext).toBeUndefined();
    expect(publisher.published[0]?.headers.traceparent).toContain(producer?.spanContext().traceId);
  });
});
