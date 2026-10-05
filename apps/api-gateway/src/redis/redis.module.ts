import { Inject, Logger, Module, type OnApplicationShutdown } from '@nestjs/common';
import { Redis } from 'ioredis';
import { APP_CONFIG, type AppConfig } from '../config.js';

export const REDIS = Symbol('REDIS');

@Module({
  providers: [
    {
      provide: REDIS,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig): Redis | null => {
        if (!config.REDIS_URL) return null;
        const logger = new Logger('Redis');
        const redis = new Redis(config.REDIS_URL, {
          // Fail fast instead of queueing commands while disconnected: callers
          // (rate limiting) have a fallback and must not add latency.
          enableOfflineQueue: false,
          maxRetriesPerRequest: 1,
          connectTimeout: 2_000,
          lazyConnect: false,
        });
        redis.on('error', (error: Error) => {
          logger.warn(`redis error: ${error.message}`);
        });
        return redis;
      },
    },
  ],
  exports: [REDIS],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS) private readonly redis: Redis | null) {}

  async onApplicationShutdown(): Promise<void> {
    if (this.redis && this.redis.status !== 'end') await this.redis.quit().catch(() => undefined);
  }
}
