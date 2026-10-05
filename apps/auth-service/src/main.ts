import 'reflect-metadata';
import { runMain, startService } from '@market/nest-common';
import { Topics } from '@market/events';
import { createLogger } from '@market/logger';
import { startMessaging } from '@market/messaging';
import { AppModule, JWKS_PATH } from './app.module.js';
import { loadConfig, SERVICE_NAME } from './config.js';
import { connectPostgres, runMigrations } from '@market/db';
import { MIGRATIONS_FOLDER, schema } from './db/database.js';
import { SigningKeys } from './tokens/signing-keys.js';

runMain(SERVICE_NAME, async () => {
  const config = loadConfig();
  const logger = createLogger({ service: SERVICE_NAME, level: config.LOG_LEVEL });

  const keys = await SigningKeys.load({
    privateKeyPem: config.JWT_PRIVATE_KEY,
    keyId: config.JWT_KEY_ID,
    previousPublicKeyPem: config.JWT_PREVIOUS_PUBLIC_KEY,
    previousKeyId: config.JWT_PREVIOUS_KEY_ID,
    issuer: config.JWT_ISSUER,
  });
  if (keys.ephemeral) {
    logger.warn(
      'JWT_PRIVATE_KEY not set: using an ephemeral signing key (sessions end on restart)',
    );
  }

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
      keys,
      // Relay only: verification and reset emails go out as NotificationRequested.
      messaging: () =>
        startMessaging({
          serviceName: SERVICE_NAME,
          config,
          db: postgres.db,
          logger,
          publishes: [Topics.NOTIFICATION],
          consumers: [],
        }),
      onShutdown: postgres.close,
    }),
    config,
    openApi: { title: SERVICE_NAME, description: 'Accounts, sessions and roles' },
    configure: { bodyLimit: '64kb', excludeFromPrefix: [JWKS_PATH] },
  });
});
