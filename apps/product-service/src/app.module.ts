import {
  AuthModule,
  HealthModule,
  type JwtVerifier,
  backgroundTasks,
  type BackgroundTaskFactory,
} from '@market/nest-common';
import { Module, type DynamicModule, type OnApplicationShutdown } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { CatalogAdminController } from './catalog/catalog-admin.controller.js';
import { CatalogReaderService } from './catalog/catalog-reader.service.js';
import { CatalogWriterService } from './catalog/catalog-writer.service.js';
import { CatalogController } from './catalog/catalog.controller.js';
import { APP_CONFIG, SERVICE_NAME, type AppConfig } from './config.js';
import { ConfiguratorController } from './configurator/configurator.controller.js';
import { ConfiguratorService } from './configurator/configurator.service.js';
import { DATABASE, type Database } from './db/database.js';
import { ImagesService } from './images/images.service.js';
import { OBJECT_STORAGE, type ObjectStorage } from './images/object-storage.js';
import { InternalController } from './internal/internal.controller.js';
import { CATALOG_SEARCH } from './search/catalog-search.js';
import { PostgresCatalogSearch } from './search/postgres-catalog-search.js';

export interface AppDependencies {
  db: Database;
  verifier: JwtVerifier;
  storage: ObjectStorage | null;
  /** Kafka relay and consumers (absent in tests that drive handlers directly). */
  messaging?: BackgroundTaskFactory;
  onShutdown?: () => Promise<void>;
}

class InfrastructureLifecycle implements OnApplicationShutdown {
  constructor(private readonly onShutdown?: () => Promise<void>) {}

  async onApplicationShutdown(): Promise<void> {
    await this.onShutdown?.();
  }
}

@Module({})
export class AppModule {
  static register(config: AppConfig, deps: AppDependencies): DynamicModule {
    return {
      module: AppModule,
      global: true,
      imports: [
        AuthModule.forRoot(deps.verifier),
        HealthModule.register({
          serviceName: SERVICE_NAME,
          checks: () => [
            {
              name: 'database',
              check: async () => {
                await deps.db.execute(sql`select 1`);
              },
            },
          ],
        }),
      ],
      // Order matters: static admin routes before parameterised public ones.
      controllers: [
        CatalogAdminController,
        CatalogController,
        ConfiguratorController,
        InternalController,
      ],
      providers: [
        { provide: APP_CONFIG, useValue: config },
        { provide: DATABASE, useValue: deps.db },
        { provide: OBJECT_STORAGE, useValue: deps.storage },
        { provide: CATALOG_SEARCH, useClass: PostgresCatalogSearch },
        {
          provide: InfrastructureLifecycle,
          useValue: new InfrastructureLifecycle(deps.onShutdown),
        },
        CatalogReaderService,
        CatalogWriterService,
        ConfiguratorService,
        ImagesService,
        ...(deps.messaging ? [backgroundTasks(deps.messaging)] : []),
      ],
      exports: [APP_CONFIG, DATABASE],
    };
  }
}
