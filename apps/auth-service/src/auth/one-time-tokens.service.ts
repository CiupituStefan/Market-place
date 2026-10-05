import { NotificationRequestedV1 } from '@market/events';
import { DomainError, ErrorCode } from '@market/types';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { APP_CONFIG, type AppConfig } from '../config.js';
import type { Database } from '../db/database.js';
import { oneTimeTokens, type UserRow } from '../db/schema.js';
import { enqueueEvent } from '../outbox/outbox.js';
import { generateOpaqueToken, hashOpaqueToken } from '../tokens/opaque-token.js';

type Purpose = 'EMAIL_VERIFICATION' | 'PASSWORD_RESET';

const SETTINGS: Record<
  Purpose,
  { ttlMs: number; path: string; template: 'EMAIL_VERIFICATION' | 'PASSWORD_RESET' }
> = {
  EMAIL_VERIFICATION: {
    ttlMs: 24 * 3_600_000,
    path: '/verify-email',
    template: 'EMAIL_VERIFICATION',
  },
  PASSWORD_RESET: { ttlMs: 3_600_000, path: '/reset-password', template: 'PASSWORD_RESET' },
};

/**
 * Emailed single-use links. Issuing a new token invalidates older unused ones of
 * the same purpose; the email itself is requested through the outbox.
 */
@Injectable()
export class OneTimeTokenService {
  private readonly logger = new Logger(OneTimeTokenService.name);

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async issue(tx: Database, user: UserRow, purpose: Purpose): Promise<void> {
    const settings = SETTINGS[purpose];
    const now = new Date();
    await tx
      .update(oneTimeTokens)
      .set({ usedAt: now })
      .where(
        and(
          eq(oneTimeTokens.userId, user.id),
          eq(oneTimeTokens.purpose, purpose),
          isNull(oneTimeTokens.usedAt),
        ),
      );

    const token = generateOpaqueToken();
    const expiresAt = new Date(now.getTime() + settings.ttlMs);
    const [row] = await tx
      .insert(oneTimeTokens)
      .values({ userId: user.id, purpose, tokenHash: hashOpaqueToken(token), expiresAt })
      .returning({ id: oneTimeTokens.id });

    const link = new URL(settings.path, this.config.WEB_URL);
    link.searchParams.set('token', token);
    await enqueueEvent(
      tx,
      NotificationRequestedV1,
      {
        // One email per token: redelivered events never send it twice.
        notificationKey: `${purpose}:${row?.id ?? token}`,
        channel: 'EMAIL',
        template: settings.template,
        recipient: { userId: user.id, email: user.email },
        data: {
          firstName: user.firstName,
          link: link.toString(),
          expiresAt: expiresAt.toISOString(),
        },
      },
      user.id,
    );

    if (this.config.DEV_LOG_EMAIL_LINKS) {
      this.logger.warn(`[development only] ${purpose} link for ${user.email}: ${link.toString()}`);
    }
  }

  /** Marks the token used and returns its user id; throws INVALID_TOKEN otherwise. */
  async consume(tx: Database, rawToken: string, purpose: Purpose): Promise<string> {
    const [row] = await tx
      .update(oneTimeTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(oneTimeTokens.tokenHash, hashOpaqueToken(rawToken)),
          eq(oneTimeTokens.purpose, purpose),
          isNull(oneTimeTokens.usedAt),
          gt(oneTimeTokens.expiresAt, new Date()),
        ),
      )
      .returning({ userId: oneTimeTokens.userId });
    if (!row) throw new DomainError(ErrorCode.INVALID_TOKEN, 'This link is invalid or has expired');
    return row.userId;
  }
}
