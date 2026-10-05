import { AuthModule, HealthModule, type JwtVerifier } from '@market/nest-common';
import { Module, type DynamicModule, type OnApplicationShutdown } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { APP_CONFIG, SERVICE_NAME, type AppConfig } from './config.js';
import { DATABASE, type Database } from './db/database.js';
import { ExpiryWorker } from './reservations/expiry.worker.js';
import { InternalController } from './reservations/internal.controller.js';
import { ReservationService } from './reservations/reservation.service.js';
import { StockController } from './stock/stock.controller.js';
import { StockService } from './stock/stock.service.js';

export interface AppDependencies {
  db: Database;
  verifier: JwtVerifier;
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
      controllers: [StockController, InternalController],
      providers: [
        { provide: APP_CONFIG, useValue: config },
        { provide: DATABASE, useValue: deps.db },
        {
          provide: InfrastructureLifecycle,
          useValue: new InfrastructureLifecycle(deps.onShutdown),
        },
        StockService,
        ReservationService,
        ExpiryWorker,
      ],
      exports: [APP_CONFIG, DATABASE],
    };
  }
}
