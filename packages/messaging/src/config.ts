import { booleanString, commaList } from '@market/config';
import { z } from 'zod';

/**
 * Kafka settings every service with events extends its config with. Without
 * KAFKA_BROKERS (local development) messaging is off: the outbox simply keeps
 * the events until a broker is configured. Production refuses to start without it.
 */
export const messagingEnv = z.object({
  KAFKA_BROKERS: commaList.optional(),
  /** MSK uses TLS; local Kafka is plaintext. */
  KAFKA_SSL: booleanString.default(false),
  KAFKA_SASL_MECHANISM: z.enum(['PLAIN', 'SCRAM-SHA-256', 'SCRAM-SHA-512']).optional(),
  KAFKA_SASL_USERNAME: z.string().min(1).optional(),
  KAFKA_SASL_PASSWORD: z.string().min(1).optional(),
  /** Create missing topics at startup (development). In AWS topics are provisioned with the cluster. */
  KAFKA_CREATE_TOPICS: booleanString.optional(),
  KAFKA_TOPIC_PARTITIONS: z.coerce.number().int().min(1).max(64).default(6),
  KAFKA_REPLICATION_FACTOR: z.coerce.number().int().min(1).max(5).default(1),
  OUTBOX_RELAY_INTERVAL_MS: z.coerce.number().int().min(50).max(60_000).default(500),
  OUTBOX_BATCH_SIZE: z.coerce.number().int().min(1).max(1_000).default(100),
  /** Published outbox rows are deleted after this many days. */
  OUTBOX_RETENTION_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  /** Attempts per message before it goes to the dead-letter topic. */
  CONSUMER_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(5),
});

export type MessagingConfig = z.infer<typeof messagingEnv> & {
  NODE_ENV: 'development' | 'test' | 'production';
};
