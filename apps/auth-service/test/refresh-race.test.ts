import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cookiesFrom, createHarness, type Harness } from './harness.js';

describe('refresh token grace window', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await createHarness({ REFRESH_REUSE_GRACE_SECONDS: '30' });
  });

  afterAll(async () => {
    await h.close();
  });

  it('treats an immediate second use (two tabs) as a benign race, not theft', async () => {
    const http = h.app.getHttpServer();
    const email = 'tabs@example.com';
    await request(http)
      .post('/api/v1/auth/register')
      .send({ email, password: 'correct horse battery staple', firstName: 'A', lastName: 'B' })
      .expect(201);
    const loginRes = await request(http)
      .post('/api/v1/auth/login')
      .send({ email, password: 'correct horse battery staple' });
    const refresh = cookiesFrom(loginRes.headers['set-cookie']).cse_rt!.value;

    const first = await request(http)
      .post('/api/v1/auth/refresh')
      .set('cookie', `cse_rt=${refresh}`)
      .expect(200);
    const second = await request(http)
      .post('/api/v1/auth/refresh')
      .set('cookie', `cse_rt=${refresh}`)
      .expect(401);
    expect(second.body.error.code).toBe('TOKEN_EXPIRED');
    // The session survives: the newer token still works and no cookies were cleared.
    expect(second.headers['set-cookie']).toBeUndefined();
    const newest = cookiesFrom(first.headers['set-cookie']).cse_rt!.value;
    await request(http).post('/api/v1/auth/refresh').set('cookie', `cse_rt=${newest}`).expect(200);
  });
});
