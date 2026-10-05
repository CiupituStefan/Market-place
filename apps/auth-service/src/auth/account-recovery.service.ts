import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { DATABASE, type Database } from '../db/database.js';
import { users } from '../db/schema.js';
import { OneTimeTokenService } from './one-time-tokens.service.js';
import { hashPassword } from './password.js';
import { SessionService } from './session.service.js';

@Injectable()
export class AccountRecoveryService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly sessions: SessionService,
    private readonly oneTimeTokens: OneTimeTokenService,
  ) {}

  /** Always succeeds from the caller's point of view: never reveals whether an account exists. */
  async requestPasswordReset(email: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [user] = await tx.select().from(users).where(eq(users.email, email));
      if (user) await this.oneTimeTokens.issue(tx, user, 'PASSWORD_RESET');
    });
  }

  /**
   * Sets the new password, signs out every device (a reset usually follows a
   * suspected compromise) and lifts any lockout. Following the emailed link also
   * proves ownership of the address.
   */
  async resetPassword(token: string, password: string): Promise<void> {
    const passwordHash = await hashPassword(password);
    await this.db.transaction(async (tx) => {
      const userId = await this.oneTimeTokens.consume(tx, token, 'PASSWORD_RESET');
      const now = new Date();
      await tx
        .update(users)
        .set({ passwordHash, failedLoginCount: 0, lockedUntil: null, updatedAt: now })
        .where(eq(users.id, userId));
      await tx
        .update(users)
        .set({ emailVerifiedAt: now })
        .where(and(eq(users.id, userId), isNull(users.emailVerifiedAt)));
      await this.sessions.revokeAllForUser(userId, 'password_reset', tx);
    });
  }

  async verifyEmail(token: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const userId = await this.oneTimeTokens.consume(tx, token, 'EMAIL_VERIFICATION');
      await tx
        .update(users)
        .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(users.id, userId), isNull(users.emailVerifiedAt)));
    });
  }

  async resendVerification(userId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [user] = await tx.select().from(users).where(eq(users.id, userId));
      if (user && !user.emailVerifiedAt)
        await this.oneTimeTokens.issue(tx, user, 'EMAIL_VERIFICATION');
    });
  }
}
