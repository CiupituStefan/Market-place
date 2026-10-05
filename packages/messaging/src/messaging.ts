import type { Database } from '@market/db';
import type { Topic } from '@market/events';
import type { Logger } from '@market/logger';
import type { MessagingConfig } from './config.js';
import { EventProcessor, KafkaEventConsumer, type ConsumerDefinition } from './consumer.js';
import { ensureTopics } from './kafka.js';
import { OutboxRelay } from './outbox-relay.js';
import { KafkaPublisher } from './publisher.js';

type AnyDatabase = Database;

export interface Messaging {
  readonly enabled: boolean;
  stop(): Promise<void>;
}

/**
 * Starts a service's messaging: the outbox relay (if it publishes) and its
 * consumers. Without KAFKA_BROKERS it does nothing outside production (events
 * wait in the outbox); production refuses to start without a broker.
 */
export async function startMessaging<TDb extends AnyDatabase>(options: {
  serviceName: string;
  config: MessagingConfig;
  db: TDb;
  logger: Logger;
  /** Topics this service publishes to (from its outbox). Empty: no relay. */
  publishes: Topic[];
  consumers: ConsumerDefinition<TDb>[];
}): Promise<Messaging> {
  const { config, logger, serviceName } = options;
  if (!config.KAFKA_BROKERS?.length) {
    if (config.NODE_ENV === 'production')
      throw new Error('KAFKA_BROKERS is required in production');
    logger.warn('KAFKA_BROKERS not set: messaging disabled (events stay in the outbox)');
    return { enabled: false, stop: () => Promise.resolve() };
  }

  const createTopics = config.KAFKA_CREATE_TOPICS ?? config.NODE_ENV !== 'production';
  if (createTopics) {
    const topics = [...options.publishes, ...options.consumers.flatMap((c) => c.topics)];
    const created = await ensureTopics(config, serviceName, topics);
    if (created.length > 0) logger.info({ topics: created }, 'created Kafka topics');
  }

  const publisher = new KafkaPublisher(config, serviceName);
  const relay =
    options.publishes.length > 0
      ? new OutboxRelay(options.db, publisher, {
          name: serviceName,
          batchSize: config.OUTBOX_BATCH_SIZE,
          intervalMs: config.OUTBOX_RELAY_INTERVAL_MS,
          retentionDays: config.OUTBOX_RETENTION_DAYS,
          logger,
        })
      : null;
  const consumers = options.consumers.map(
    (definition) =>
      new KafkaEventConsumer(
        config,
        serviceName,
        new EventProcessor(options.db, publisher, definition, {
          maxAttempts: config.CONSUMER_MAX_ATTEMPTS,
          retryDelayMs: 500,
          logger,
        }),
        definition,
        logger,
      ),
  );
  relay?.start();
  for (const consumer of consumers) consumer.start();
  logger.info(
    { relay: relay !== null, consumers: options.consumers.map((c) => c.name) },
    'messaging started',
  );

  return {
    enabled: true,
    stop: async () => {
      await Promise.all(consumers.map((consumer) => consumer.stop()));
      await relay?.stop();
      await publisher.close();
    },
  };
}
