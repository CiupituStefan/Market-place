import { createLogger, type Logger } from '@market/logger';
import {
  RequestMethod,
  type DynamicModule,
  type INestApplication,
  type Type,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { API_PREFIX } from '@market/types';
import { AllExceptionsFilter } from './exception.filter.js';
import { PinoNestLogger } from './nest-logger.js';
import { setupOpenApi, type OpenApiOptions } from './openapi.js';
import { requestContextMiddleware } from './request-context.js';

export interface BaseServiceConfig {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  LOG_LEVEL: string;
}

export interface ConfigureAppOptions {
  logger: Logger;
  /** Mount controllers under /api/v1 (health and the OpenAPI spec stay at the root). */
  globalPrefix?: boolean;
  /** Number of trusted reverse-proxy hops (ingress/load balancer) for req.ip. */
  trustProxy?: number;
  /** JSON body size limit for services that parse bodies. */
  bodyLimit?: string;
  /** Extra GET paths served outside /api/v1 (e.g. `.well-known/jwks.json`). */
  excludeFromPrefix?: string[];
}

/**
 * Applies the cross-cutting HTTP behaviour every service shares. Used by the
 * production bootstrap and by integration tests, so tests exercise the real setup.
 */
export function configureApp(app: INestApplication, options: ConfigureAppOptions): void {
  const express = app as NestExpressApplication;
  express.disable('x-powered-by');
  express.set('trust proxy', options.trustProxy ?? 0);
  express.use(requestContextMiddleware(options.logger));
  if (options.bodyLimit) express.useBodyParser('json', { limit: options.bodyLimit });
  if (options.globalPrefix ?? true) {
    app.setGlobalPrefix(API_PREFIX, {
      exclude: [
        { path: 'health/live', method: RequestMethod.GET },
        { path: 'health/ready', method: RequestMethod.GET },
        ...(options.excludeFromPrefix ?? []).map((path) => ({ path, method: RequestMethod.GET })),
      ],
    });
  }
  app.useGlobalFilters(new AllExceptionsFilter(options.logger));
  app.enableShutdownHooks();
}

export interface StartServiceOptions {
  serviceName: string;
  module: Type | DynamicModule;
  config: BaseServiceConfig;
  openApi?: Omit<OpenApiOptions, 'ui'>;
  /** Express body parsing; the gateway disables it to stream bodies untouched. */
  bodyParser?: boolean;
  /** Keep the exact request bytes on `req.rawBody` (webhook signature verification). */
  rawBody?: boolean;
  configure?: Omit<ConfigureAppOptions, 'logger'>;
  /** Extra setup (middleware, CORS...) before listening. */
  beforeListen?: (app: NestExpressApplication, logger: Logger) => void | Promise<void>;
}

export async function startService(
  options: StartServiceOptions,
): Promise<{ app: INestApplication; logger: Logger }> {
  const { config } = options;
  const logger = createLogger({
    service: options.serviceName,
    level: config.LOG_LEVEL,
    pretty: config.NODE_ENV === 'development',
  });

  const app = await NestFactory.create<NestExpressApplication>(options.module, {
    logger: new PinoNestLogger(logger),
    bodyParser: options.bodyParser ?? true,
    rawBody: options.rawBody ?? false,
    bufferLogs: true,
  });
  configureApp(app, { logger, ...options.configure });
  if (options.openApi) {
    setupOpenApi(app, { ...options.openApi, ui: config.NODE_ENV !== 'production' });
  }
  await options.beforeListen?.(app, logger);

  await app.listen(config.PORT, '0.0.0.0');
  logger.info({ port: config.PORT }, `${options.serviceName} listening`);
  return { app, logger };
}

/** Standard process entry: logs fatal startup errors (e.g. invalid config) and exits non-zero. */
export function runMain(
  serviceName: string,
  main: () => Promise<unknown>,
  exit: (code: number) => void = (code) => process.exit(code),
): void {
  main().then(
    () => undefined,
    (error: unknown) => {
      const logger = createLogger({ service: serviceName });
      logger.fatal({ err: error }, `failed to start ${serviceName}`);
      // Exit for real: open handles (database pool, broker sockets) would otherwise keep a
      // half-started process alive that never serves traffic and is never restarted.
      // A short delay lets the log line reach stdout first.
      setTimeout(() => {
        exit(1);
      }, 100);
    },
  );
}
