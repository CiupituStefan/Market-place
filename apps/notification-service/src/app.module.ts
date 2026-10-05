import {
  AuthModule,
  backgroundTasks,
  HealthModule,
  type BackgroundTaskFactory,
  type JwtVerifier,
} from '@market/nest-common';
import { Module, type DynamicModule, type OnApplicationShutdown } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { APP_CONFIG, SERVICE_NAME, type AppConfig } from './config.js';
import { DATABASE, type Database } from './db/database.js';
import { Dispatcher } from './delivery/dispatcher.js';
import { EMAIL_PROVIDER, type EmailProvider } from './delivery/provider.js';
import { NewsletterController } from './newsletter/newsletter.controller.js';
import { NewsletterService } from './newsletter/newsletter.service.js';
import { ManageNotificationsController } from './notifications/manage.controller.js';
import { NotificationService } from './notifications/notification.service.js';
import { PreferencesController } from './preferences/preferences.controller.js';

export interface AppDependencies {
  db: Database;
  verifier: JwtVerifier;
  email: EmailProvider;
  /** Kafka consumers (absent in tests that drive handlers directly). */
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
      // `notifications/manage` before anything else under `notifications`.
      controllers: [ManageNotificationsController, PreferencesController, NewsletterController],
      providers: [
        { provide: APP_CONFIG, useValue: config },
        { provide: DATABASE, useValue: deps.db },
        { provide: EMAIL_PROVIDER, useValue: deps.email },
        {
          provide: InfrastructureLifecycle,
          useValue: new InfrastructureLifecycle(deps.onShutdown),
        },
        NotificationService,
        NewsletterService,
        Dispatcher,
        ...(deps.messaging ? [backgroundTasks(deps.messaging)] : []),
      ],
      exports: [APP_CONFIG, DATABASE, NotificationService, Dispatcher],
    };
  }
}
