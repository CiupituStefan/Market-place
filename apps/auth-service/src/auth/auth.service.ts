import { isUniqueViolation } from '@market/db';
import { DomainError, ErrorCode, type Locale } from '@market/types';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { DATABASE, type Database } from '../db/database.js';
import { users, type UserRow } from '../db/schema.js';
import type { IssuedTokens } from './cookies.js';
import { MfaService, mfaEnabled } from '../mfa/mfa.service.js';
import type { LoginInput, MfaLoginInput, RegisterInput } from './dto.js';
import { OneTimeTokenService } from './one-time-tokens.service.js';
import { burnPasswordCheck, hashPassword, needsRehash, verifyPassword } from './password.js';
import { SessionService, type ClientInfo } from './session.service.js';

const invalidCredentials = () =>
  new DomainError(ErrorCode.INVALID_CREDENTIALS, 'Invalid email or password');

const invalidMfaCode = () =>
  new DomainError(ErrorCode.INVALID_MFA_CODE, 'That code is not valid. Try the current one.');

/** A password sign-in either opens a session or, with two-step sign-in on, asks for a code. */
export type LoginResult =
  { kind: 'session'; user: UserRow; tokens: IssuedTokens } | { kind: 'mfa'; challenge: string };

/** Thrown inside the sign-in transaction to roll it back when the code is refused. */
class RefusedCode extends Error {}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly sessions: SessionService,
    private readonly oneTimeTokens: OneTimeTokenService,
    private readonly mfa: MfaService,
  ) {}

  async register(input: RegisterInput, locale: Locale = 'en'): Promise<UserRow> {
    const passwordHash = await hashPassword(input.password);
    try {
      return await this.db.transaction(async (tx) => {
        const [user] = await tx
          .insert(users)
          .values({
            email: input.email,
            passwordHash,
            firstName: input.firstName,
            lastName: input.lastName,
          })
          .returning();
        if (!user) throw new Error('user insert returned no row');
        await this.oneTimeTokens.issue(tx, user, 'EMAIL_VERIFICATION', locale);
        return user;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DomainError(
          ErrorCode.EMAIL_ALREADY_REGISTERED,
          'An account with this email already exists',
        );
      }
      throw error;
    }
  }

  async login(input: LoginInput, client: ClientInfo): Promise<LoginResult> {
    const [user] = await this.db.select().from(users).where(eq(users.email, input.email));
    if (!user) {
      await burnPasswordCheck(input.password);
      throw invalidCredentials();
    }
    // Locked accounts get the same answer as wrong passwords: no account-state oracle.
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await burnPasswordCheck(input.password);
      throw invalidCredentials();
    }

    if (!(await verifyPassword(user.passwordHash, input.password))) {
      await this.recordFailure(user);
      throw invalidCredentials();
    }

    const passwordHash = needsRehash(user.passwordHash)
      ? await hashPassword(input.password)
      : user.passwordHash;
    if (mfaEnabled(user)) {
      // The failure counter is only reset once the second factor passes too.
      if (passwordHash !== user.passwordHash) {
        await this.db.update(users).set({ passwordHash }).where(eq(users.id, user.id));
      }
      return { kind: 'mfa', challenge: await this.mfa.createChallenge(user) };
    }
    return this.db.transaction(async (tx) => {
      const [fresh] = await tx
        .update(users)
        .set({ failedLoginCount: 0, lockedUntil: null, passwordHash, updatedAt: new Date() })
        .where(eq(users.id, user.id))
        .returning();
      const current = fresh ?? user;
      return {
        kind: 'session' as const,
        user: current,
        tokens: await this.sessions.createSession(current, client, tx),
      };
    });
  }

  /**
   * Second step: redeems the challenge with a TOTP or recovery code. Wrong codes count towards
   * the same lockout as wrong passwords, so the 10^6 codes cannot be tried at leisure.
   */
  async loginWithMfa(
    input: MfaLoginInput,
    client: ClientInfo,
  ): Promise<{ user: UserRow; tokens: IssuedTokens }> {
    const { user, challengeId } = await this.mfa.challengeUser(input.challenge);
    if (user.lockedUntil && user.lockedUntil > new Date()) throw invalidMfaCode();
    try {
      return await this.db.transaction(async (tx) => {
        if (!(await this.mfa.verifyCode(user, input.code, tx))) throw new RefusedCode();
        if (!(await this.mfa.consumeChallenge(challengeId, tx))) throw new RefusedCode();
        const [fresh] = await tx
          .update(users)
          .set({ failedLoginCount: 0, lockedUntil: null, updatedAt: new Date() })
          .where(eq(users.id, user.id))
          .returning();
        const current = fresh ?? user;
        return {
          user: current,
          tokens: await this.sessions.createSession(current, client, tx, true),
        };
      });
    } catch (error) {
      if (!(error instanceof RefusedCode)) throw error;
      await this.recordFailure(user);
      throw invalidMfaCode();
    }
  }

  async findActiveUser(userId: string, sessionId: string): Promise<UserRow> {
    if (!(await this.sessions.isActive(sessionId))) {
      throw new DomainError(
        ErrorCode.UNAUTHENTICATED,
        'Your session has ended. Please sign in again.',
      );
    }
    const [user] = await this.db.select().from(users).where(eq(users.id, userId));
    if (!user) throw new DomainError(ErrorCode.UNAUTHENTICATED, 'Authentication required');
    return user;
  }

  /** Atomic counter update; after N consecutive failures the account locks for a while. */
  private async recordFailure(user: UserRow): Promise<void> {
    const max = this.config.LOGIN_MAX_FAILURES;
    const lockout = `${this.config.LOGIN_LOCKOUT_MINUTES} minutes`;
    const [updated] = await this.db
      .update(users)
      .set({
        failedLoginCount: sql`CASE WHEN ${users.failedLoginCount} + 1 >= ${max} THEN 0 ELSE ${users.failedLoginCount} + 1 END`,
        lockedUntil: sql`CASE WHEN ${users.failedLoginCount} + 1 >= ${max} THEN now() + ${lockout}::interval ELSE ${users.lockedUntil} END`,
      })
      .where(eq(users.id, user.id))
      .returning({ lockedUntil: users.lockedUntil });
    if (updated?.lockedUntil && updated.lockedUntil > new Date()) {
      this.logger.warn(`account ${user.id} locked after ${max} failed sign-ins`);
    }
  }
}
