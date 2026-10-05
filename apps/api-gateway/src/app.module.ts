import { type DynamicModule, Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from './config.js';
import { HealthController } from './health/health.controller.js';

@Module({})
export class AppModule {
  static register(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      global: true,
      controllers: [HealthController],
      providers: [{ provide: APP_CONFIG, useValue: config }],
      exports: [APP_CONFIG],
    };
  }
}
