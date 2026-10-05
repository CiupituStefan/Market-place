import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * auth-service owns the `auth` database. No other service may connect to it;
 * user data is exposed only through this service's API and events.
 */

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
};

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Normalised (trimmed, lower-cased) email; uniqueness is enforced on this column. */
    email: text('email').notNull(),
    /** Argon2id PHC string. Never logged, never returned by the API. */
    passwordHash: text('password_hash').notNull(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    roles: text('roles')
      .array()
      .notNull()
      .default(sql`ARRAY['USER']::text[]`),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    /** Consecutive failed sign-ins; reset on success. Drives the temporary lockout. */
    failedLoginCount: integer('failed_login_count').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    ...timestamps,
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('users_email_key').on(table.email),
    check('users_roles_valid', sql`${table.roles} <@ ARRAY['USER','STAFF','ADMIN']::text[]`),
  ],
);

/** A signed-in device/browser. Revoking a session invalidates all its refresh tokens. */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ...timestamps,
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }).notNull().defaultNow(),
    /** Absolute lifetime: rotation never extends a session beyond this. */
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedReason: text('revoked_reason'),
    userAgent: text('user_agent'),
    ip: text('ip'),
  },
  (table) => [index('sessions_user_id_idx').on(table.userId)],
);

/**
 * Opaque refresh tokens, stored as SHA-256 hashes (a database leak does not
 * leak usable tokens). Each use rotates the token; `usedAt` lets us detect reuse.
 */
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    ...timestamps,
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('refresh_tokens_token_hash_key').on(table.tokenHash),
    index('refresh_tokens_session_id_idx').on(table.sessionId),
  ],
);

export const oneTimeTokenPurpose = pgEnum('one_time_token_purpose', [
  'EMAIL_VERIFICATION',
  'PASSWORD_RESET',
]);

/** Single-use, short-lived tokens sent by email (verification, password reset). Hashed at rest. */
export const oneTimeTokens = pgTable(
  'one_time_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    purpose: oneTimeTokenPurpose('purpose').notNull(),
    tokenHash: text('token_hash').notNull(),
    ...timestamps,
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('one_time_tokens_token_hash_key').on(table.tokenHash),
    index('one_time_tokens_user_purpose_idx').on(table.userId, table.purpose),
  ],
);

/** Transactional outbox (shared definition, one table per service database). */
export { outboxEvents } from '@market/db';

export type UserRow = typeof users.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
