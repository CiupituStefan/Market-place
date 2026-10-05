import 'reflect-metadata';
import { connectPostgres, runMigrations } from '@market/db';
import { createLogger } from '@market/logger';
import { startMessaging } from '@market/messaging';
import { JwtVerifier, runMain, startService } from '@market/nest-common';
import { SalesProjection } from './analytics/projection.js';
import { AppModule } from './app.module.js';
import { loadConfig, SERVICE_NAME } from './config.js';
import { MIGRATIONS_FOLDER, schema } from './db/database.js';
import { adminConsumers } from './events/consumers.js';

runMain(SERVICE_NAME, async () => {
  const config = loadConfig();
  const logger = createLogger({ service: SERVICE_NAME, level: config.LOG_LEVEL });
  if (config.MIGRATE_ON_START) {
    await runMigrations(config.DATABASE_URL, MIGRATIONS_FOLDER);
    logger.info('database migrations applied');
  }
  const postgres = connectPostgres({
    url: config.DATABASE_URL,
    schema,
    applicationName: SERVICE_NAME,
    maxConnections: config.DATABASE_POOL_MAX,
  });
  await startService({
    serviceName: SERVICE_NAME,
    module: AppModule.register(config, {
      db: postgres.db,
      verifier: JwtVerifier.fromJwksUrl(config.AUTH_JWKS_URL, { issuer: config.JWT_ISSUER }),
      messaging: () =>
        startMessaging({
          serviceName: SERVICE_NAME,
          config,
          db: postgres.db,
          logger,
          // A read model: it consumes only.
          publishes: [],
          consumers: adminConsumers(new SalesProjection()),
        }),
      onShutdown: postgres.close,
    }),
    config,
    openApi: { title: SERVICE_NAME, description: 'Back-office analytics (STAFF and ADMIN)' },
    configure: { bodyLimit: '16kb' },
  });
});
