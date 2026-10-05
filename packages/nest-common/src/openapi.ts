import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import type { Request, Response } from 'express';

export interface OpenApiOptions {
  title: string;
  description?: string;
  version?: string;
  /** Serve Swagger UI at /docs (development). The JSON spec is always served for the gateway. */
  ui?: boolean;
}

export const OPENAPI_PATH = '/openapi.json';

export function buildOpenApiDocument(
  app: INestApplication,
  options: OpenApiOptions,
): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle(options.title)
    .setDescription(options.description ?? '')
    .setVersion(options.version ?? '1.0.0')
    .addCookieAuth('access_token')
    .build();
  return SwaggerModule.createDocument(app, config);
}

/** Exposes the service's OpenAPI spec (consumed by the gateway's aggregated docs). */
export function setupOpenApi(app: INestApplication, options: OpenApiOptions): OpenAPIObject {
  const document = buildOpenApiDocument(app, options);
  app.getHttpAdapter().get(OPENAPI_PATH, (_req: Request, res: Response) => {
    res.json(document);
  });
  if (options.ui) SwaggerModule.setup('docs', app, document);
  return document;
}
