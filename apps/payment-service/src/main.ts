import 'reflect-metadata';
import { connectPostgres, runMigrations } from '@market/db';
import { createLogger } from '@market/logger';
import { Topics } from '@market/events';
import { startMessaging } from '@market/messaging';
import { JwtVerifier, runMain, startService } from '@market/nest-common';
import { AppModule } from './app.module.js';
import { HttpOrdersGateway } from './clients/orders.js';
import { loadConfig, SERVICE_NAME, type AppConfig } from './config.js';
import { MIGRATIONS_FOLDER, schema } from './db/database.js';
import { paymentConsumers } from './events/consumers.js';
import { PaymentService } from './payments/payment.service.js';
import { MockProvider } from './provider/mock.provider.js';
import type { PaymentProvider } from './provider/provider.js';
import { StripeProvider } from './provider/stripe.provider.js';

function createProvider(config: AppConfig): PaymentProvider {
  if (config.PAYMENT_PROVIDER === 'mock') return new MockProvider(config.STRIPE_WEBHOOK_SECRET);
  // Presence is guaranteed by config validation for the stripe provider.
  return new StripeProvider(config.STRIPE_SECRET_KEY ?? '', config.STRIPE_PUBLISHABLE_KEY ?? '');
}

runMain(SERVICE_NAME, async () => {
  const config = loadConfig();
  const logger = createLogger({ service: SERVICE_NAME, level: config.LOG_LEVEL });
  if (config.MIGRATE_ON_START) {
    await runMigrations(config.DATABASE_URL, MIGRATIONS_FOLDER);
    logger.info('database migrations applied');
  }
  if (config.PAYMENT_PROVIDER === 'mock') {
    logger.warn('PAYMENT_PROVIDER=mock: payments are simulated (development only)');
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
      provider: createProvider(config),
      orders: new HttpOrdersGateway(config.ORDER_SERVICE_URL),
      messaging: (moduleRef) =>
        startMessaging({
          serviceName: SERVICE_NAME,
          config,
          db: postgres.db,
          logger,
          publishes: [Topics.PAYMENT],
          consumers: paymentConsumers(moduleRef.get(PaymentService, { strict: false })),
        }),
      onShutdown: postgres.close,
    }),
    config,
    // The webhook signature is computed over the exact bytes Stripe sent.
    rawBody: true,
    openApi: {
      title: SERVICE_NAME,
      description: 'Stripe PaymentIntents, webhooks and refunds; no card data is ever stored',
    },
    configure: { bodyLimit: '256kb' },
  });
});
