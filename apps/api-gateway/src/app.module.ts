import { HealthModule, type HealthCheck } from '@market/nest-common';
import { Logger, Module, type DynamicModule, type Provider } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { APP_CONFIG, SERVICE_NAME, type AppConfig } from './config.js';
import { DocsController } from './docs/docs.controller.js';
import { ProxyController } from './proxy/proxy.controller.js';
import { ProxyService } from './proxy/proxy.service.js';
import { DEFAULT_POLICIES, type RateLimitPolicy } from './rate-limit/policies.js';
import { RateLimitGuard } from './rate-limit/rate-limit.guard.js';
import { FallbackRateLimitStore, RedisRateLimitStore } from './rate-limit/redis-store.js';
import { MemoryRateLimitStore, type RateLimitStore } from './rate-limit/store.js';
import { RATE_LIMIT_POLICIES, RATE_LIMIT_STORE } from './rate-limit/tokens.js';
import { REDIS, RedisModule } from './redis/redis.module.js';
import { OriginGuard } from './security/origin.guard.js';

export interface GatewayModuleOverrides {
  /** Test seams: inject a store or tighter policies. */
  rateLimitStore?: RateLimitStore;
  rateLimitPolicies?: readonly RateLimitPolicy[];
}

@Module({})
export class AppModule {
  static register(config: AppConfig, overrides: GatewayModuleOverrides = {}): DynamicModule {
    const storeProvider: Provider = overrides.rateLimitStore
      ? { provide: RATE_LIMIT_STORE, useValue: overrides.rateLimitStore }
      : {
          provide: RATE_LIMIT_STORE,
          inject: [REDIS],
          useFactory: (redis: Redis | null): RateLimitStore => {
            const memory = new MemoryRateLimitStore();
            if (!redis) return memory;
            const logger = new Logger('RateLimit');
            return new FallbackRateLimitStore(new RedisRateLimitStore(redis), memory, (error) => {
              logger.warn(`redis unavailable, using per-instance limits: ${String(error)}`);
            });
          },
        };

    return {
      module: AppModule,
      global: true,
      imports: [
        RedisModule,
        HealthModule.register({
          serviceName: SERVICE_NAME,
          imports: [RedisModule],
          inject: [REDIS],
          // Redis is not critical: rate limiting degrades to per-instance without it,
          // and failing readiness would take every gateway pod out of rotation.
          checks: (redis: Redis | null): HealthCheck[] =>
            redis
              ? [
                  {
                    name: 'redis',
                    critical: false,
                    check: async () => {
                      await redis.ping();
                    },
                  },
                ]
              : [],
        }),
      ],
      controllers: [...(config.DOCS_ENABLED ? [DocsController] : []), ProxyController],
      providers: [
        { provide: APP_CONFIG, useValue: config },
        { provide: RATE_LIMIT_POLICIES, useValue: overrides.rateLimitPolicies ?? DEFAULT_POLICIES },
        storeProvider,
        ProxyService,
        RateLimitGuard,
        OriginGuard,
      ],
      exports: [APP_CONFIG],
    };
  }
}
