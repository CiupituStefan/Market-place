import { PGlite, type Extensions } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import type { Database } from './postgres.js';

/**
 * Fresh in-process PostgreSQL (PGlite) with the service's real migrations applied,
 * so tests run against the same SQL, constraints and indexes as production.
 */
export async function createTestDatabase<TSchema extends Record<string, unknown>>(options: {
  schema: TSchema;
  migrationsFolder: string;
  extensions?: Extensions;
}): Promise<{ db: Database<TSchema>; close: () => Promise<void> }> {
  const client = new PGlite(options.extensions ? { extensions: options.extensions } : undefined);
  const db = drizzle(client, { schema: options.schema });
  await migrate(db, { migrationsFolder: options.migrationsFolder });
  return { db: db as unknown as Database<TSchema>, close: () => client.close() };
}

/**
 * Throwaway database on a real PostgreSQL server, for tests that need several
 * concurrent connections (row locks, SKIP LOCKED, deadlocks) which PGlite cannot
 * provide. `adminUrl` must be allowed to CREATE/DROP DATABASE (CI service, local dev).
 */
export async function createPostgresTestDatabase<TSchema extends Record<string, unknown>>(options: {
  adminUrl: string;
  schema: TSchema;
  migrationsFolder: string;
  maxConnections?: number;
}): Promise<{ db: Database<TSchema>; url: string; close: () => Promise<void> }> {
  const { default: pg } = await import('pg');
  const { drizzle: drizzlePg } = await import('drizzle-orm/node-postgres');
  const { migrate: migratePg } = await import('drizzle-orm/node-postgres/migrator');

  const name = `test_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const admin = new pg.Client({ connectionString: options.adminUrl });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${name}`);
  await admin.end();

  const url = new URL(options.adminUrl);
  url.pathname = `/${name}`;
  const pool = new pg.Pool({ connectionString: url.toString(), max: options.maxConnections ?? 20 });
  const db = drizzlePg(pool, { schema: options.schema });
  await migratePg(db, { migrationsFolder: options.migrationsFolder });

  return {
    db: db as unknown as Database<TSchema>,
    url: url.toString(),
    close: async () => {
      await pool.end();
      const cleanup = new pg.Client({ connectionString: options.adminUrl });
      await cleanup.connect();
      // pool.end() resolves before every backend has gone; terminating one that is
      // still closing surfaces as an uncaught 57P01 in the test process. Wait first.
      for (let attempt = 0; attempt < 50; attempt += 1) {
        const { rows } = await cleanup.query<{ n: string }>(
          'SELECT count(*) AS n FROM pg_stat_activity WHERE datname = $1',
          [name],
        );
        if (rows[0]?.n === '0') break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      await cleanup.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await cleanup.end();
    },
  };
}
