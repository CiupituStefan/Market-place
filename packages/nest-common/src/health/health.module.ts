import { Module, type DynamicModule, type ModuleMetadata } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';
import { HEALTH_CHECKS, HEALTH_SERVICE_NAME, type HealthCheck } from './health.types.js';

export interface HealthModuleOptions {
  serviceName: string;
  imports?: ModuleMetadata['imports'];
  inject?: (string | symbol | (abstract new (...args: never[]) => unknown))[];
  /** Builds the readiness checks from injected dependencies (DB pool, Redis, Kafka...). */
  checks?: (...deps: never[]) => HealthCheck[];
}

@Module({})
export class HealthModule {
  static register(options: HealthModuleOptions): DynamicModule {
    return {
      module: HealthModule,
      imports: options.imports ?? [],
      controllers: [HealthController],
      providers: [
        HealthService,
        { provide: HEALTH_SERVICE_NAME, useValue: options.serviceName },
        {
          provide: HEALTH_CHECKS,
          inject: options.inject ?? [],
          useFactory: options.checks ?? (() => []),
        },
      ],
      exports: [HealthService],
    };
  }
}
