import { JWT_AUDIENCE, type AuthUser } from '@market/types';
import { Controller, Get, Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type CryptoKey } from 'jose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { configureApp } from '../bootstrap.js';
import { memoryLogger } from '../test-utils.js';
import { AuthModule } from './auth.module.js';
import { Authenticated, CurrentUser, MaybeUser, OptionallyAuthenticated } from './decorators.js';
import { JwtVerifier } from './jwt-verifier.js';
import { extractAccessToken, readCookie } from './token.js';

const ISSUER = 'cse-auth-test';
const USER_ID = '0b7c1f0e-4f2a-4d8e-9a43-3c1f6f1c9a10';
const SESSION_ID = '5a2d8c3e-1b4f-4e6a-8c7d-2f9e0a1b3c4d';

let privateKey: CryptoKey;
let verifier: JwtVerifier;

async function token(
  overrides: { roles?: string[]; exp?: string | number; iss?: string; key?: CryptoKey } = {},
) {
  return new SignJWT({ sid: SESSION_ID, roles: overrides.roles ?? ['USER'], email_verified: true })
    .setProtectedHeader({ alg: 'EdDSA', kid: 'k1' })
    .setSubject(USER_ID)
    .setIssuer(overrides.iss ?? ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(overrides.exp ?? '15m')
    .sign(overrides.key ?? privateKey);
}

beforeAll(async () => {
  const pair = await generateKeyPair('EdDSA', { crv: 'Ed25519' });
  privateKey = pair.privateKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: 'k1', alg: 'EdDSA' };
  verifier = new JwtVerifier(createLocalJWKSet({ keys: [jwk] }), { issuer: ISSUER });
});

describe('token extraction', () => {
  it('reads cookies and bearer tokens', () => {
    expect(readCookie('a=1; cse_at=tok%20en; b=2', 'cse_at')).toBe('tok en');
    expect(readCookie('xcse_at=1', 'cse_at')).toBeUndefined();
    expect(extractAccessToken({ authorization: 'Bearer abc', cookie: 'cse_at=def' })).toBe('abc');
    expect(extractAccessToken({ cookie: 'cse_at=def' })).toBe('def');
    expect(extractAccessToken({})).toBeUndefined();
  });
});

describe('JwtVerifier', () => {
  it('returns the principal for a valid token', async () => {
    await expect(verifier.verify(await token({ roles: ['USER', 'STAFF'] }))).resolves.toEqual({
      id: USER_ID,
      sessionId: SESSION_ID,
      roles: ['USER', 'STAFF'],
      emailVerified: true,
    } satisfies AuthUser);
  });

  it('reports expired tokens distinctly so clients can refresh', async () => {
    const expired = await token({ exp: Math.floor(Date.now() / 1000) - 60 });
    await expect(verifier.verify(expired)).rejects.toMatchObject({ code: 'TOKEN_EXPIRED' });
  });

  it('rejects wrong issuer, foreign keys and garbage', async () => {
    await expect(verifier.verify(await token({ iss: 'someone-else' }))).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
    const foreign = await generateKeyPair('EdDSA', { crv: 'Ed25519' });
    await expect(verifier.verify(await token({ key: foreign.privateKey }))).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
    await expect(verifier.verify('not.a.jwt')).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('rejects unsigned (alg: none) and HMAC tokens', async () => {
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const claims = {
      sub: USER_ID,
      sid: SESSION_ID,
      roles: ['ADMIN'],
      email_verified: true,
      iss: ISSUER,
      aud: JWT_AUDIENCE,
      iat: 1,
      exp: 9999999999,
    };
    const none = `${encode({ alg: 'none', kid: 'k1' })}.${encode(claims)}.`;
    await expect(verifier.verify(none)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    const hs = await new SignJWT(claims)
      .setProtectedHeader({ alg: 'HS256', kid: 'k1' })
      .sign(new TextEncoder().encode('secret'));
    await expect(verifier.verify(hs)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('rejects tokens with invalid claims (e.g. unknown roles)', async () => {
    await expect(verifier.verify(await token({ roles: ['SUPERUSER'] }))).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
  });
});

@Controller('secure')
class SecureController {
  @Get('me')
  @Authenticated()
  me(@CurrentUser() user: AuthUser) {
    return user;
  }

  @Get('maybe')
  @OptionallyAuthenticated()
  maybe(@MaybeUser() user: AuthUser | undefined) {
    return { user: user?.id ?? null };
  }

  @Get('staff')
  @Authenticated('STAFF', 'ADMIN')
  staff() {
    return { ok: true };
  }
}

describe('AuthGuard (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    @Module({ imports: [AuthModule.forRoot(verifier)], controllers: [SecureController] })
    class TestModule {}
    const moduleRef = await Test.createTestingModule({ imports: [TestModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app, { logger: memoryLogger().logger });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires a token', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/secure/me').expect(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('accepts the session cookie and injects the user', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/secure/me')
      .set('cookie', `cse_at=${await token()}`)
      .expect(200);
    expect(res.body.id).toBe(USER_ID);
  });

  it('optional authentication serves guests and recognises users', async () => {
    await request(app.getHttpServer()).get('/api/v1/secure/maybe').expect(200, { user: null });
    await request(app.getHttpServer())
      .get('/api/v1/secure/maybe')
      .set('cookie', `cse_at=${await token()}`)
      .expect(200, { user: USER_ID });
    const expired = await token({ exp: Math.floor(Date.now() / 1000) - 60 });
    const res = await request(app.getHttpServer())
      .get('/api/v1/secure/maybe')
      .set('cookie', `cse_at=${expired}`)
      .expect(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('enforces roles', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/secure/staff')
      .set('authorization', `Bearer ${await token()}`)
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/v1/secure/staff')
      .set('authorization', `Bearer ${await token({ roles: ['USER', 'STAFF'] })}`)
      .expect(200);
  });
});
