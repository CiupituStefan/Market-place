import { DomainError, ErrorCode, type Role } from '@market/types';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { DATABASE, type Database } from '../db/database.js';
import { refreshTokens, sessions, users, type UserRow } from '../db/schema.js';
import { isPrivileged } from '../mfa/mfa.service.js';
import { generateOpaqueToken, hashOpaqueToken } from '../tokens/opaque-token.js';
import { SigningKeys } from '../tokens/signing-keys.js';
import type { IssuedTokens } from './cookies.js';

export interface ClientInfo {
  userAgent: string | undefined;
  ip: string | undefined;
}

const DAY_MS = 86_400_000;

/**
 * The roles a session acts with. STAFF and ADMIN reach customers' data and the shop's settings,
 * so they need a session that passed the second factor; without it the account works as a
 * customer's (and can turn two-step sign-in on). Every service enforces roles from this token.
 */
export function sessionRoles(roles: Role[], mfaVerified: boolean): Role[] {
  return mfaVerified || !isPrivileged(roles) ? roles : roles.filter((role) => role === 'USER');
}

function unauthenticated(message = 'Your session has ended. Please sign in again.'): DomainError {
  return new DomainError(ErrorCode.UNAUTHENTICATED, message);
}

/**
 * Session lifecycle: issue, rotate and revoke. Refresh tokens rotate on every
 * use; presenting an already-rotated token (outside a short grace window) is
 * treated as theft and revokes the whole session.
 */
@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly keys: SigningKeys,
  ) {}

  /** `mfaVerified`: the sign-in passed the second factor (what that unlocks: `sessionRoles`). */
  async createSession(
    user: UserRow,
    client: ClientInfo,
    tx: Database = this.db,
    mfaVerified = false,
  ): Promise<IssuedTokens> {
    const expiresAt = new Date(Date.now() + this.config.SESSION_TTL_DAYS * DAY_MS);
    const mfaVerifiedAt = mfaVerified ? new Date() : null;
    const [session] = await tx
      .insert(sessions)
      .values({
        userId: user.id,
        expiresAt,
        userAgent: client.userAgent?.slice(0, 512),
        ip: client.ip,
        mfaVerifiedAt,
      })
      .returning({ id: sessions.id });
    if (!session) throw new Error('session insert returned no row');
    const refreshToken = generateOpaqueToken();
    await tx
      .insert(refreshTokens)
      .values({ sessionId: session.id, tokenHash: hashOpaqueToken(refreshToken), expiresAt });
    return this.issue(user, session.id, refreshToken, expiresAt, mfaVerifiedAt !== null);
  }

  async rotate(
    rawRefreshToken: string | undefined,
  ): Promise<{ user: UserRow; tokens: IssuedTokens }> {
    if (!rawRefreshToken) throw unauthenticated();
    const tokenHash = hashOpaqueToken(rawRefreshToken);

    const outcome = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .select({ token: refreshTokens, session: sessions, user: users })
        .from(refreshTokens)
        .innerJoin(sessions, eq(sessions.id, refreshTokens.sessionId))
        .innerJoin(users, eq(users.id, sessions.userId))
        .where(eq(refreshTokens.tokenHash, tokenHash))
        // Serialises concurrent refreshes of the same token.
        .for('update', { of: refreshTokens });
      if (!row) return { kind: 'invalid' as const };

      const now = new Date();
      if (row.session.revokedAt || row.session.expiresAt <= now || row.token.expiresAt <= now) {
        return { kind: 'invalid' as const };
      }
      if (row.token.usedAt) {
        const sinceUse = now.getTime() - row.token.usedAt.getTime();
        if (sinceUse <= this.config.REFRESH_REUSE_GRACE_SECONDS * 1000)
          return { kind: 'race' as const };
        await this.revokeSession(row.session.id, 'refresh_token_reuse', tx);
        return { kind: 'reuse' as const, sessionId: row.session.id, userId: row.user.id };
      }

      await tx.update(refreshTokens).set({ usedAt: now }).where(eq(refreshTokens.id, row.token.id));
      const next = generateOpaqueToken();
      await tx.insert(refreshTokens).values({
        sessionId: row.session.id,
        tokenHash: hashOpaqueToken(next),
        expiresAt: row.session.expiresAt,
      });
      await tx.update(sessions).set({ lastUsedAt: now }).where(eq(sessions.id, row.session.id));
      return {
        kind: 'rotated' as const,
        user: row.user,
        sessionId: row.session.id,
        next,
        expiresAt: row.session.expiresAt,
        mfaVerified: row.session.mfaVerifiedAt !== null,
      };
    });

    switch (outcome.kind) {
      case 'invalid':
        throw unauthenticated();
      case 'race':
        // Another tab rotated this token a moment ago; the browser already holds the new one.
        throw new DomainError(ErrorCode.TOKEN_EXPIRED, 'Session was refreshed in another tab');
      case 'reuse':
        this.logger.warn(
          `refresh token reuse detected: session ${outcome.sessionId} of user ${outcome.userId} revoked`,
        );
        throw unauthenticated();
      case 'rotated':
        return {
          user: outcome.user,
          tokens: await this.issue(
            outcome.user,
            outcome.sessionId,
            outcome.next,
            outcome.expiresAt,
            outcome.mfaVerified,
          ),
        };
    }
  }

  async revokeByRefreshToken(rawRefreshToken: string): Promise<void> {
    const [row] = await this.db
      .select({ sessionId: refreshTokens.sessionId })
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, hashOpaqueToken(rawRefreshToken)));
    if (row) await this.revokeSession(row.sessionId, 'logout');
  }

  async revokeSession(sessionId: string, reason: string, tx: Database = this.db): Promise<void> {
    await tx
      .update(sessions)
      .set({ revokedAt: new Date(), revokedReason: reason })
      .where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)));
  }

  async revokeAllForUser(userId: string, reason: string, tx: Database = this.db): Promise<void> {
    await tx
      .update(sessions)
      .set({ revokedAt: new Date(), revokedReason: reason })
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
  }

  /** Whether a live session passed the second factor. */
  async isMfaVerified(sessionId: string): Promise<boolean> {
    const [session] = await this.db
      .select({ mfaVerifiedAt: sessions.mfaVerifiedAt })
      .from(sessions)
      .where(eq(sessions.id, sessionId));
    return (session?.mfaVerifiedAt ?? null) !== null;
  }

  async isActive(sessionId: string): Promise<boolean> {
    const [session] = await this.db
      .select({ revokedAt: sessions.revokedAt, expiresAt: sessions.expiresAt })
      .from(sessions)
      .where(eq(sessions.id, sessionId));
    if (!session) return false;
    return session.revokedAt === null && session.expiresAt > new Date();
  }

  private async issue(
    user: UserRow,
    sessionId: string,
    refreshToken: string,
    sessionExpiresAt: Date,
    mfaVerified: boolean,
  ): Promise<IssuedTokens> {
    const accessToken = await this.keys.signAccessToken(
      {
        sub: user.id,
        sid: sessionId,
        roles: sessionRoles(user.roles as Role[], mfaVerified),
        email_verified: user.emailVerifiedAt !== null,
        email: user.email,
      },
      this.config.ACCESS_TOKEN_TTL_SECONDS,
    );
    return {
      accessToken,
      refreshToken,
      accessTokenExpiresIn: this.config.ACCESS_TOKEN_TTL_SECONDS,
      sessionExpiresAt,
    };
  }
}
