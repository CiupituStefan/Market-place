import { Module, type DynamicModule } from '@nestjs/common';
import { AuthGuard, JWT_VERIFIER } from './auth.guard.js';
import type { JwtVerifier } from './jwt-verifier.js';

@Module({})
export class AuthModule {
  /** Registers the verifier globally so @Authenticated works in every module. */
  static forRoot(verifier: JwtVerifier): DynamicModule {
    return {
      module: AuthModule,
      global: true,
      providers: [{ provide: JWT_VERIFIER, useValue: verifier }, AuthGuard],
      exports: [JWT_VERIFIER, AuthGuard],
    };
  }
}
