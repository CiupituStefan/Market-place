import { HealthModule } from '@market/nest-common';
import { type DynamicModule, Module } from '@nestjs/common';
import { APP_CONFIG, SERVICE_NAME, type AppConfig } from './config.js';

@Module({})
export class AppModule {
  static register(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      global: true,
      // Readiness checks for owned dependencies (database, Kafka) are added with them.
      imports: [HealthModule.register({ serviceName: SERVICE_NAME })],
      providers: [{ provide: APP_CONFIG, useValue: config }],
      exports: [APP_CONFIG],
    };
  }
}
