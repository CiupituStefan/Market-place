import { JWT_AUDIENCE, type AccessTokenClaims } from '@market/types';
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  importPKCS8,
  importSPKI,
  SignJWT,
  type CryptoKey,
  type JSONWebKeySet,
  type JWK,
  type JWTVerifyGetKey,
} from 'jose';

const ALG = 'EdDSA';

/** Accepts a PEM as-is or base64-encoded (easier to pass through env vars and secret stores). */
function pem(value: string): string {
  return value.includes('-----BEGIN') ? value : Buffer.from(value, 'base64').toString('utf8');
}

/**
 * Ed25519 signing key for access tokens plus the public JWKS that services use
 * to verify them. Rotation: deploy the new private key with the old public key
 * as JWT_PREVIOUS_PUBLIC_KEY, wait one access-token TTL, then drop the old key.
 */
export class SigningKeys {
  private constructor(
    private readonly privateKey: CryptoKey,
    private readonly keyId: string,
    readonly jwks: JSONWebKeySet,
    readonly issuer: string,
    /** True when no key was configured and an ephemeral one was generated (development). */
    readonly ephemeral: boolean,
  ) {}

  static async load(options: {
    privateKeyPem?: string | undefined;
    keyId: string;
    previousPublicKeyPem?: string | undefined;
    previousKeyId?: string | undefined;
    issuer: string;
  }): Promise<SigningKeys> {
    let privateKey: CryptoKey;
    let publicJwk: JWK;
    const ephemeral = !options.privateKeyPem;
    if (options.privateKeyPem) {
      privateKey = await importPKCS8(pem(options.privateKeyPem), ALG, { extractable: true });
      const { d: _private, ...publicPart } = await exportJWK(privateKey);
      publicJwk = publicPart;
    } else {
      const pair = await generateKeyPair(ALG, { crv: 'Ed25519', extractable: true });
      privateKey = pair.privateKey;
      publicJwk = await exportJWK(pair.publicKey);
    }
    const keys: JWK[] = [{ ...publicJwk, kid: options.keyId, alg: ALG, use: 'sig' }];
    if (options.previousPublicKeyPem) {
      const previous = await exportJWK(
        await importSPKI(pem(options.previousPublicKeyPem), ALG, { extractable: true }),
      );
      keys.push({
        ...previous,
        kid: options.previousKeyId ?? `${options.keyId}-previous`,
        alg: ALG,
        use: 'sig',
      });
    }
    return new SigningKeys(privateKey, options.keyId, { keys }, options.issuer, ephemeral);
  }

  async signAccessToken(claims: AccessTokenClaims, ttlSeconds: number): Promise<string> {
    const { sub, ...rest } = claims;
    return new SignJWT(rest)
      .setProtectedHeader({ alg: ALG, kid: this.keyId, typ: 'JWT' })
      .setSubject(sub)
      .setIssuer(this.issuer)
      .setAudience(JWT_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${ttlSeconds}s`)
      .sign(this.privateKey);
  }

  /** Key resolver for verifying our own tokens in-process. */
  verificationKeys(): JWTVerifyGetKey {
    return createLocalJWKSet(this.jwks);
  }
}
