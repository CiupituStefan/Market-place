import { runMigrations } from '@market/db';
import { createLogger } from '@market/logger';
import { loadConfig, SERVICE_NAME } from '../config.js';
import { MIGRATIONS_FOLDER } from './database.js';

/** Applies pending migrations and exits (pre-deploy Kubernetes Job). */
const logger = createLogger({ service: `${SERVICE_NAME}-migrate` });
try {
  await runMigrations(loadConfig().DATABASE_URL, MIGRATIONS_FOLDER);
  logger.info('migrations applied');
} catch (error) {
  logger.fatal({ err: error }, 'migration failed');
  process.exitCode = 1;
}
