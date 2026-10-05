import { deadLetterTopic, type Topic } from '@market/events';
import { Admin } from '@platformatic/kafka';
import type { MessagingConfig } from './config.js';

/** TLS / SASL settings shared by producers, consumers and the admin client. */
export function connectionOptions(config: MessagingConfig) {
  return {
    ...(config.KAFKA_SSL ? { tls: {} } : {}),
    ...(config.KAFKA_SASL_MECHANISM
      ? {
          sasl: {
            mechanism: config.KAFKA_SASL_MECHANISM,
            username: config.KAFKA_SASL_USERNAME ?? '',
            password: config.KAFKA_SASL_PASSWORD ?? '',
          },
        }
      : {}),
  };
}

/**
 * Creates the topics (and their dead-letter topics) a service uses, if missing.
 * Development convenience; production topics are provisioned with the cluster.
 */
export async function ensureTopics(
  config: MessagingConfig,
  clientId: string,
  topics: readonly Topic[],
) {
  const admin = new Admin({
    clientId: `${clientId}-admin`,
    bootstrapBrokers: config.KAFKA_BROKERS ?? [],
    ...connectionOptions(config),
  });
  try {
    const wanted = [...new Set(topics.flatMap((topic) => [topic, deadLetterTopic(topic)]))];
    const existing = new Set(await admin.listTopics());
    const missing = wanted.filter((topic) => !existing.has(topic));
    if (missing.length > 0) {
      try {
        await admin.createTopics({
          topics: missing,
          partitions: config.KAFKA_TOPIC_PARTITIONS,
          replicas: config.KAFKA_REPLICATION_FACTOR,
        });
      } catch (error) {
        // Services starting together race to create shared topics: losing that race is fine.
        if (!onlyAlreadyExists(error)) throw error;
      }
    }
    return missing;
  } finally {
    await admin.close();
  }
}

/** True when every leaf error of a (possibly nested) Kafka error is TOPIC_ALREADY_EXISTS. */
export function onlyAlreadyExists(error: unknown): boolean {
  const leaves: unknown[] = [];
  const walk = (e: unknown) => {
    const nested = (e as { errors?: unknown[] } | null)?.errors;
    if (Array.isArray(nested) && nested.length > 0) nested.forEach(walk);
    else leaves.push(e);
  };
  walk(error);
  return (
    leaves.length > 0 &&
    leaves.every((leaf) => (leaf as { apiId?: string } | null)?.apiId === 'TOPIC_ALREADY_EXISTS')
  );
}
