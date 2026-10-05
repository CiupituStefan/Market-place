import { DomainError, ErrorCode } from '@market/types';
import { Controller, Get, Inject, Param } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { request } from 'undici';
import {
  APP_CONFIG,
  UPSTREAM_SERVICES,
  upstreamUrl,
  type AppConfig,
  type UpstreamService,
} from '../config.js';

const CACHE_TTL_MS = 60_000;

/**
 * Serves each service's OpenAPI spec through the gateway so one Swagger UI can
 * browse the whole API. Only registered when DOCS_ENABLED (off in production).
 */
@ApiExcludeController()
@Controller('docs/specs')
export class DocsController {
  private readonly cache = new Map<UpstreamService, { spec: unknown; expiresAt: number }>();

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  @Get(':service')
  async spec(@Param('service') service: string): Promise<unknown> {
    if (!isUpstream(service)) throw new DomainError(ErrorCode.NOT_FOUND, 'Unknown service');
    const cached = this.cache.get(service);
    if (cached && cached.expiresAt > Date.now()) return cached.spec;
    try {
      const response = await request(new URL('/openapi.json', upstreamUrl(this.config, service)), {
        headersTimeout: 3_000,
        bodyTimeout: 3_000,
      });
      if (response.statusCode !== 200) {
        await response.body.dump();
        throw new Error(`status ${response.statusCode}`);
      }
      const spec: unknown = await response.body.json();
      this.cache.set(service, { spec, expiresAt: Date.now() + CACHE_TTL_MS });
      return spec;
    } catch {
      throw new DomainError(
        ErrorCode.SERVICE_UNAVAILABLE,
        `OpenAPI spec for ${service} is unavailable`,
      );
    }
  }
}

function isUpstream(value: string): value is UpstreamService {
  return (UPSTREAM_SERVICES as readonly string[]).includes(value);
}
