import { createHash, randomBytes } from 'node:crypto';
import { DomainError, ErrorCode } from '@market/types';
import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { DATABASE, type Database } from '../db/database.js';
import { newsletterSubscribers } from '../db/schema.js';
import { normalizeEmail, NotificationService } from '../notifications/notification.service.js';

const CONFIRM_TTL_MS = 7 * 86_400_000;
/** At most one confirmation email per address per window (the form is public). */
const RESEND_COOLDOWN_MS = 10 * 60_000;

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/**
 * Double opt-in newsletter: an address is only mailed after its owner clicked
 * the confirmation link (GDPR consent, and nobody can sign up someone else).
 * Public endpoints never reveal whether an address is on the list.
 */
@Injectable()
export class NewsletterService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly notifications: NotificationService,
  ) {}

  /** Starts (or restarts) double opt-in. Silent no-op when already subscribed or throttled. */
  async subscribe(rawEmail: string, source: string, now = new Date()): Promise<void> {
    const email = normalizeEmail(rawEmail);
    await this.db.transaction(async (tx) => {
      // Lock (or create) the row so two concurrent submits send one email.
      await tx
        .insert(newsletterSubscribers)
        .values({ email, status: 'PENDING', source })
        .onConflictDoNothing();
      const [row] = await tx
        .select()
        .from(newsletterSubscribers)
        .where(eq(newsletterSubscribers.email, email))
        .for('update');
      if (!row || row.status === 'SUBSCRIBED') return;
      if (row.confirmSentAt && now.getTime() - row.confirmSentAt.getTime() < RESEND_COOLDOWN_MS)
        return;

      const token = randomBytes(32).toString('base64url');
      const tokenHash = hashToken(token);
      await tx
        .update(newsletterSubscribers)
        .set({
          status: 'PENDING',
          confirmTokenHash: tokenHash,
          confirmExpiresAt: new Date(now.getTime() + CONFIRM_TTL_MS),
          confirmSentAt: now,
          source,
          updatedAt: now,
        })
        .where(eq(newsletterSubscribers.email, email));
      const link = new URL('/newsletter/confirm', this.config.WEB_URL);
      link.searchParams.set('token', token);
      await this.notifications.enqueue(tx, {
        key: `newsletter-confirm:${tokenHash}`,
        template: 'NEWSLETTER_CONFIRM',
        recipient: { userId: null, email },
        data: { link: link.toString() },
      });
    });
  }

  /** Confirms a subscription from the emailed link. Clicking twice is fine. */
  async confirm(token: string, now = new Date()): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(newsletterSubscribers)
        .where(eq(newsletterSubscribers.confirmTokenHash, hashToken(token)))
        .for('update');
      if (row?.status === 'SUBSCRIBED') return;
      if (
        row?.status !== 'PENDING' ||
        !row.confirmExpiresAt ||
        row.confirmExpiresAt.getTime() < now.getTime()
      ) {
        throw new DomainError(ErrorCode.INVALID_TOKEN, 'This link is invalid or has expired');
      }
      await this.markSubscribed(tx, row.email, row.source, now);
    });
  }

  /**
   * From the account page: a verified account email needs no confirmation link
   * (the owner already proved it); an unverified one goes through double opt-in.
   */
  async setForAccount(
    user: { email: string; emailVerified: boolean },
    subscribed: boolean,
    now = new Date(),
  ): Promise<void> {
    if (!subscribed) {
      await this.unsubscribe(user.email, now);
      return;
    }
    if (!user.emailVerified) {
      await this.subscribe(user.email, 'account', now);
      return;
    }
    const email = normalizeEmail(user.email);
    await this.db.transaction(async (tx) => {
      await tx
        .insert(newsletterSubscribers)
        .values({ email, status: 'PENDING', source: 'account' })
        .onConflictDoNothing();
      const [row] = await tx
        .select()
        .from(newsletterSubscribers)
        .where(eq(newsletterSubscribers.email, email))
        .for('update');
      if (row?.status === 'SUBSCRIBED') return;
      await this.markSubscribed(tx, email, 'account', now);
    });
  }

  async unsubscribe(rawEmail: string, now = new Date()): Promise<void> {
    await this.db
      .update(newsletterSubscribers)
      .set({ status: 'UNSUBSCRIBED', unsubscribedAt: now, confirmTokenHash: null, updatedAt: now })
      .where(eq(newsletterSubscribers.email, normalizeEmail(rawEmail)));
  }

  private async markSubscribed(tx: Database, email: string, source: string, now: Date) {
    await tx
      .update(newsletterSubscribers)
      .set({ status: 'SUBSCRIBED', subscribedAt: now, source, updatedAt: now })
      .where(eq(newsletterSubscribers.email, email));
    await this.notifications.enqueue(tx, {
      // One welcome per subscription (re-subscribing later welcomes again).
      key: `newsletter-welcome:${email}:${now.getTime()}`,
      template: 'NEWSLETTER_WELCOME',
      recipient: { userId: null, email },
      data: {},
    });
  }
}
