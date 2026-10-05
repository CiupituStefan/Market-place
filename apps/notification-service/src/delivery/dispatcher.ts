import {
  Inject,
  Injectable,
  Logger,
  type BeforeApplicationShutdown,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { and, asc, eq, isNotNull, lt, lte } from 'drizzle-orm';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { DATABASE, type Database } from '../db/database.js';
import { notificationLogs, type NotificationLogRow } from '../db/schema.js';
import { createUnsubscribeToken } from '../notifications/unsubscribe-token.js';
import { renderEmail, type Footer, type RenderedEmail } from '../templates/blocks.js';
import {
  isTemplate,
  renderTemplate,
  templateDefinitions,
  type Category,
} from '../templates/templates.js';
import { EMAIL_PROVIDER, PermanentDeliveryError, type EmailProvider } from './provider.js';

const BASE_BACKOFF_MS = 30_000;
const MAX_BACKOFF_MS = 3_600_000;

export interface DispatchResult {
  sent: number;
  retried: number;
  failed: number;
}

/**
 * Sends queued emails. Rows are claimed with FOR UPDATE SKIP LOCKED, so any
 * number of replicas can run it without sending the same email twice; a crash
 * after the provider accepted a message but before the row is marked SENT can
 * re-send it (at-least-once at the provider boundary, like every SMTP system).
 */
@Injectable()
export class Dispatcher implements OnApplicationBootstrap, BeforeApplicationShutdown {
  private readonly logger = new Logger(Dispatcher.name);
  private timer: NodeJS.Timeout | undefined;
  private running: Promise<unknown> | undefined;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(DATABASE) private readonly db: Database,
    @Inject(EMAIL_PROVIDER) private readonly provider: EmailProvider,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.config.DISPATCH_ENABLED) return;
    this.timer = setInterval(() => {
      this.running ??= this.dispatch()
        .catch((error: unknown) => {
          this.logger.error({ err: error }, 'dispatch failed');
        })
        .finally(() => {
          this.running = undefined;
        });
    }, this.config.DISPATCH_INTERVAL_MS);
    this.timer.unref();
  }

  async beforeApplicationShutdown(): Promise<void> {
    clearInterval(this.timer);
    await this.running;
  }

  /** One pass over due emails. Exposed for tests and the local CLI. */
  async dispatch(now = new Date()): Promise<DispatchResult> {
    const result: DispatchResult = { sent: 0, retried: 0, failed: 0 };
    await this.db.transaction(async (tx) => {
      const due = await tx
        .select()
        .from(notificationLogs)
        .where(and(eq(notificationLogs.status, 'QUEUED'), lte(notificationLogs.nextAttemptAt, now)))
        .orderBy(asc(notificationLogs.nextAttemptAt))
        .limit(this.config.DISPATCH_BATCH_SIZE)
        .for('update', { skipLocked: true });
      for (const row of due) {
        const outcome = await this.deliver(row);
        result[outcome.kind]++;
        await tx
          .update(notificationLogs)
          .set({ ...outcome.changes, attempts: row.attempts + 1, updatedAt: new Date() })
          .where(eq(notificationLogs.id, row.id));
      }
    });
    await this.eraseStaleData(now);
    return result;
  }

  private async deliver(row: NotificationLogRow): Promise<{
    kind: keyof DispatchResult;
    changes: Partial<NotificationLogRow>;
  }> {
    let email: RenderedEmail & { headers: Record<string, string> };
    try {
      email = this.render(row);
    } catch (error) {
      // Rendering is deterministic: retrying cannot help.
      this.logger.error({ err: error, notificationId: row.id }, 'email could not be rendered');
      return { kind: 'failed', changes: { status: 'FAILED', lastError: message(error) } };
    }
    try {
      const { messageId } = await this.provider.send({
        to: row.recipient,
        from: this.config.EMAIL_FROM,
        replyTo: this.config.EMAIL_REPLY_TO,
        subject: email.subject,
        html: email.html,
        text: email.text,
        headers: email.headers,
      });
      return {
        kind: 'sent',
        changes: {
          status: 'SENT',
          subject: email.subject,
          providerMessageId: messageId,
          sentAt: new Date(),
          lastError: null,
          // Single-use links and order details are no longer needed once delivered.
          data: null,
        },
      };
    } catch (error) {
      const attempts = row.attempts + 1;
      const permanent = error instanceof PermanentDeliveryError;
      if (permanent || attempts >= this.config.DISPATCH_MAX_ATTEMPTS) {
        this.logger.error(
          { err: error, notificationId: row.id, template: row.template, attempts },
          'email delivery failed for good',
        );
        return {
          kind: 'failed',
          changes: { status: 'FAILED', subject: email.subject, lastError: message(error) },
        };
      }
      const delay = Math.min(BASE_BACKOFF_MS * 2 ** (attempts - 1), MAX_BACKOFF_MS);
      this.logger.warn(
        { err: error, notificationId: row.id, attempts, retryInMs: delay },
        'email delivery failed, will retry',
      );
      return {
        kind: 'retried',
        changes: { nextAttemptAt: new Date(Date.now() + delay), lastError: message(error) },
      };
    }
  }

  render(row: NotificationLogRow): RenderedEmail & { headers: Record<string, string> } {
    if (!isTemplate(row.template)) throw new Error(`Unknown template ${row.template}`);
    const content = renderTemplate(row.template, row.data ?? {}, { webUrl: this.config.WEB_URL });
    const footer = this.footer(row, templateDefinitions[row.template].category);
    const headers: Record<string, string> = { 'X-Entity-Ref-ID': row.id };
    if (footer.oneClickUrl) {
      // RFC 8058: mail clients show an "Unsubscribe" button that POSTs here.
      headers['List-Unsubscribe'] = `<${footer.oneClickUrl}>`;
      headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
    }
    return { ...renderEmail(content, footer), headers };
  }

  private footer(
    row: NotificationLogRow,
    category: Category,
  ): Footer & { oneClickUrl: string | null } {
    const links = (claim: Parameters<typeof createUnsubscribeToken>[1]) => {
      const token = createUnsubscribeToken(this.config.UNSUBSCRIBE_SECRET, claim);
      const page = new URL('/unsubscribe', this.config.WEB_URL);
      page.searchParams.set('token', token);
      const oneClick = new URL('/api/v1/notifications/unsubscribe', this.config.PUBLIC_API_URL);
      oneClick.searchParams.set('token', token);
      return { unsubscribeUrl: page.toString(), oneClickUrl: oneClick.toString() };
    };
    switch (category) {
      case 'security':
        return {
          reason: 'You received this email because of a request made with this address.',
          unsubscribeUrl: null,
          oneClickUrl: null,
        };
      case 'transactional':
        return {
          reason: 'You received this email because you placed an order at CSE Keyboards.',
          unsubscribeUrl: null,
          oneClickUrl: null,
        };
      case 'order-updates':
        return row.userId
          ? {
              reason: 'Shipping updates for your order. You can turn them off in your account.',
              ...links({ scope: 'order-updates', userId: row.userId }),
            }
          : {
              reason: 'Shipping updates for the order you placed at CSE Keyboards.',
              unsubscribeUrl: null,
              oneClickUrl: null,
            };
      case 'newsletter':
        return {
          reason: 'You subscribed to the CSE Keyboards newsletter.',
          ...links({ scope: 'newsletter', email: row.recipient }),
        };
    }
  }

  /** Failed emails keep their data for a manual retry, but not forever. */
  private async eraseStaleData(now: Date): Promise<void> {
    const before = new Date(now.getTime() - this.config.FAILED_DATA_RETENTION_DAYS * 86_400_000);
    await this.db
      .update(notificationLogs)
      .set({ data: null })
      .where(
        and(
          eq(notificationLogs.status, 'FAILED'),
          isNotNull(notificationLogs.data),
          lt(notificationLogs.updatedAt, before),
        ),
      );
  }
}

const message = (error: unknown) =>
  (error instanceof Error ? error.message : String(error)).slice(0, 500);
