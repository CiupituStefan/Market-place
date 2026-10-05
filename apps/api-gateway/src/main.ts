import 'reflect-metadata';
import { PinoNestLogger, runMain } from '@market/nest-common';
import { createLogger } from '@market/logger';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { loadConfig, SERVICE_NAME } from './config.js';
import { setupGateway } from './setup.js';

runMain(SERVICE_NAME, async () => {
  const config = loadConfig();
  const logger = createLogger({
    service: SERVICE_NAME,
    level: config.LOG_LEVEL,
    pretty: config.NODE_ENV === 'development',
  });
  // bodyParser: false — bodies are streamed to upstreams byte-for-byte.
  const app = await NestFactory.create<NestExpressApplication>(AppModule.register(config), {
    logger: new PinoNestLogger(logger),
    bodyParser: false,
    bufferLogs: true,
  });
  setupGateway(app, config, logger);
  await app.listen(config.PORT, '0.0.0.0');
  logger.info({ port: config.PORT, docs: config.DOCS_ENABLED }, `${SERVICE_NAME} listening`);
});
