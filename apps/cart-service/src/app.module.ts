import {
  AuthModule,
  HealthModule,
  type JwtVerifier,
  backgroundTasks,
  type BackgroundTaskFactory,
} from '@market/nest-common';
import { Module, type DynamicModule, type OnApplicationShutdown } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { CartController } from './cart/cart.controller.js';
import { CartService } from './cart/cart.service.js';
import {
  CATALOG,
  INVENTORY,
  type CatalogGateway,
  type InventoryGateway,
} from './clients/clients.js';
import { APP_CONFIG, SERVICE_NAME, type AppConfig } from './config.js';
import { DATABASE, type Database } from './db/database.js';
import { DiscountService } from './discounts/discount.service.js';
import { DiscountsController } from './discounts/discounts.controller.js';
import { InternalController } from './internal/internal.controller.js';
import { WishlistController } from './wishlist/wishlist.controller.js';
import { WishlistService } from './wishlist/wishlist.service.js';

export interface AppDependencies {
  db: Database;
  verifier: JwtVerifier;
  catalog: CatalogGateway;
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
          // Only our own database gates readiness: product/inventory outages
          // degrade cart responses but must not take the cart offline.
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
      controllers: [CartController, WishlistController, DiscountsController, InternalController],
      providers: [
        { provide: APP_CONFIG, useValue: config },
        { provide: DATABASE, useValue: deps.db },
        { provide: CATALOG, useValue: deps.catalog },
        { provide: INVENTORY, useValue: deps.inventory },
        {
          provide: InfrastructureLifecycle,
          useValue: new InfrastructureLifecycle(deps.onShutdown),
        },
        CartService,
        WishlistService,
        DiscountService,
        ...(deps.messaging ? [backgroundTasks(deps.messaging)] : []),
      ],
      exports: [APP_CONFIG, DATABASE],
    };
  }
}
