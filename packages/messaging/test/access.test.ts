import { Topics } from '@market/events';
import { describe, expect, it } from 'vitest';
import { startMessaging } from '../src/messaging.js';
import { silentLogger } from './helpers.js';

describe('startMessaging and the Kafka access list', () => {
  it('refuses to start a service that would use Kafka beyond its ACLs', async () => {
    await expect(
      startMessaging({
        serviceName: 'cart-service',
        config: {
          NODE_ENV: 'test',
          KAFKA_SSL: false,
          KAFKA_TOPIC_PARTITIONS: 1,
          KAFKA_REPLICATION_FACTOR: 1,
          OUTBOX_RELAY_INTERVAL_MS: 1000,
          OUTBOX_BATCH_SIZE: 10,
          OUTBOX_RETENTION_DAYS: 7,
          CONSUMER_MAX_ATTEMPTS: 1,
        },
        db: undefined as never,
        logger: silentLogger,
        publishes: [Topics.ORDER],
        consumers: [],
      }),
    ).rejects.toThrow('cart-service uses Kafka beyond its access');
  });
});
