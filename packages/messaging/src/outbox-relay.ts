import { outboxEvents, type Database } from '@market/db';
import type { Logger } from '@market/logger';
import { and, asc, inArray, isNotNull, isNull, lt, sql } from 'drizzle-orm';
import type { MessagePublisher } from './publisher.js';

export interface OutboxRelayOptions {
  /** Identifies the outbox (service name); also the advisory-lock key. */
  name: string;
  batchSize: number;
  intervalMs: number;
  retentionDays: number;
  logger: Logger;
}

type AnyDatabase = Database;

const MAX_BACKOFF_MS = 30_000;
const PURGE_EVERY_MS = 60 * 60 * 1000;

/**
 * Publishes the transactional outbox to Kafka.
 *
 * - **Ordering**: rows go out in `sequence` order, in batches, and a failed batch
 *   is retried as a whole before anything after it, so events of one aggregate
 *   (one partition key) are published in the order they were committed.
 * - **One relay per service**: every replica runs the loop, but a transaction-scoped
 *   advisory lock lets only one publish at a time; the others idle. (SKIP LOCKED
 *   would let replicas publish batches concurrently and reorder them.)
 * - **At least once**: a crash between Kafka's ack and marking rows published
 *   re-sends them; consumers deduplicate by eventId (inbox).
 */
export class OutboxRelay {
  private timer: NodeJS.Timeout | undefined;
  private running: Promise<void> | undefined;
  private stopped = true;
  private failures = 0;
  private lastPurge = 0;

  constructor(
    private readonly db: AnyDatabase,
    private readonly publisher: MessagePublisher,
    private readonly options: OutboxRelayOptions,
  ) {}

  start(): void {
    this.stopped = false;
    this.schedule(0);
  }

  async stop(): Promise<void> {
    this.stopped = true;
    clearTimeout(this.timer);
    await this.running;
  }

  /** Publishes one batch. Returns how many rows were published (0 if another replica holds the lock). */
  async relayOnce(): Promise<number> {
    try {
      const published = await this.db.transaction(async (tx) => {
        // node-postgres and PGlite both return { rows }.
        const lock = (await tx.execute(
          sql`SELECT pg_try_advisory_xact_lock(hashtext(${`outbox-relay:${this.options.name}`})) AS locked`,
        )) as { rows: { locked?: boolean }[] };
        if (!lock.rows[0]?.locked) return 0;

        const rows = await tx
          .select()
          .from(outboxEvents)
          .where(isNull(outboxEvents.publishedAt))
          .orderBy(asc(outboxEvents.sequence))
          .limit(this.options.batchSize);
        if (rows.length === 0) return 0;

        await this.publisher.publish(
          rows.map((row) => {
            const envelope = row.envelope as {
              eventId: string;
              eventType: string;
              eventVersion: number;
              correlationId: string;
            };
            return {
              topic: row.topic,
              key: row.messageKey,
              value: JSON.stringify(envelope),
              headers: {
                eventId: envelope.eventId,
                eventType: envelope.eventType,
                eventVersion: String(envelope.eventVersion),
                correlationId: envelope.correlationId,
              },
            };
          }),
        );
        await tx
          .update(outboxEvents)
          .set({ publishedAt: new Date() })
          .where(
            inArray(
              outboxEvents.id,
              rows.map((row) => row.id),
            ),
          );
        return rows.length;
      });
      this.failures = 0;
      return published;
    } catch (error) {
      this.failures += 1;
      await this.recordAttempt().catch(() => undefined);
      throw error;
    }
  }

  /** Deletes published rows past the retention period. */
  async purge(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - this.options.retentionDays * 24 * 60 * 60 * 1000);
    const deleted = await this.db
      .delete(outboxEvents)
      .where(and(isNotNull(outboxEvents.publishedAt), lt(outboxEvents.publishedAt, cutoff)))
      .returning({ id: outboxEvents.id });
    return deleted.length;
  }

  /** Counts the next batch's failed attempts (surfaced in logs and, later, metrics). */
  private async recordAttempt(): Promise<void> {
    const head = this.db
      .select({ id: outboxEvents.id })
      .from(outboxEvents)
      .where(isNull(outboxEvents.publishedAt))
      .orderBy(asc(outboxEvents.sequence))
      .limit(this.options.batchSize);
    await this.db
      .update(outboxEvents)
      .set({ attempts: sql`${outboxEvents.attempts} + 1` })
      .where(inArray(outboxEvents.id, head));
  }

  private schedule(delayMs: number): void {
    if (this.stopped) return;
    this.timer = setTimeout(() => {
      this.running = this.tick().finally(() => {
        this.running = undefined;
      });
    }, delayMs);
    this.timer.unref();
  }

  private async tick(): Promise<void> {
    let next = this.options.intervalMs;
    try {
      const published = await this.relayOnce();
      // A full batch means more is waiting: go again immediately.
      if (published === this.options.batchSize) next = 0;
      if (Date.now() - this.lastPurge > PURGE_EVERY_MS) {
        this.lastPurge = Date.now();
        const purged = await this.purge();
        if (purged > 0) this.options.logger.info({ purged }, 'purged published outbox rows');
      }
    } catch (error) {
      next = Math.min(this.options.intervalMs * 2 ** this.failures, MAX_BACKOFF_MS);
      this.options.logger.warn(
        { err: error, failures: this.failures, retryInMs: next },
        'outbox relay could not publish; will retry',
      );
    }
    this.schedule(next);
  }
}
