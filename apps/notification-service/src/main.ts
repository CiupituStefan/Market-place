import 'reflect-metadata';
import { createLogger } from '@market/logger';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { loadConfig, SERVICE_NAME } from './config.js';

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger({
    service: SERVICE_NAME,
    level: config.LOG_LEVEL,
    pretty: config.NODE_ENV === 'development',
  });

  const app = await NestFactory.create(AppModule.register(config), { logger: false });
  app.enableShutdownHooks();
  await app.listen(config.PORT, '0.0.0.0');
  logger.info({ port: config.PORT }, `${SERVICE_NAME} listening`);
}

bootstrap().catch((error: unknown) => {
  // The structured logger may not exist yet (e.g. invalid config), so fall back to stderr.
  process.stderr.write(`Fatal: failed to start ${SERVICE_NAME}\n${String(error)}\n`);
  process.exit(1);
});
