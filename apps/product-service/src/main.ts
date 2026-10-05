import 'reflect-metadata';
import { connectPostgres, runMigrations } from '@market/db';
import { JwtVerifier, runMain, startService } from '@market/nest-common';
import { Topics } from '@market/events';
import { createLogger } from '@market/logger';
import { startMessaging } from '@market/messaging';
import { AppModule } from './app.module.js';
import { CatalogWriterService } from './catalog/catalog-writer.service.js';
import { productConsumers } from './events/consumers.js';
import { loadConfig, SERVICE_NAME } from './config.js';
import { MIGRATIONS_FOLDER, schema } from './db/database.js';
import { S3ObjectStorage } from './images/object-storage.js';

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
  const storage = config.S3_BUCKET
    ? new S3ObjectStorage(config.S3_BUCKET, {
        region: config.S3_REGION,
        endpoint: config.S3_ENDPOINT,
      })
    : null;
  if (!storage) logger.warn('S3_BUCKET not set: image uploads are disabled');

  await startService({
    serviceName: SERVICE_NAME,
    module: AppModule.register(config, {
      db: postgres.db,
      verifier: JwtVerifier.fromJwksUrl(config.AUTH_JWKS_URL, { issuer: config.JWT_ISSUER }),
      storage,
      messaging: (moduleRef) =>
        startMessaging({
          serviceName: SERVICE_NAME,
          config,
          db: postgres.db,
          logger,
          publishes: [Topics.PRODUCT],
          consumers: productConsumers(moduleRef.get(CatalogWriterService, { strict: false })),
        }),
      onShutdown: postgres.close,
    }),
    config,
    openApi: { title: SERVICE_NAME, description: 'Catalog, search and keyboard configurator' },
    configure: { bodyLimit: '256kb' },
  });
});
