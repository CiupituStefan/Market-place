import { buildOpenApiDocument, configureApp } from '@market/nest-common';
import type { Logger } from '@market/logger';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';
import { UPSTREAM_SERVICES, type AppConfig } from './config.js';
import { applyHttpSecurity } from './security/http-security.js';

/** Everything between app creation and listen; shared by main.ts and tests. */
export function setupGateway(app: NestExpressApplication, config: AppConfig, logger: Logger): void {
  applyHttpSecurity(app, config);
  // The gateway owns no /api/v1 controllers of its own: everything there is proxied.
  configureApp(app, { logger, globalPrefix: false, trustProxy: config.TRUST_PROXY });

  if (config.DOCS_ENABLED) {
    const document = buildOpenApiDocument(app, {
      title: 'CSE Keyboards API',
      description: 'Public API served through the gateway. Select a service in the top bar.',
    });
    SwaggerModule.setup('docs', app, document, {
      explorer: true,
      swaggerOptions: {
        urls: UPSTREAM_SERVICES.map((service) => ({
          url: `/docs/specs/${service}`,
          name: service,
        })),
        withCredentials: true,
      },
    });
  }
}
