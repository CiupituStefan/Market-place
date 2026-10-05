import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import type { Database } from '../src/db/database.js';
import { MIGRATIONS_FOLDER } from '../src/db/database.js';
import * as schema from '../src/db/schema.js';

/**
 * Fresh in-process PostgreSQL with the real migrations applied: tests exercise
 * the same SQL (constraints, indexes, defaults) as production.
 */
export async function createTestDatabase(): Promise<{ db: Database; close: () => Promise<void> }> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return { db: db as unknown as Database, close: () => client.close() };
}
