import {
  AuthModule,
  HealthModule,
  JwtVerifier,
  backgroundTasks,
  type BackgroundTaskFactory,
} from '@market/nest-common';
import { Module, type DynamicModule, type OnApplicationShutdown } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { AccountRecoveryService } from './auth/account-recovery.service.js';
import { AuthController } from './auth/auth.controller.js';
import { AuthService } from './auth/auth.service.js';
import { OneTimeTokenService } from './auth/one-time-tokens.service.js';
import { SessionService } from './auth/session.service.js';
import { APP_CONFIG, SERVICE_NAME, type AppConfig } from './config.js';
import { DATABASE, type Database } from './db/database.js';
import { JwksController } from './tokens/jwks.controller.js';
import { SigningKeys } from './tokens/signing-keys.js';
import { UsersController } from './users/users.controller.js';
import { UsersService } from './users/users.service.js';

export interface AppDependencies {
  db: Database;
  keys: SigningKeys;
  /** Kafka relay (absent in tests). */
  messaging?: BackgroundTaskFactory;
  /** Releases infrastructure (connection pool) on graceful shutdown. */
  onShutdown?: () => Promise<void>;
}

export const JWKS_PATH = '.well-known/jwks.json';

class InfrastructureLifecycle implements OnApplicationShutdown {
  constructor(private readonly onShutdown?: () => Promise<void>) {}

  async onApplicationShutdown(): Promise<void> {
    await this.onShutdown?.();
  }
}

@Module({})
export class AppModule {
  /** Infrastructure is created outside Nest (main.ts or tests) and injected here. */
  static register(config: AppConfig, deps: AppDependencies): DynamicModule {
    return {
      module: AppModule,
      global: true,
      imports: [
        // auth-service verifies its own tokens in-process with its own keys.
        AuthModule.forRoot(
          new JwtVerifier(deps.keys.verificationKeys(), { issuer: deps.keys.issuer }),
        ),
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
      controllers: [AuthController, UsersController, JwksController],
      providers: [
        { provide: APP_CONFIG, useValue: config },
        { provide: DATABASE, useValue: deps.db },
        { provide: SigningKeys, useValue: deps.keys },
        AuthService,
        SessionService,
        OneTimeTokenService,
        AccountRecoveryService,
        UsersService,
        {
          provide: InfrastructureLifecycle,
          useValue: new InfrastructureLifecycle(deps.onShutdown),
        },
        ...(deps.messaging ? [backgroundTasks(deps.messaging)] : []),
      ],
      exports: [APP_CONFIG, DATABASE],
    };
  }
}
