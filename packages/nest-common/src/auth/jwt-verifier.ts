import {
  AccessTokenClaimsSchema,
  DomainError,
  ErrorCode,
  JWT_AUDIENCE,
  type AuthUser,
} from '@market/types';
import { createRemoteJWKSet, errors, jwtVerify, type JWTVerifyGetKey } from 'jose';

export interface JwtVerifierOptions {
  issuer: string;
  audience?: string;
  /** Allowed clock skew between pods, in seconds. */
  clockToleranceSeconds?: number;
}

/**
 * Verifies access tokens issued by auth-service. Only EdDSA is accepted, which
 * rules out algorithm-confusion attacks (`alg: none`, HS256 with a public key).
 */
export class JwtVerifier {
  constructor(
    private readonly keys: JWTVerifyGetKey,
    private readonly options: JwtVerifierOptions,
  ) {}

  /** Verifier backed by auth-service's JWKS endpoint (keys are cached and refreshed on rotation). */
  static fromJwksUrl(url: string, options: JwtVerifierOptions): JwtVerifier {
    return new JwtVerifier(
      createRemoteJWKSet(new URL(url), { cooldownDuration: 30_000, cacheMaxAge: 10 * 60_000 }),
      options,
    );
  }

  async verify(token: string): Promise<AuthUser> {
    let payload: Record<string, unknown>;
    try {
      ({ payload } = await jwtVerify(token, this.keys, {
        algorithms: ['EdDSA'],
        issuer: this.options.issuer,
        audience: this.options.audience ?? JWT_AUDIENCE,
        clockTolerance: this.options.clockToleranceSeconds ?? 5,
        requiredClaims: ['sub', 'exp', 'iat'],
      }));
    } catch (error) {
      if (error instanceof errors.JWTExpired) {
        throw new DomainError(ErrorCode.TOKEN_EXPIRED, 'Session expired');
      }
      throw new DomainError(ErrorCode.UNAUTHENTICATED, 'Authentication required');
    }
    const claims = AccessTokenClaimsSchema.safeParse(payload);
    if (!claims.success)
      throw new DomainError(ErrorCode.UNAUTHENTICATED, 'Authentication required');
    return {
      id: claims.data.sub,
      sessionId: claims.data.sid,
      roles: claims.data.roles,
      emailVerified: claims.data.email_verified,
      email: claims.data.email,
    };
  }
}
