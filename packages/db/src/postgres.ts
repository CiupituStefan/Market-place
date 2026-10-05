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
/** Arbitrary constant: one migration run per database at a time. */
const MIGRATION_LOCK_ID = 7_042_031;

/**
 * Applies pending migrations. Safe to start from several replicas at once (Kubernetes init
 * containers during a rollout): a session advisory lock serialises them, and the ones that
 * wait find nothing left to apply.
 */
export async function runMigrations(url: string, migrationsFolder: string): Promise<void> {
  const pool = new pg.Pool({ connectionString: url, max: 1 });
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    try {
      await migrate(drizzle(client), { migrationsFolder });
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]);
    }
  } finally {
    client.release();
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
