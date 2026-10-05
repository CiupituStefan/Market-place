import { DomainError, ErrorCode, type Role } from '@market/types';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { DATABASE, type Database } from '../db/database.js';
import { refreshTokens, sessions, users, type UserRow } from '../db/schema.js';
import { generateOpaqueToken, hashOpaqueToken } from '../tokens/opaque-token.js';
import { SigningKeys } from '../tokens/signing-keys.js';
import type { IssuedTokens } from './cookies.js';

export interface ClientInfo {
  userAgent: string | undefined;
  ip: string | undefined;
}

const DAY_MS = 86_400_000;

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

  async createSession(
    user: UserRow,
    client: ClientInfo,
    tx: Database = this.db,
  ): Promise<IssuedTokens> {
    const expiresAt = new Date(Date.now() + this.config.SESSION_TTL_DAYS * DAY_MS);
    const [session] = await tx
      .insert(sessions)
      .values({
        userId: user.id,
        expiresAt,
        userAgent: client.userAgent?.slice(0, 512),
        ip: client.ip,
      })
      .returning({ id: sessions.id });
    if (!session) throw new Error('session insert returned no row');
    const refreshToken = generateOpaqueToken();
    await tx
      .insert(refreshTokens)
      .values({ sessionId: session.id, tokenHash: hashOpaqueToken(refreshToken), expiresAt });
    return this.issue(user, session.id, refreshToken, expiresAt);
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
  ): Promise<IssuedTokens> {
    const accessToken = await this.keys.signAccessToken(
      {
        sub: user.id,
        sid: sessionId,
        roles: user.roles as Role[],
        email_verified: user.emailVerifiedAt !== null,
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
