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
