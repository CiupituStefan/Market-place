import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import pg from 'pg';

/**
 * Driver-agnostic handle: node-postgres in every environment, PGlite in tests.
 * Repositories and services depend only on this type.
 */
export type Database<TSchema extends Record<string, unknown> = Record<string, unknown>> =
  PgDatabase<PgQueryResultHKT, TSchema>;

export interface PostgresConnection<TSchema extends Record<string, unknown>> {
  db: Database<TSchema>;
  ping: () => Promise<void>;
  close: () => Promise<void>;
}

export interface ConnectOptions<TSchema extends Record<string, unknown>> {
  url: string;
  schema: TSchema;
  applicationName: string;
  maxConnections?: number;
  /** Upper bound for any statement; long-running jobs can `SET LOCAL statement_timeout`. */
  statementTimeoutMs?: number;
}

export function connectPostgres<TSchema extends Record<string, unknown>>(
  options: ConnectOptions<TSchema>,
): PostgresConnection<TSchema> {
  const pool = new pg.Pool({
    connectionString: options.url,
    max: options.maxConnections ?? 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    statement_timeout: options.statementTimeoutMs ?? 10_000,
    application_name: options.applicationName,
  });
  const db = drizzle(pool, { schema: options.schema });
  return {
    db,
    ping: async () => {
      await db.execute(sql`select 1`);
    },
    close: () => pool.end(),
  };
}

/** Applies committed SQL migrations (run by the pre-deploy Job, or at boot in development). */
export async function runMigrations(url: string, migrationsFolder: string): Promise<void> {
  const pool = new pg.Pool({ connectionString: url, max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder });
  } finally {
    await pool.end();
  }
}

/** True for PostgreSQL unique_violation (23505), however deeply the driver wraps it. */
export function isUniqueViolation(error: unknown): boolean {
  for (let current: unknown = error, depth = 0; current && depth < 4; depth += 1) {
    if (typeof current === 'object' && 'code' in current && current.code === '23505') return true;
    current = current instanceof Error ? current.cause : undefined;
  }
  return false;
}
