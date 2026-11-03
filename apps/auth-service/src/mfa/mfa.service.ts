import { DomainError, ErrorCode } from '@market/types';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, isNull, lt, or, sql } from 'drizzle-orm';
import { verifyPassword } from '../auth/password.js';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { DATABASE, type Database } from '../db/database.js';
import { mfaRecoveryCodes, oneTimeTokens, users, type UserRow } from '../db/schema.js';
import { generateOpaqueToken, hashOpaqueToken } from '../tokens/opaque-token.js';
import {
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  otpauthUri,
  SecretBox,
  verifyTotp,
} from './totp.js';

/** Roles that only a session which passed the second factor receives. */
export const PRIVILEGED_ROLES = ['STAFF', 'ADMIN'] as const;

export function isPrivileged(roles: readonly string[]): boolean {
  return roles.some((role) => (PRIVILEGED_ROLES as readonly string[]).includes(role));
}

export function mfaEnabled(user: Pick<UserRow, 'totpEnabledAt' | 'totpSecret'>): boolean {
  return user.totpEnabledAt !== null && user.totpSecret !== null;
}

const invalidCode = () =>
  new DomainError(ErrorCode.INVALID_MFA_CODE, 'That code is not valid. Try the current one.');

/**
 * Second factor: TOTP from an authenticator app, or a single-use recovery code. Sign-in with
 * MFA is two requests: the password returns a short-lived challenge, the code redeems it
 * (AuthService). Setting MFA up is: `setup` (password again) → scan → `enable` with a code.
 */
@Injectable()
export class MfaService {
  private readonly box: SecretBox;

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {
    this.box = new SecretBox(config.MFA_ENCRYPTION_KEY);
  }

  // ── sign-in challenge ──────────────────────────────────────────────────────

  /** Password accepted: a single-use challenge for the second step (newer ones replace older). */
  async createChallenge(user: UserRow): Promise<string> {
    const challenge = generateOpaqueToken();
    const now = new Date();
    await this.db.transaction(async (tx) => {
      await tx
        .update(oneTimeTokens)
        .set({ usedAt: now })
        .where(
          and(
            eq(oneTimeTokens.userId, user.id),
            eq(oneTimeTokens.purpose, 'MFA_CHALLENGE'),
            isNull(oneTimeTokens.usedAt),
          ),
        );
      await tx.insert(oneTimeTokens).values({
        userId: user.id,
        purpose: 'MFA_CHALLENGE',
        tokenHash: hashOpaqueToken(challenge),
        expiresAt: new Date(now.getTime() + this.config.MFA_CHALLENGE_MINUTES * 60_000),
      });
    });
    return challenge;
  }

  /** The user a live challenge belongs to; an unknown, used or expired one means start again. */
  async challengeUser(challenge: string): Promise<{ user: UserRow; challengeId: string }> {
    const [row] = await this.db
      .select({ user: users, challengeId: oneTimeTokens.id })
      .from(oneTimeTokens)
      .innerJoin(users, eq(users.id, oneTimeTokens.userId))
      .where(
        and(
          eq(oneTimeTokens.tokenHash, hashOpaqueToken(challenge)),
          eq(oneTimeTokens.purpose, 'MFA_CHALLENGE'),
          isNull(oneTimeTokens.usedAt),
          gt(oneTimeTokens.expiresAt, new Date()),
        ),
      );
    if (!row) {
      throw new DomainError(
        ErrorCode.INVALID_TOKEN,
        'This sign-in has expired. Please start again.',
      );
    }
    return row;
  }

  /** Spends a challenge; false if another request already did (two tabs, a replay). */
  async consumeChallenge(challengeId: string, tx: Database): Promise<boolean> {
    const spent = await tx
      .update(oneTimeTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(oneTimeTokens.id, challengeId), isNull(oneTimeTokens.usedAt)))
      .returning({ id: oneTimeTokens.id });
    return spent.length === 1;
  }

  /**
   * Checks a code against an enabled factor and records its use atomically: a TOTP step can be
   * spent once (concurrent requests with the same code: only one wins), a recovery code once.
   */
  async verifyCode(user: UserRow, code: string, tx: Database = this.db): Promise<boolean> {
    if (!mfaEnabled(user) || user.totpSecret === null) return false;
    const trimmed = code.replace(/\s/g, '');
    if (/^\d{6}$/.test(trimmed)) {
      const step = verifyTotp(this.box.open(user.totpSecret), trimmed, {
        lastUsedStep: user.totpLastStep,
      });
      if (step === null) return false;
      const recorded = await tx
        .update(users)
        .set({ totpLastStep: step })
        .where(
          and(eq(users.id, user.id), or(isNull(users.totpLastStep), lt(users.totpLastStep, step))),
        )
        .returning({ id: users.id });
      return recorded.length === 1;
    }
    const used = await tx
      .update(mfaRecoveryCodes)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(mfaRecoveryCodes.userId, user.id),
          eq(mfaRecoveryCodes.codeHash, hashRecoveryCode(code)),
          isNull(mfaRecoveryCodes.usedAt),
        ),
      )
      .returning({ id: mfaRecoveryCodes.id });
    return used.length === 1;
  }

  // ── managing the factor ────────────────────────────────────────────────────

  /** Starts (or restarts) setup. Asks for the password again: a stolen session is not enough. */
  async startSetup(
    userId: string,
    password: string,
  ): Promise<{ secret: string; otpauthUri: string }> {
    const user = await this.requireUser(userId);
    if (mfaEnabled(user)) {
      throw new DomainError(ErrorCode.CONFLICT, 'Two-step sign-in is already on.');
    }
    await this.requirePassword(user, password);
    const secret = generateTotpSecret();
    await this.db
      .update(users)
      .set({ totpSecret: this.box.seal(secret), totpLastStep: null, updatedAt: new Date() })
      .where(eq(users.id, user.id));
    return { secret, otpauthUri: otpauthUri(secret, user.email, this.config.MFA_ISSUER) };
  }

  /**
   * Turns MFA on once a code from the new authenticator checks out, and returns the recovery
   * codes (shown once; only their hashes are kept). The caller signs every session out, so the
   * next sign-in uses the second factor.
   */
  async enable(userId: string, code: string, tx: Database): Promise<string[]> {
    const user = await this.requireUser(userId, tx);
    if (mfaEnabled(user)) {
      throw new DomainError(ErrorCode.CONFLICT, 'Two-step sign-in is already on.');
    }
    if (!user.totpSecret) {
      throw new DomainError(ErrorCode.CONFLICT, 'Start the setup first.');
    }
    const step = verifyTotp(this.box.open(user.totpSecret), code.replace(/\s/g, ''));
    if (step === null) throw invalidCode();
    await tx
      .update(users)
      .set({ totpEnabledAt: new Date(), totpLastStep: step, updatedAt: new Date() })
      .where(eq(users.id, user.id));
    const codes = generateRecoveryCodes();
    await tx.delete(mfaRecoveryCodes).where(eq(mfaRecoveryCodes.userId, user.id));
    await tx
      .insert(mfaRecoveryCodes)
      .values(codes.map((c) => ({ userId: user.id, codeHash: hashRecoveryCode(c) })));
    return codes;
  }

  /** Turns MFA off: password and a current code (or a recovery code) both required. */
  async disable(userId: string, password: string, code: string, tx: Database): Promise<void> {
    const user = await this.requireUser(userId, tx);
    if (!mfaEnabled(user)) {
      throw new DomainError(ErrorCode.CONFLICT, 'Two-step sign-in is already off.');
    }
    await this.requirePassword(user, password);
    if (!(await this.verifyCode(user, code, tx))) throw invalidCode();
    await tx
      .update(users)
      .set({ totpSecret: null, totpEnabledAt: null, totpLastStep: null, updatedAt: new Date() })
      .where(eq(users.id, user.id));
    await tx.delete(mfaRecoveryCodes).where(eq(mfaRecoveryCodes.userId, user.id));
  }

  async isEnabledFor(userId: string): Promise<boolean> {
    return mfaEnabled(await this.requireUser(userId));
  }

  async recoveryCodesLeft(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(mfaRecoveryCodes)
      .where(and(eq(mfaRecoveryCodes.userId, userId), isNull(mfaRecoveryCodes.usedAt)));
    return row?.n ?? 0;
  }

  private async requireUser(userId: string, tx: Database = this.db): Promise<UserRow> {
    const [user] = await tx.select().from(users).where(eq(users.id, userId));
    if (!user) throw new DomainError(ErrorCode.UNAUTHENTICATED, 'Authentication required');
    return user;
  }

  private async requirePassword(user: UserRow, password: string): Promise<void> {
    if (!(await verifyPassword(user.passwordHash, password))) {
      throw new DomainError(ErrorCode.INVALID_CREDENTIALS, 'That password is not correct.');
    }
  }
}
