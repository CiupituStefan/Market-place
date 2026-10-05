import {
  AuthModule,
  backgroundTasks,
  HealthModule,
  type BackgroundTaskFactory,
  type JwtVerifier,
} from '@market/nest-common';
import { Module, type DynamicModule, type OnApplicationShutdown } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { ORDERS, type OrdersGateway } from './clients/orders.js';
import { APP_CONFIG, SERVICE_NAME, type AppConfig } from './config.js';
import { DATABASE, type Database } from './db/database.js';
import { ManagePaymentsController } from './payments/manage.controller.js';
import { MockPaymentsController } from './payments/mock.controller.js';
import { PaymentService } from './payments/payment.service.js';
import { PaymentsController } from './payments/payments.controller.js';
import { PAYMENT_PROVIDER, type PaymentProvider } from './provider/provider.js';

export interface AppDependencies {
  db: Database;
  verifier: JwtVerifier;
  provider: PaymentProvider;
  orders: OrdersGateway;
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
      // Static paths (manage, mock) before anything parameterized.
      controllers: [
        ManagePaymentsController,
        ...(deps.provider.name === 'mock' ? [MockPaymentsController] : []),
        PaymentsController,
      ],
      providers: [
        { provide: APP_CONFIG, useValue: config },
        { provide: DATABASE, useValue: deps.db },
        { provide: PAYMENT_PROVIDER, useValue: deps.provider },
        { provide: ORDERS, useValue: deps.orders },
        {
          provide: InfrastructureLifecycle,
          useValue: new InfrastructureLifecycle(deps.onShutdown),
        },
        PaymentService,
        ...(deps.messaging ? [backgroundTasks(deps.messaging)] : []),
      ],
      exports: [APP_CONFIG, DATABASE],
    };
  }
}
