import 'reflect-metadata';
import { connectPostgres, runMigrations } from '@market/db';
import { createLogger } from '@market/logger';
import { startMessaging } from '@market/messaging';
import { JwtVerifier, runMain, startService } from '@market/nest-common';
import { AppModule } from './app.module.js';
import { loadConfig, SERVICE_NAME } from './config.js';
import { MIGRATIONS_FOLDER, schema } from './db/database.js';
import { createEmailProvider } from './delivery/create-provider.js';
import { notificationConsumers } from './events/consumers.js';
import { NotificationService } from './notifications/notification.service.js';
import { OrderNotifications } from './orders/order-notifications.js';

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
  const email = createEmailProvider(config, logger);
  logger.info({ provider: email.name }, 'email provider ready');
  await startService({
    serviceName: SERVICE_NAME,
    module: AppModule.register(config, {
      db: postgres.db,
      verifier: JwtVerifier.fromJwksUrl(config.AUTH_JWKS_URL, { issuer: config.JWT_ISSUER }),
      email,
      messaging: (moduleRef) =>
        startMessaging({
          serviceName: SERVICE_NAME,
          config,
          db: postgres.db,
          logger,
          // Consumes only: notifications are the end of the line.
          publishes: [],
          consumers: notificationConsumers(
            new OrderNotifications(moduleRef.get(NotificationService, { strict: false })),
          ),
        }),
      onShutdown: async () => {
        email.close?.();
        await postgres.close();
      },
    }),
    config,
    openApi: {
      title: SERVICE_NAME,
      description: 'Transactional email, newsletter double opt-in and notification preferences',
    },
    configure: { bodyLimit: '16kb' },
  });
});
