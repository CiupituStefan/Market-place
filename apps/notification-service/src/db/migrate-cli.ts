import { loadEnv, postgresEnv } from '@market/config';
import { runMigrations } from '@market/db';
import { createLogger } from '@market/logger';
import { SERVICE_NAME } from '../config.js';
import { MIGRATIONS_FOLDER } from './database.js';

/**
 * Applies pending migrations and exits (pre-deploy Kubernetes Job). Reads only the
 * database settings: the migration Job never needs delivery credentials.
 */
const logger = createLogger({ service: `${SERVICE_NAME}-migrate` });
try {
  const { DATABASE_URL } = loadEnv(postgresEnv);
  await runMigrations(DATABASE_URL, MIGRATIONS_FOLDER);
  logger.info('migrations applied');
} catch (error) {
  logger.fatal({ err: error }, 'migration failed');
  process.exitCode = 1;
}
