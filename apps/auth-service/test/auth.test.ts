import { randomUUID } from 'node:crypto';
import { NotificationRequestedV1 } from '@market/events';
import { JwtVerifier } from '@market/nest-common';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { oneTimeTokens, outboxEvents, sessions, users } from '../src/db/schema.js';
import { timeStep, totpCode } from '../src/mfa/totp.js';
import { cookiesFrom, createHarness, type Harness } from './harness.js';

const PASSWORD = 'correct horse battery staple';

let h: Harness;
let http: ReturnType<Harness['app']['getHttpServer']>;

beforeAll(async () => {
  h = await createHarness();
  http = h.app.getHttpServer();
});

afterAll(async () => {
  await h.close();
});

let counter = 0;
function newEmail() {
  counter += 1;
  return `user${counter}@example.com`;
}

async function register(email = newEmail(), password = PASSWORD) {
  await request(http)
    .post('/api/v1/auth/register')
    .send({ email, password, firstName: 'Ana', lastName: 'Pop' })
    .expect(201);
  return email;
}

async function login(email: string, password = PASSWORD) {
  const res = await request(http).post('/api/v1/auth/login').send({ email, password }).expect(200);
  const cookies = cookiesFrom(res.headers['set-cookie']);
  return { res, access: cookies.cse_at!.value, refresh: cookies.cse_rt!.value, cookies };
}

/**
 * Turns two-step sign-in on through the API (setup → enable) and returns the secret. Codes are
 * single-use per 30 s step, so `code(n)` gives the code n steps ahead: accepted (one step of
 * drift is allowed) and never one already spent.
 */
async function enableMfa(email: string, password = PASSWORD) {
  const { access } = await login(email, password);
  const setup = await request(http)
    .post('/api/v1/auth/mfa/setup')
    .set('cookie', `cse_at=${access}`)
    .send({ password })
    .expect(200);
  const secret: string = setup.body.secret;
  const enabled = await request(http)
    .post('/api/v1/auth/mfa/enable')
    .set('cookie', `cse_at=${access}`)
    .send({ code: totpCode(secret, timeStep()) })
    .expect(200);
  return { secret, recoveryCodes: enabled.body.recoveryCodes as string[], oldAccess: access };
}

const code = (secret: string, ahead = 1) => totpCode(secret, timeStep() + ahead);

/** Password step, then the code step; returns the session cookies. */
async function loginWithCode(email: string, codeValue: string, password = PASSWORD) {
  const first = await request(http)
    .post('/api/v1/auth/login')
    .send({ email, password })
    .expect(200);
  expect(first.body).toEqual({ mfaRequired: true, challenge: expect.any(String) });
  expect(first.headers['set-cookie']).toBeUndefined();
  const second = await request(http)
    .post('/api/v1/auth/login/mfa')
    .send({ challenge: first.body.challenge, code: codeValue });
  const cookies = cookiesFrom(second.headers['set-cookie']);
  return { res: second, challenge: first.body.challenge as string, access: cookies.cse_at?.value };
}

/** Email links are only in the outbox event (the raw token is never stored). */
async function latestLink(
  email: string,
  template: 'EMAIL_VERIFICATION' | 'PASSWORD_RESET',
): Promise<string> {
  const rows = await h.db.select().from(outboxEvents);
  const event = rows
    .map(
      (row) =>
        row.envelope as {
          eventType: string;
          payload: { template: string; recipient: { email: string }; data: { link: string } };
        },
    )
    .filter(
      (e) =>
        e.eventType === 'NotificationRequested' &&
        e.payload.template === template &&
        e.payload.recipient.email === email,
    )
    .at(-1);
  if (!event) throw new Error(`no ${template} email for ${email}`);
  return new URL(event.payload.data.link).searchParams.get('token')!;
}

describe('registration', () => {
  it('creates a user, normalises the email and never returns secrets', async () => {
    const res = await request(http)
      .post('/api/v1/auth/register')
      .send({
        email: '  Maria@Example.COM ',
        password: PASSWORD,
        firstName: 'Maria',
        lastName: 'Ionescu',
      })
      .expect(201);
    expect(res.body.user).toMatchObject({
      email: 'maria@example.com',
      roles: ['USER'],
      emailVerified: false,
    });
    expect(JSON.stringify(res.body)).not.toMatch(/argon2|password/i);
  });

  it('stores an Argon2id hash, not the password', async () => {
    const email = await register();
    const [user] = await h.db.select().from(users).where(eq(users.email, email));
    expect(user!.passwordHash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  });

  it('requests a verification email through the outbox, in the same transaction', async () => {
    const email = await register();
    const rows = await h.db.select().from(outboxEvents);
    const event = rows.map((r) => r.envelope as { eventType: string; payload: unknown }).at(-1)!;
    expect(event.eventType).toBe(NotificationRequestedV1.type);
    expect(NotificationRequestedV1.payload.parse(event.payload)).toMatchObject({
      template: 'EMAIL_VERIFICATION',
      recipient: { email },
    });
    // The database only has the hash of the token that was emailed.
    const token = await latestLink(email, 'EMAIL_VERIFICATION');
    const stored = await h.db.select().from(oneTimeTokens);
    expect(stored.some((t) => t.tokenHash === token)).toBe(false);
  });

  it('sends the email in the storefront language, linking to the page in that language', async () => {
    const lastRequest = async (email: string) => {
      const rows = await h.db.select().from(outboxEvents);
      const event = rows
        .map((r) => r.envelope as { eventType: string; payload: unknown })
        .filter((e) => e.eventType === NotificationRequestedV1.type)
        .map((e) => NotificationRequestedV1.payload.parse(e.payload))
        .filter((p) => p.recipient.email === email)
        .at(-1)!;
      return { locale: event.locale, link: new URL(String(event.data.link)).pathname };
    };
    const email = newEmail();
    await request(http)
      .post('/api/v1/auth/register?locale=ro')
      .send({ email, password: PASSWORD, firstName: 'Ana', lastName: 'Pop' })
      .expect(201);
    expect(await lastRequest(email)).toEqual({ locale: 'ro', link: '/ro/verify-email' });

    await request(http).post('/api/v1/auth/forgot-password?locale=xx').send({ email }).expect(202);
    expect(await lastRequest(email)).toEqual({ locale: 'en', link: '/reset-password' });
  });

  it('rejects duplicates (case-insensitively) with 409', async () => {
    const email = await register();
    const res = await request(http)
      .post('/api/v1/auth/register')
      .send({ email: email.toUpperCase(), password: PASSWORD, firstName: 'A', lastName: 'B' })
      .expect(409);
    expect(res.body.error.code).toBe('EMAIL_ALREADY_REGISTERED');
  });

  it('validates input', async () => {
    const res = await request(http)
      .post('/api/v1/auth/register')
      .send({
        email: 'not-an-email',
        password: 'short',
        firstName: '',
        lastName: 'B',
        isAdmin: true,
      })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    const paths = res.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['email', 'password', 'firstName']));
  });

  it('cannot self-assign roles (unknown fields are rejected)', async () => {
    await request(http)
      .post('/api/v1/auth/register')
      .send({
        email: newEmail(),
        password: PASSWORD,
        firstName: 'A',
        lastName: 'B',
        roles: ['ADMIN'],
      })
      .expect(400);
  });
});

describe('login', () => {
  it('sets hardened session cookies and a verifiable access token', async () => {
    const email = await register();
    const { cookies, access, res } = await login(email);
    expect(res.body.user.email).toBe(email);
    expect(cookies.cse_at!.attributes).toMatch(/HttpOnly/);
    expect(cookies.cse_at!.attributes).toMatch(/SameSite=Lax/);
    expect(cookies.cse_at!.attributes).toMatch(/Path=\//);
    expect(cookies.cse_rt!.attributes).toMatch(/HttpOnly/);
    expect(cookies.cse_rt!.attributes).toMatch(/SameSite=Strict/);
    expect(cookies.cse_rt!.attributes).toMatch(/Path=\/api\/v1\/auth/);

    const verifier = new JwtVerifier(h.keys.verificationKeys(), { issuer: h.config.JWT_ISSUER });
    await expect(verifier.verify(access)).resolves.toMatchObject({
      roles: ['USER'],
      emailVerified: false,
    });
  });

  it('gives the same answer for unknown emails and wrong passwords', async () => {
    const email = await register();
    const wrong = await request(http)
      .post('/api/v1/auth/login')
      .send({ email, password: 'wrong password!!' })
      .expect(401);
    const unknown = await request(http)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: PASSWORD })
      .expect(401);
    expect(wrong.body.error).toMatchObject({
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password',
    });
    expect(unknown.body.error.message).toBe(wrong.body.error.message);
  });

  it('locks the account after repeated failures, even for the right password', async () => {
    const email = await register();
    for (let i = 0; i < 3; i += 1) {
      await request(http)
        .post('/api/v1/auth/login')
        .send({ email, password: 'wrong password!!' })
        .expect(401);
    }
    await request(http).post('/api/v1/auth/login').send({ email, password: PASSWORD }).expect(401);
    const [user] = await h.db.select().from(users).where(eq(users.email, email));
    expect(user!.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
  });
});

describe('session', () => {
  it('GET /auth/me returns the user for a valid cookie', async () => {
    const email = await register();
    const { access } = await login(email);
    const res = await request(http)
      .get('/api/v1/auth/me')
      .set('cookie', `cse_at=${access}`)
      .expect(200);
    expect(res.body).toMatchObject({ email });
  });

  it('GET /auth/me without a session is 401', async () => {
    await request(http).get('/api/v1/auth/me').expect(401);
  });

  it('refresh rotates the refresh token and issues a new access token', async () => {
    const email = await register();
    const first = await login(email);
    const res = await request(http)
      .post('/api/v1/auth/refresh')
      .set('cookie', `cse_rt=${first.refresh}`)
      .expect(200);
    const cookies = cookiesFrom(res.headers['set-cookie']);
    expect(cookies.cse_rt!.value).not.toBe(first.refresh);
    expect(cookies.cse_at!.value).toBeTruthy();
    await request(http)
      .get('/api/v1/auth/me')
      .set('cookie', `cse_at=${cookies.cse_at!.value}`)
      .expect(200);
  });

  it('detects refresh token reuse and revokes the whole session', async () => {
    const email = await register();
    const first = await login(email);
    const rotated = await request(http)
      .post('/api/v1/auth/refresh')
      .set('cookie', `cse_rt=${first.refresh}`)
      .expect(200);
    const second = cookiesFrom(rotated.headers['set-cookie']).cse_rt!.value;

    // An attacker replays the old token...
    await request(http)
      .post('/api/v1/auth/refresh')
      .set('cookie', `cse_rt=${first.refresh}`)
      .expect(401);
    // ...which also kills the legitimate, newer token and the access token's session.
    await request(http).post('/api/v1/auth/refresh').set('cookie', `cse_rt=${second}`).expect(401);
    await request(http).get('/api/v1/auth/me').set('cookie', `cse_at=${first.access}`).expect(401);
    const [session] = await h.db
      .select()
      .from(sessions)
      .where(eq(sessions.revokedReason, 'refresh_token_reuse'));
    expect(session).toBeDefined();
  });

  it('logout revokes the session and clears cookies', async () => {
    const email = await register();
    const { access, refresh } = await login(email);
    const res = await request(http)
      .post('/api/v1/auth/logout')
      .set('cookie', `cse_rt=${refresh}`)
      .expect(204);
    const cleared = cookiesFrom(res.headers['set-cookie']);
    expect(cleared.cse_at!.attributes).toMatch(/Expires=Thu, 01 Jan 1970/);
    await request(http).post('/api/v1/auth/refresh').set('cookie', `cse_rt=${refresh}`).expect(401);
    await request(http).get('/api/v1/auth/me').set('cookie', `cse_at=${access}`).expect(401);
  });

  it('rejects unknown refresh tokens', async () => {
    await request(http)
      .post('/api/v1/auth/refresh')
      .set('cookie', 'cse_rt=not-a-real-token')
      .expect(401);
    await request(http).post('/api/v1/auth/refresh').expect(401);
  });
});

describe('email verification', () => {
  it('verifies with the emailed token, once', async () => {
    const email = await register();
    const token = await latestLink(email, 'EMAIL_VERIFICATION');
    await request(http).post('/api/v1/auth/verify-email').send({ token }).expect(204);
    const res = await request(http).post('/api/v1/auth/verify-email').send({ token }).expect(400);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
    const { res: loginRes } = await login(email);
    expect(loginRes.body.user.emailVerified).toBe(true);
  });

  it('resend invalidates the previous link', async () => {
    const email = await register();
    const oldToken = await latestLink(email, 'EMAIL_VERIFICATION');
    const { access } = await login(email);
    await request(http)
      .post('/api/v1/auth/verify-email/resend')
      .set('cookie', `cse_at=${access}`)
      .expect(202);
    const newToken = await latestLink(email, 'EMAIL_VERIFICATION');
    expect(newToken).not.toBe(oldToken);
    await request(http).post('/api/v1/auth/verify-email').send({ token: oldToken }).expect(400);
    await request(http).post('/api/v1/auth/verify-email').send({ token: newToken }).expect(204);
  });
});

describe('password reset', () => {
  it('answers 202 for unknown emails without creating anything', async () => {
    const before = (await h.db.select().from(outboxEvents)).length;
    await request(http)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'ghost@example.com' })
      .expect(202);
    expect((await h.db.select().from(outboxEvents)).length).toBe(before);
  });

  it('resets the password, signs out every device and lifts lockouts', async () => {
    const email = await register();
    const device = await login(email);
    await request(http).post('/api/v1/auth/forgot-password').send({ email }).expect(202);
    const token = await latestLink(email, 'PASSWORD_RESET');

    const newPassword = 'a brand new long passphrase';
    await request(http)
      .post('/api/v1/auth/reset-password')
      .send({ token, password: newPassword })
      .expect(204);

    await request(http)
      .post('/api/v1/auth/refresh')
      .set('cookie', `cse_rt=${device.refresh}`)
      .expect(401);
    await request(http).post('/api/v1/auth/login').send({ email, password: PASSWORD }).expect(401);
    const { res } = await login(email, newPassword);
    expect(res.body.user.emailVerified).toBe(true);
    // Single use.
    await request(http)
      .post('/api/v1/auth/reset-password')
      .send({ token, password: newPassword })
      .expect(400);
  });
});

describe('back-office users API', () => {
  /** Staff and admins sign in with the second factor, as they must to act with their roles. */
  async function loginAs(roles: string[]) {
    const email = await register();
    await h.db.update(users).set({ roles }).where(eq(users.email, email));
    let access: string;
    if (roles.length > 1) {
      const { secret } = await enableMfa(email);
      access = (await loginWithCode(email, code(secret))).access!;
    } else {
      access = (await login(email)).access;
    }
    const [user] = await h.db.select().from(users).where(eq(users.email, email));
    return { access, id: user!.id };
  }

  it('is closed to customers', async () => {
    const customer = await loginAs(['USER']);
    await request(http).get('/api/v1/users').set('cookie', `cse_at=${customer.access}`).expect(403);
    await request(http).get('/api/v1/users').expect(401);
  });

  it('lets staff search users, with LIKE wildcards matched literally', async () => {
    const staff = await loginAs(['USER', 'STAFF']);
    const res = await request(http)
      .get('/api/v1/users?q=example.com&pageSize=5')
      .set('cookie', `cse_at=${staff.access}`)
      .expect(200);
    expect(res.body).toMatchObject({ page: 1, pageSize: 5 });
    expect(res.body.items.length).toBeGreaterThan(0);
    const wildcard = await request(http)
      .get('/api/v1/users?q=%25')
      .set('cookie', `cse_at=${staff.access}`)
      .expect(200);
    expect(wildcard.body.total).toBe(0);
    const one = await request(http)
      .get(`/api/v1/users/${staff.id}`)
      .set('cookie', `cse_at=${staff.access}`)
      .expect(200);
    expect(one.body).toMatchObject({ id: staff.id, roles: ['USER', 'STAFF'] });
    expect(one.body).not.toHaveProperty('passwordHash');
    await request(http)
      .get(`/api/v1/users/${randomUUID()}`)
      .set('cookie', `cse_at=${staff.access}`)
      .expect(404);
  });

  it('only admins change roles, and the change signs the user out', async () => {
    const staff = await loginAs(['USER', 'STAFF']);
    const admin = await loginAs(['USER', 'STAFF', 'ADMIN']);
    const target = await loginAs(['USER']);
    await request(http)
      .patch(`/api/v1/users/${target.id}/roles`)
      .set('cookie', `cse_at=${staff.access}`)
      .send({ roles: ['USER', 'ADMIN'] })
      .expect(403);
    const res = await request(http)
      .patch(`/api/v1/users/${target.id}/roles`)
      .set('cookie', `cse_at=${admin.access}`)
      .send({ roles: ['USER', 'STAFF'] })
      .expect(200);
    expect(res.body.roles).toEqual(['USER', 'STAFF']);
    await request(http).get('/api/v1/auth/me').set('cookie', `cse_at=${target.access}`).expect(401);
  });

  it('admins cannot demote themselves', async () => {
    const admin = await loginAs(['USER', 'STAFF', 'ADMIN']);
    await request(http)
      .patch(`/api/v1/users/${admin.id}/roles`)
      .set('cookie', `cse_at=${admin.access}`)
      .send({ roles: ['USER'] })
      .expect(409);
  });
});

describe('two-step sign-in (TOTP)', () => {
  async function staffAccount() {
    const email = await register();
    await h.db
      .update(users)
      .set({ roles: ['USER', 'STAFF'] })
      .where(eq(users.email, email));
    return email;
  }

  it('gives staff without it customer rights only, and says why', async () => {
    const email = await staffAccount();
    const { access } = await login(email);
    await request(http).get('/api/v1/users').set('cookie', `cse_at=${access}`).expect(403);
    const me = await request(http).get('/api/v1/auth/me').set('cookie', `cse_at=${access}`);
    expect(me.body).toMatchObject({ roles: ['USER'], mfaEnabled: false, mfaSetupRequired: true });
  });

  it('sets up only with the password and a working code, then signs every device out', async () => {
    const email = await staffAccount();
    const { access } = await login(email);
    const auth = { cookie: `cse_at=${access}` };
    await request(http)
      .post('/api/v1/auth/mfa/setup')
      .set(auth)
      .send({ password: 'not the password' })
      .expect(401);
    const setup = await request(http)
      .post('/api/v1/auth/mfa/setup')
      .set(auth)
      .send({ password: PASSWORD })
      .expect(200);
    expect(setup.body.otpauthUri).toMatch(/^otpauth:\/\/totp\/CSE%20Keyboards%3A/);
    const [stored] = await h.db.select().from(users).where(eq(users.email, email));
    expect(stored!.totpSecret).toMatch(/^v1\./); // sealed, not the secret itself
    expect(stored!.totpSecret).not.toContain(setup.body.secret);

    const wrong = await request(http)
      .post('/api/v1/auth/mfa/enable')
      .set(auth)
      .send({ code: '000000' === code(setup.body.secret, 0) ? '111111' : '000000' })
      .expect(401);
    expect(wrong.body.error.code).toBe('INVALID_MFA_CODE');
    const enabled = await request(http)
      .post('/api/v1/auth/mfa/enable')
      .set(auth)
      .send({ code: code(setup.body.secret, 0) })
      .expect(200);
    expect(enabled.body.recoveryCodes).toHaveLength(10);
    await request(http).get('/api/v1/auth/me').set(auth).expect(401);
  });

  it('asks for the code after the password, and unlocks the roles with it', async () => {
    const email = await staffAccount();
    const { secret } = await enableMfa(email);
    const { res, access } = await loginWithCode(email, code(secret));
    expect(res.status).toBe(200);
    await request(http).get('/api/v1/users').set('cookie', `cse_at=${access}`).expect(200);
    const me = await request(http).get('/api/v1/auth/me').set('cookie', `cse_at=${access}`);
    expect(me.body).toMatchObject({
      roles: ['USER', 'STAFF'],
      mfaEnabled: true,
      mfaSetupRequired: false,
    });
    const status = await request(http).get('/api/v1/auth/mfa').set('cookie', `cse_at=${access}`);
    expect(status.body).toEqual({ enabled: true, recoveryCodesLeft: 10, sessionVerified: true });
  });

  it('refuses a code already used, a used challenge and a wrong password', async () => {
    const email = await staffAccount();
    const { secret } = await enableMfa(email);
    const used = code(secret);
    const first = await loginWithCode(email, used);
    expect(first.res.status).toBe(200);
    const replay = await loginWithCode(email, used);
    expect(replay.res.status).toBe(401);
    expect(replay.res.body.error.code).toBe('INVALID_MFA_CODE');
    // The challenge from the successful sign-in cannot open a second session.
    await request(http)
      .post('/api/v1/auth/login/mfa')
      .send({ challenge: first.challenge, code: code(secret, -1) })
      .expect(400);
    await request(http)
      .post('/api/v1/auth/login')
      .send({ email, password: 'not the password' })
      .expect(401);
  });

  it('accepts each recovery code once', async () => {
    const email = await staffAccount();
    const { recoveryCodes } = await enableMfa(email);
    const recovery = recoveryCodes[0]!;
    expect((await loginWithCode(email, ` ${recovery.toUpperCase()} `)).res.status).toBe(200);
    expect((await loginWithCode(email, recovery)).res.status).toBe(401);
  });

  it('locks the account after too many wrong codes, like wrong passwords', async () => {
    const email = await staffAccount();
    const { secret } = await enableMfa(email);
    const first = await request(http)
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    const valid = new Set([-1, 0, 1].map((n) => code(secret, n)));
    const wrong = ['123456', '234567', '345678', '456789'].filter((c) => !valid.has(c));
    for (const bad of wrong.slice(0, 3)) {
      await request(http)
        .post('/api/v1/auth/login/mfa')
        .send({ challenge: first.body.challenge, code: bad })
        .expect(401);
    }
    // Locked (LOGIN_MAX_FAILURES is 3 in tests): even the right code is refused now.
    await request(http)
      .post('/api/v1/auth/login/mfa')
      .send({ challenge: first.body.challenge, code: code(secret) })
      .expect(401);
    await request(http).post('/api/v1/auth/login').send({ email, password: PASSWORD }).expect(401);
  });

  it('turns off only with the password and a code', async () => {
    const email = await staffAccount();
    const { secret, recoveryCodes } = await enableMfa(email);
    const { access } = await loginWithCode(email, code(secret));
    const auth = { cookie: `cse_at=${access}` };
    await request(http)
      .post('/api/v1/auth/mfa/disable')
      .set(auth)
      .send({ password: PASSWORD, code: '12345' })
      .expect(400);
    await request(http)
      .post('/api/v1/auth/mfa/disable')
      .set(auth)
      .send({ password: 'not the password', code: recoveryCodes[0] })
      .expect(401);
    // The sign-in spent the newest TOTP step, so (as with a lost phone) a recovery code.
    await request(http)
      .post('/api/v1/auth/mfa/disable')
      .set(auth)
      .send({ password: PASSWORD, code: recoveryCodes[0] })
      .expect(204);
    await request(http).get('/api/v1/auth/me').set(auth).expect(401);
    const plain = await login(email);
    expect(plain.res.body.user.mfaEnabled).toBe(false);
  });
});

describe('infrastructure endpoints', () => {
  it('publishes the JWKS outside the API prefix, without private material', async () => {
    const res = await request(http).get('/.well-known/jwks.json').expect(200);
    expect(res.body.keys[0]).toMatchObject({
      kty: 'OKP',
      crv: 'Ed25519',
      alg: 'EdDSA',
    });
    // No key configured in tests: a generated key gets a unique id per start.
    expect(res.body.keys[0].kid).toMatch(/^test-key-dev-[0-9a-f]{8}$/);
    expect(res.body.keys[0]).not.toHaveProperty('d');
  });

  it('readiness checks the database', async () => {
    const res = await request(http).get('/health/ready').expect(200);
    expect(res.body.checks).toEqual({ database: 'up' });
  });

  it('documents its API', async () => {
    const res = await request(http).get('/openapi.json').expect(200);
    expect(Object.keys(res.body.paths)).toEqual(
      expect.arrayContaining(['/api/v1/auth/login', '/api/v1/users']),
    );
  });
});
