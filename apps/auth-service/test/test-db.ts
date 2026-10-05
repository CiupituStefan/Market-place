import { createTestDatabase as create } from '@market/db/testing';
import { MIGRATIONS_FOLDER, schema, type Database } from '../src/db/database.js';

/** In-process Postgres with auth-service's real migrations applied. */
export function createTestDatabase(): Promise<{ db: Database; close: () => Promise<void> }> {
  return create({ schema, migrationsFolder: MIGRATIONS_FOLDER });
}
