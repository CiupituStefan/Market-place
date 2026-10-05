import {
  DomainError,
  ErrorCode,
  paginate,
  toOffset,
  type Paginated,
  type Role,
} from '@market/types';
import { Inject, Injectable } from '@nestjs/common';
import { count, desc, eq, ilike, or } from 'drizzle-orm';
import { SessionService } from '../auth/session.service.js';
import type { UserResponse } from '../auth/dto.js';
import { DATABASE, type Database } from '../db/database.js';
import { users } from '../db/schema.js';
import { toUserResponse } from './user-response.js';

@Injectable()
export class UsersService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly sessions: SessionService,
  ) {}

  async list(query: {
    page: number;
    pageSize: number;
    q?: string | undefined;
  }): Promise<Paginated<UserResponse>> {
    // Escape LIKE wildcards so the search term is matched literally.
    const term = query.q ? `%${query.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : undefined;
    const where = term
      ? or(ilike(users.email, term), ilike(users.firstName, term), ilike(users.lastName, term))
      : undefined;
    const { offset, limit } = toOffset(query);
    const [rows, totals] = await Promise.all([
      this.db
        .select()
        .from(users)
        .where(where)
        .orderBy(desc(users.createdAt))
        .limit(limit)
        .offset(offset),
      this.db.select({ total: count() }).from(users).where(where),
    ]);
    return paginate(rows.map(toUserResponse), totals[0]?.total ?? 0, query);
  }

  /**
   * Changes roles and signs the user out everywhere, so a removed privilege takes
   * effect immediately instead of when the current access token expires.
   */
  async updateRoles(actorId: string, userId: string, roles: Role[]): Promise<UserResponse> {
    if (actorId === userId && !roles.includes('ADMIN')) {
      throw new DomainError(ErrorCode.CONFLICT, 'You cannot remove your own ADMIN role');
    }
    return this.db.transaction(async (tx) => {
      const [user] = await tx
        .update(users)
        .set({ roles: [...new Set(roles)], updatedAt: new Date() })
        .where(eq(users.id, userId))
        .returning();
      if (!user) throw new DomainError(ErrorCode.NOT_FOUND, 'User not found');
      await this.sessions.revokeAllForUser(userId, 'roles_changed', tx);
      return toUserResponse(user);
    });
  }
}
