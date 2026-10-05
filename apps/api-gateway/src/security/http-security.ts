import { IDEMPOTENCY_KEY_HEADER, ORDER_TOKEN_HEADER, REQUEST_ID_HEADER } from '@market/types';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import type { AppConfig } from '../config.js';

/**
 * Security headers + CORS for the public edge.
 * API responses are JSON, so they get the strictest CSP (`default-src 'none'`).
 * Swagger UI (non-production only) needs a normal page policy.
 */
export function applyHttpSecurity(app: NestExpressApplication, config: AppConfig): void {
  const apiHelmet = helmet({
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
    crossOriginResourcePolicy: { policy: 'same-site' },
    strictTransportSecurity: config.NODE_ENV === 'production',
  });
  const docsHelmet = helmet({ strictTransportSecurity: config.NODE_ENV === 'production' });
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/docs' || req.path.startsWith('/docs/')) {
      docsHelmet(req, res, next);
      return;
    }
    apiHelmet(req, res, next);
  });

  const allowed = new Set(config.CORS_ORIGINS);
  app.enableCors({
    origin: (origin, callback) => {
      // No Origin header: same-origin or non-browser request, CORS does not apply.
      callback(null, origin === undefined || allowed.has(origin));
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: [
      'content-type',
      'authorization',
      REQUEST_ID_HEADER,
      IDEMPOTENCY_KEY_HEADER,
      ORDER_TOKEN_HEADER,
    ],
    exposedHeaders: [
      REQUEST_ID_HEADER,
      'idempotent-replayed',
      'retry-after',
      'ratelimit-limit',
      'ratelimit-remaining',
      'ratelimit-reset',
    ],
    maxAge: 600,
  });
}
