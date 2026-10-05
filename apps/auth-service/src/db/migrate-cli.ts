import { createLogger } from '@market/logger';
import { loadConfig, SERVICE_NAME } from '../config.js';
import { runMigrations } from '@market/db';
import { MIGRATIONS_FOLDER } from './database.js';

/**
 * Applies pending migrations and exits. In Kubernetes this runs as a pre-deploy
 * Job (or Helm hook) before new pods start, so app pods never race on DDL.
 */
const logger = createLogger({ service: `${SERVICE_NAME}-migrate` });
try {
  const config = loadConfig();
  await runMigrations(config.DATABASE_URL, MIGRATIONS_FOLDER);
  logger.info('migrations applied');
} catch (error) {
  logger.fatal({ err: error }, 'migration failed');
  process.exitCode = 1;
}
