import { connectPostgres } from '@market/db';
import { createLogger } from '@market/logger';
import { loadConfig, SERVICE_NAME } from '../config.js';
import { schema } from '../db/database.js';
import { seedCatalog } from './seed.js';

/** `pnpm --filter @market/product-service seed` — loads the demo catalog (idempotent). */
const logger = createLogger({ service: `${SERVICE_NAME}-seed` });
const config = loadConfig();
if (config.NODE_ENV === 'production') {
  logger.fatal('refusing to load demo data into a production database');
  process.exit(1);
}
const postgres = connectPostgres({
  url: config.DATABASE_URL,
  schema,
  applicationName: `${SERVICE_NAME}-seed`,
  maxConnections: 2,
});
try {
  logger.info(await seedCatalog(postgres.db, config), 'demo catalog loaded');
} catch (error) {
  logger.fatal({ err: error }, 'seeding failed');
  process.exitCode = 1;
} finally {
  await postgres.close();
}
