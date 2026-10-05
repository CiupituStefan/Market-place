import { connectPostgres } from '@market/db';
import { createLogger } from '@market/logger';
import { loadConfig, SERVICE_NAME } from './config.js';
import { schema } from './db/database.js';
import { discountCodes } from './db/schema.js';

/** Demo discount codes for local development. Idempotent (existing codes are left alone). */
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
  maxConnections: 1,
});
const currency = config.CURRENCY;
const codes: (typeof discountCodes.$inferInsert)[] = [
  // 10% off, once per customer.
  { code: 'WELCOME10', type: 'PERCENTAGE', value: 1_000, perCustomerLimit: 1, currency },
  // €15 off orders of €120 or more.
  { code: 'SWITCHUP15', type: 'FIXED', value: 15_00, minSubtotal: 120_00, currency },
  // A limited run: the first 100 orders only.
  { code: 'LAUNCH20', type: 'PERCENTAGE', value: 2_000, usageLimit: 100, currency },
];

try {
  const inserted = await postgres.db
    .insert(discountCodes)
    .values(codes)
    .onConflictDoNothing()
    .returning({ code: discountCodes.code });
  logger.info({ inserted: inserted.map((row) => row.code) }, 'demo discount codes loaded');
} catch (error) {
  logger.fatal({ err: error }, 'seeding failed');
  process.exitCode = 1;
} finally {
  await postgres.close();
}
