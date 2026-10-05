import { Producer, stringSerializers } from '@platformatic/kafka';
import { connectionOptions } from './kafka.js';
import type { MessagingConfig } from './config.js';

export interface OutgoingMessage {
  topic: string;
  key: string;
  value: string;
  headers: Record<string, string>;
}

/** Where outbox rows and dead letters are written. Kafka in production, memory in tests. */
export interface MessagePublisher {
  /** Resolves only when every message is acknowledged by all in-sync replicas. */
  publish(messages: OutgoingMessage[]): Promise<void>;
  close(): Promise<void>;
}

export class KafkaPublisher implements MessagePublisher {
  private readonly producer;

  constructor(config: MessagingConfig, clientId: string) {
    this.producer = new Producer({
      clientId,
      bootstrapBrokers: config.KAFKA_BROKERS ?? [],
      serializers: stringSerializers,
      // Idempotent producer + acks=all: retries never duplicate or reorder within a partition.
      idempotent: true,
      acks: -1,
      ...connectionOptions(config),
    });
  }

  async publish(messages: OutgoingMessage[]): Promise<void> {
    if (messages.length === 0) return;
    await this.producer.send({ messages });
  }

  async close(): Promise<void> {
    await this.producer.close();
  }
}

/** Test double: records what would have been published; can be told to fail. */
export class InMemoryPublisher implements MessagePublisher {
  readonly published: OutgoingMessage[] = [];
  failNext = 0;

  publish(messages: OutgoingMessage[]): Promise<void> {
    if (this.failNext > 0) {
      this.failNext -= 1;
      return Promise.reject(new Error('broker unavailable'));
    }
    this.published.push(...messages);
    return Promise.resolve();
  }

  close(): Promise<void> {
    return Promise.resolve();
  }
}
