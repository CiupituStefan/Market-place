import {
  AuthModule,
  HealthModule,
  type JwtVerifier,
  backgroundTasks,
  type BackgroundTaskFactory,
} from '@market/nest-common';
import { Module, type DynamicModule, type OnApplicationShutdown } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { CART, INVENTORY, type CartGateway, type InventoryGateway } from './clients/clients.js';
import { APP_CONFIG, SERVICE_NAME, type AppConfig } from './config.js';
import { DATABASE, type Database } from './db/database.js';
import { InternalController } from './internal/internal.controller.js';
import { CheckoutService } from './orders/checkout.service.js';
import { ManageOrdersController } from './orders/manage.controller.js';
import { OrderSweeper } from './orders/order-sweeper.js';
import { OrderService } from './orders/order.service.js';
import { OrdersController } from './orders/orders.controller.js';

export interface AppDependencies {
  db: Database;
  verifier: JwtVerifier;
  cart: CartGateway;
  inventory: InventoryGateway;
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
      // ManageOrdersController first: `orders/manage` must win over `orders/:id`.
      controllers: [ManageOrdersController, OrdersController, InternalController],
      providers: [
        { provide: APP_CONFIG, useValue: config },
        { provide: DATABASE, useValue: deps.db },
        { provide: CART, useValue: deps.cart },
        { provide: INVENTORY, useValue: deps.inventory },
        {
          provide: InfrastructureLifecycle,
          useValue: new InfrastructureLifecycle(deps.onShutdown),
        },
        CheckoutService,
        OrderService,
        OrderSweeper,
        ...(deps.messaging ? [backgroundTasks(deps.messaging)] : []),
      ],
      exports: [APP_CONFIG, DATABASE],
    };
  }
}
