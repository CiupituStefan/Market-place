import { randomUUID } from 'node:crypto';
import { InventoryStockChangedV1, Topics } from '@market/events';
import { Consumer, MessagesStreamModes, stringDeserializers } from '@platformatic/kafka';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { MessagingConfig } from '../src/config.js';
import { on, PermanentEventError } from '../src/consumer.js';
import { ensureTopics } from '../src/kafka.js';
import { startMessaging, type Messaging } from '../src/messaging.js';
import { enqueue, silentLogger, testDatabase, type TestDb } from './helpers.js';
import { notes } from './schema.js';

/**
 * End to end on a real broker: outbox → relay → Kafka → consumer group → handler,
 * and the dead-letter topic. Needs KAFKA_BROKERS (CI runs a Kafka service).
 */
const brokers = process.env.KAFKA_BROKERS?.split(',');

describe.skipIf(!brokers)('messaging on a real Kafka broker', () => {
  let db: TestDb;
  let close: () => Promise<void>;
  let messaging: Messaging;
  const poison = randomUUID();
  const seen: string[] = [];
  const config: MessagingConfig = {
    NODE_ENV: 'test',
    KAFKA_BROKERS: brokers,
    KAFKA_SSL: false,
    KAFKA_TOPIC_PARTITIONS: 3,
    KAFKA_REPLICATION_FACTOR: 1,
    OUTBOX_RELAY_INTERVAL_MS: 50,
    OUTBOX_BATCH_SIZE: 100,
    OUTBOX_RETENTION_DAYS: 7,
    CONSUMER_MAX_ATTEMPTS: 2,
  };

  beforeAll(async () => {
    ({ db, close } = await testDatabase());
    messaging = await startMessaging({
      serviceName: 'messaging-test',
      config,
      db,
      logger: silentLogger,
      publishes: [InventoryStockChangedV1.topic],
      access: {
        'messaging-test': {
          publishes: [InventoryStockChangedV1.topic],
          consumes: [InventoryStockChangedV1.topic],
        },
      },
      consumers: [
        {
          // A fresh group per run: it reads the topic from the start, so filter to this run's ids.
          name: `messaging-test.${randomUUID()}`,
          topics: [InventoryStockChangedV1.topic],
          handlers: [
            on(InventoryStockChangedV1, async (event, tx: TestDb) => {
              if (event.payload.variantId === poison) throw new PermanentEventError('poison');
              seen.push(`${event.payload.variantId}:${String(event.payload.available)}`);
              await tx.insert(notes).values({ text: event.payload.variantId });
            }),
          ],
        },
      ],
    });
  });

  afterAll(async () => {
    await messaging.stop();
    await close();
  });

  it('delivers outbox events through Kafka to the consumer, in order per key', async () => {
    const variant = randomUUID();
    for (let available = 5; available >= 1; available -= 1) await enqueue(db, variant, available);
    await expect
      .poll(() => seen.filter((s) => s.startsWith(variant)), { timeout: 30_000, interval: 200 })
      .toEqual([5, 4, 3, 2, 1].map((n) => `${variant}:${String(n)}`));
  });

  it('routes a failing event to the dead-letter topic and keeps consuming', async () => {
    await enqueue(db, poison, 1);
    const after = randomUUID();
    await enqueue(db, after, 7);
    await expect
      .poll(() => seen.includes(`${after}:7`), { timeout: 30_000, interval: 200 })
      .toBe(true);

    const dlq = new Consumer({
      groupId: `dlq-reader-${randomUUID()}`,
      clientId: 'dlq-reader',
      bootstrapBrokers: brokers ?? [],
      deserializers: stringDeserializers,
    });
    const stream = await dlq.consume({
      topics: [`${InventoryStockChangedV1.topic}.dlq`],
      mode: MessagesStreamModes.EARLIEST,
      autocommit: false,
    });
    let found: Map<string, string> | undefined;
    for await (const message of stream) {
      if (message.key === poison) {
        found = message.headers;
        break;
      }
    }
    await stream.close();
    await dlq.close(true);
    expect(found?.get('dlq-reason')).toBe('handler-failed');
    expect(found?.get('dlq-error')).toBe('PermanentEventError: poison');
  });

  it('lets several services create the same topics at the same time', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        ensureTopics(config, `racer-${randomUUID()}`, [Topics.REVIEW]),
      ),
    );
    expect(results.filter((r) => r.status === 'rejected')).toEqual([]);
  });
});
