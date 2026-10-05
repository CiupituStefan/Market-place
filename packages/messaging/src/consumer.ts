import { inboxEvents, type Database } from '@market/db';
import {
  deadLetterTopic,
  parseEvent,
  type EventDefinition,
  type EventEnvelope,
  type Topic,
} from '@market/events';
import type { Logger } from '@market/logger';
import { runWithContext } from '@market/logger';
import { Consumer, MessagesStreamModes, stringDeserializers } from '@platformatic/kafka';
import { and, eq } from 'drizzle-orm';
import { ZodError } from 'zod';
import type { MessagingConfig } from './config.js';
import { connectionOptions } from './kafka.js';
import type { MessagePublisher } from './publisher.js';

type AnyDatabase = Database;

/** A message as the processor sees it, independent of the Kafka client. */
export interface ConsumedMessage {
  topic: string;
  partition: number;
  offset: string;
  key: string | null;
  value: string | null;
  headers: Record<string, string>;
}

/**
 * Handles one event inside the transaction that also records it in the inbox:
 * database writes made with `tx` happen exactly once. Side effects outside the
 * database (HTTP calls, Stripe) must be idempotent, because a failure after them
 * rolls the inbox row back and the event is retried.
 */
export type EventHandler<TDb, D extends EventDefinition = EventDefinition> = (
  event: EventEnvelope<D>,
  tx: TDb,
) => Promise<void>;

/** Throw from a handler for failures a retry cannot fix: the event goes straight to the DLQ. */
export class PermanentEventError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentEventError';
  }
}

export interface HandlerEntry<TDb> {
  key: string;
  handler: EventHandler<TDb>;
  /** Runs inside the inbox transaction (exactly-once DB effects) or outside it. */
  transactional: boolean;
}

/** Binds a handler to one contract version, with the payload typed accordingly. */
export function on<TDb, D extends EventDefinition>(
  definition: D,
  handler: EventHandler<TDb, D>,
): HandlerEntry<TDb> {
  return {
    key: `${definition.type}@v${String(definition.version)}`,
    handler: handler as unknown as EventHandler<TDb>,
    transactional: true,
  };
}

/**
 * For handlers whose effects are outside this database (Stripe, other services)
 * or that manage their own transactions. They run outside the inbox transaction
 * and must be idempotent themselves: the inbox only skips events already
 * completed, and a crash between the effect and the inbox write repeats it.
 */
export function onIdempotent<TDb, D extends EventDefinition>(
  definition: D,
  handler: (event: EventEnvelope<D>) => Promise<void>,
): HandlerEntry<TDb> {
  return {
    key: `${definition.type}@v${String(definition.version)}`,
    handler: handler as unknown as EventHandler<TDb>,
    transactional: false,
  };
}

export interface ConsumerDefinition<TDb> {
  /** Kafka consumer group and inbox namespace, e.g. `payment-service.orders`. */
  name: string;
  topics: Topic[];
  handlers: HandlerEntry<TDb>[];
}

export type ProcessResult = 'processed' | 'duplicate' | 'ignored' | 'dead-lettered';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The delivery semantics, independent of Kafka (unit-testable):
 * invalid or unknown message → DLQ; no handler → ignored; already in the inbox →
 * duplicate; otherwise handled with retries (exponential backoff, the partition
 * waits so ordering is kept), then DLQ with the error attached.
 */
export class EventProcessor<TDb extends AnyDatabase> {
  private readonly handlers: Map<string, HandlerEntry<TDb>>;

  constructor(
    private readonly db: TDb,
    private readonly deadLetters: MessagePublisher,
    private readonly definition: ConsumerDefinition<TDb>,
    private readonly options: { maxAttempts: number; retryDelayMs: number; logger: Logger },
  ) {
    this.handlers = new Map(definition.handlers.map((entry) => [entry.key, entry]));
  }

  async process(message: ConsumedMessage): Promise<ProcessResult> {
    let event: EventEnvelope;
    try {
      event = parseEvent(message.value ?? '');
    } catch (error) {
      await this.deadLetter(message, 'invalid-event', error, 0);
      return 'dead-lettered';
    }
    const entry = this.handlers.get(`${event.eventType}@v${String(event.eventVersion)}`);
    if (!entry) return 'ignored';

    let lastError: unknown;
    for (let attempt = 1; attempt <= this.options.maxAttempts; attempt += 1) {
      try {
        const duplicate = await runWithContext({ requestId: event.correlationId }, () =>
          entry.transactional
            ? this.handleInTransaction(entry, event)
            : this.handleOutside(entry, event),
        );
        return duplicate ? 'duplicate' : 'processed';
      } catch (error) {
        lastError = error;
        if (error instanceof PermanentEventError || error instanceof ZodError) break;
        if (attempt < this.options.maxAttempts) {
          const delay = this.options.retryDelayMs * 2 ** (attempt - 1);
          this.options.logger.warn(
            {
              err: error,
              eventId: event.eventId,
              eventType: event.eventType,
              attempt,
              retryInMs: delay,
            },
            `${this.definition.name}: handler failed; retrying`,
          );
          await sleep(delay);
        }
      }
    }
    await this.deadLetter(message, 'handler-failed', lastError, this.options.maxAttempts);
    return 'dead-lettered';
  }

  /** Inbox row and handler writes commit together: exactly-once effects in this database. */
  private handleInTransaction(entry: HandlerEntry<TDb>, event: EventEnvelope): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      if (!(await this.record(tx as unknown as TDb, event))) return true;
      await entry.handler(event, tx as unknown as TDb);
      return false;
    });
  }

  /** Idempotent handler first, inbox row after: a crash in between repeats the (idempotent) effect. */
  private async handleOutside(entry: HandlerEntry<TDb>, event: EventEnvelope): Promise<boolean> {
    const [seen] = await this.db
      .select({ eventId: inboxEvents.eventId })
      .from(inboxEvents)
      .where(
        and(eq(inboxEvents.consumer, this.definition.name), eq(inboxEvents.eventId, event.eventId)),
      );
    if (seen) return true;
    await entry.handler(event, this.db);
    await this.record(this.db, event);
    return false;
  }

  /** Returns false when the event was already recorded. */
  private async record(db: TDb, event: EventEnvelope): Promise<boolean> {
    const recorded = await db
      .insert(inboxEvents)
      .values({
        consumer: this.definition.name,
        eventId: event.eventId,
        eventType: event.eventType,
      })
      .onConflictDoNothing()
      .returning({ eventId: inboxEvents.eventId });
    return recorded.length > 0;
  }

  /** Publishes the original message, untouched, with the failure in headers. */
  private async deadLetter(
    message: ConsumedMessage,
    reason: string,
    error: unknown,
    attempts: number,
  ) {
    const errorText = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    this.options.logger.error(
      {
        topic: message.topic,
        partition: message.partition,
        offset: message.offset,
        reason,
        err: error,
      },
      `${this.definition.name}: message sent to the dead-letter topic`,
    );
    await this.deadLetters.publish([
      {
        topic: deadLetterTopic(message.topic as Topic),
        key: message.key ?? '',
        value: message.value ?? '',
        headers: {
          ...message.headers,
          'dlq-reason': reason,
          'dlq-error': errorText.slice(0, 1_000),
          'dlq-consumer': this.definition.name,
          'dlq-attempts': String(attempts),
          'dlq-original-topic': message.topic,
          'dlq-original-partition': String(message.partition),
          'dlq-original-offset': message.offset,
          'dlq-failed-at': new Date().toISOString(),
        },
      },
    ]);
  }
}

/**
 * Runs an EventProcessor on a Kafka consumer group. Offsets are committed only
 * after a message was processed (or dead-lettered), one message at a time, so a
 * crash re-delivers instead of losing, and per-partition order is kept.
 */
export class KafkaEventConsumer<TDb extends AnyDatabase> {
  private consumer: Consumer<string, string, string, string> | undefined;
  private loop: Promise<void> | undefined;
  private stopped = false;

  constructor(
    private readonly config: MessagingConfig,
    private readonly clientId: string,
    private readonly processor: EventProcessor<TDb>,
    private readonly definition: ConsumerDefinition<TDb>,
    private readonly logger: Logger,
  ) {}

  start(): void {
    this.loop = this.run();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    await this.consumer?.close(true).catch(() => undefined);
    await this.loop;
  }

  /** A method, so TypeScript does not narrow the flag across awaits. */
  private isStopped(): boolean {
    return this.stopped;
  }

  private async run(): Promise<void> {
    while (!this.stopped) {
      try {
        this.consumer = new Consumer({
          groupId: this.definition.name,
          clientId: `${this.clientId}-${this.definition.name}`,
          bootstrapBrokers: this.config.KAFKA_BROKERS ?? [],
          deserializers: stringDeserializers,
          ...connectionOptions(this.config),
        });
        const stream = await this.consumer.consume({
          topics: this.definition.topics,
          autocommit: false,
          // Resume from the group's committed offsets; a brand-new group reads from the start.
          mode: MessagesStreamModes.COMMITTED,
          fallbackMode: MessagesStreamModes.EARLIEST,
          sessionTimeout: 30_000,
          heartbeatInterval: 3_000,
        });
        this.logger.info({ topics: this.definition.topics }, `${this.definition.name}: consuming`);
        for await (const message of stream) {
          const result = await this.processor.process({
            topic: message.topic,
            partition: message.partition,
            offset: String(message.offset),
            key: message.key,
            value: message.value,
            headers: Object.fromEntries(message.headers),
          });
          if (result === 'processed' || result === 'dead-lettered') {
            this.logger.debug(
              { offset: String(message.offset), result },
              `${this.definition.name}: message`,
            );
          }
          await message.commit();
          if (this.isStopped()) break;
        }
      } catch (error) {
        if (this.isStopped()) break;
        // E.g. the DLQ publish failed: nothing was committed, so the message is re-delivered.
        this.logger.error(
          { err: error },
          `${this.definition.name}: consumer failed; restarting in 5s`,
        );
        await this.consumer?.close(true).catch(() => undefined);
        await sleep(5_000);
      }
    }
  }
}
