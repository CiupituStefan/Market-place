import { PermanentEventError } from '@market/messaging';
import {
  DomainError,
  ErrorCode,
  type NewsletterState,
  type NotificationLog,
  type NotificationPreferences,
} from '@market/types';
import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, type SQL } from 'drizzle-orm';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { DATABASE, type Database } from '../db/database.js';
import {
  newsletterSubscribers,
  notificationLogs,
  notificationPreferences,
  type NotificationLogRow,
} from '../db/schema.js';
import { templateDefinitions, type TemplateName } from '../templates/templates.js';

export interface NotificationRequest {
  /** Idempotency key: the same key is queued (and sent) at most once. */
  key: string;
  template: TemplateName;
  recipient: { userId: string | null; email: string };
  data: Record<string, unknown>;
  correlationId?: string | null;
  /** When the triggering event happened; stale events are not emailed. */
  occurredAt?: string | undefined;
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/**
 * The notification queue. Callers decide *that* something should be sent; this
 * decides *whether* (preferences, newsletter status) and records the decision,
 * once per key. Delivery happens later in the dispatcher.
 */
@Injectable()
export class NotificationService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Queues a notification inside the caller's transaction. Returns false for a duplicate key. */
  async enqueue(tx: Database, request: NotificationRequest): Promise<boolean> {
    const definition = templateDefinitions[request.template];
    const data = definition.data.safeParse(request.data);
    if (!data.success) {
      // A producer bug, not a transient failure: straight to the dead-letter topic.
      throw new PermanentEventError(
        `Invalid data for ${request.template}: ${data.error.issues.map((i) => i.path.join('.')).join(', ')}`,
      );
    }
    const suppressedReason = await this.suppression(tx, request);
    const [row] = await tx
      .insert(notificationLogs)
      .values({
        notificationKey: request.key,
        template: request.template,
        userId: request.recipient.userId,
        recipient: normalizeEmail(request.recipient.email),
        data: suppressedReason ? null : (data.data as Record<string, unknown>),
        status: suppressedReason ? 'SUPPRESSED' : 'QUEUED',
        suppressedReason,
        correlationId: request.correlationId ?? null,
      })
      .onConflictDoNothing({ target: notificationLogs.notificationKey })
      .returning({ id: notificationLogs.id });
    return row !== undefined;
  }

  private async suppression(tx: Database, request: NotificationRequest): Promise<string | null> {
    if (
      request.occurredAt &&
      Date.now() - new Date(request.occurredAt).getTime() >
        this.config.MAX_EVENT_AGE_HOURS * 3_600_000
    ) {
      return 'event too old';
    }
    const { category } = templateDefinitions[request.template];
    if (category === 'order-updates' && request.recipient.userId) {
      const [prefs] = await tx
        .select({ orderUpdates: notificationPreferences.orderUpdates })
        .from(notificationPreferences)
        .where(eq(notificationPreferences.userId, request.recipient.userId));
      if (prefs && !prefs.orderUpdates) return 'order updates turned off';
    }
    if (category === 'newsletter') {
      const state = await this.newsletterState(tx, request.recipient.email);
      if (state !== 'SUBSCRIBED') return 'not subscribed to the newsletter';
    }
    return null;
  }

  async newsletterState(db: Database, email: string): Promise<NewsletterState> {
    const [row] = await db
      .select({ status: newsletterSubscribers.status })
      .from(newsletterSubscribers)
      .where(eq(newsletterSubscribers.email, normalizeEmail(email)));
    return row?.status ?? 'NONE';
  }

  // ── preferences ────────────────────────────────────────────────────────────

  async preferences(userId: string, email: string | undefined): Promise<NotificationPreferences> {
    const [prefs] = await this.db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId));
    return {
      orderUpdates: prefs?.orderUpdates ?? true,
      newsletter: email ? await this.newsletterState(this.db, email) : 'NONE',
    };
  }

  async setOrderUpdates(db: Database, userId: string, enabled: boolean): Promise<void> {
    await db
      .insert(notificationPreferences)
      .values({ userId, orderUpdates: enabled })
      .onConflictDoUpdate({
        target: notificationPreferences.userId,
        set: { orderUpdates: enabled, updatedAt: new Date() },
      });
  }

  // ── back office ────────────────────────────────────────────────────────────

  async logs(filter: {
    status?: NotificationLogRow['status'] | undefined;
    recipient?: string | undefined;
    page: number;
    pageSize: number;
  }): Promise<{ items: NotificationLog[]; total: number; page: number; pageSize: number }> {
    const conditions: SQL[] = [];
    if (filter.status) conditions.push(eq(notificationLogs.status, filter.status));
    if (filter.recipient)
      conditions.push(eq(notificationLogs.recipient, normalizeEmail(filter.recipient)));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const [rows, [total]] = await Promise.all([
      this.db
        .select()
        .from(notificationLogs)
        .where(where)
        .orderBy(desc(notificationLogs.createdAt))
        .limit(filter.pageSize)
        .offset((filter.page - 1) * filter.pageSize),
      this.db.select({ value: count() }).from(notificationLogs).where(where),
    ]);
    return {
      items: rows.map(toLog),
      total: total?.value ?? 0,
      page: filter.page,
      pageSize: filter.pageSize,
    };
  }

  /** Puts a FAILED email back in the queue (e.g. after fixing the SES configuration). */
  async retry(id: string): Promise<NotificationLog> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(notificationLogs)
        .where(eq(notificationLogs.id, id))
        .for('update');
      if (!row) throw new DomainError(ErrorCode.NOT_FOUND, 'Notification not found');
      if (row.status === 'QUEUED') return toLog(row);
      if (row.status !== 'FAILED' || row.data === null) {
        throw new DomainError(
          ErrorCode.CONFLICT,
          row.status === 'FAILED'
            ? 'This email can no longer be re-sent: its data was erased'
            : `A ${row.status.toLowerCase()} email cannot be re-sent`,
        );
      }
      const [updated] = await tx
        .update(notificationLogs)
        .set({
          status: 'QUEUED',
          attempts: 0,
          nextAttemptAt: new Date(),
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(notificationLogs.id, id))
        .returning();
      return toLog(updated ?? row);
    });
  }
}

export function toLog(row: NotificationLogRow): NotificationLog {
  return {
    id: row.id,
    template: row.template,
    recipient: row.recipient,
    userId: row.userId,
    status: row.status,
    subject: row.subject,
    attempts: row.attempts,
    lastError: row.lastError,
    suppressedReason: row.suppressedReason,
    providerMessageId: row.providerMessageId,
    resendable: row.status === 'FAILED' && row.data !== null,
    createdAt: row.createdAt.toISOString(),
    sentAt: row.sentAt?.toISOString() ?? null,
  };
}
