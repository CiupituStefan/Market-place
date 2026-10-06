import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { config, proxy } from './proxy';

const nonceOf = (csp: string | null) => /'nonce-([^']+)'/.exec(csp ?? '')?.[1];

describe('proxy', () => {
  it('redirects visitors without a session to sign-in, preserving the destination', () => {
    const response = proxy(new NextRequest('http://localhost:3000/admin/orders?status=PAID'));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get('location')!);
    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('next')).toBe('/admin/orders?status=PAID');
  });

  it('lets requests with a session cookie through', () => {
    const request = new NextRequest('http://localhost:3000/account', {
      headers: { cookie: 'cse_at=token' },
    });
    expect(proxy(request).headers.get('x-middleware-next')).toBe('1');
  });

  it('does not guard public pages, nor paths that merely start like a private area', () => {
    for (const path of ['/', '/shop', '/product/cse-forge-75', '/accountability']) {
      expect(proxy(new NextRequest(`http://localhost:3000${path}`)).status).toBe(200);
    }
  });

  it('gives every response a strict CSP with a fresh nonce, also passed to rendering', () => {
    const first = proxy(new NextRequest('http://localhost:3000/'));
    const second = proxy(new NextRequest('http://localhost:3000/'));
    const csp = first.headers.get('content-security-policy');
    expect(csp).toContain("'strict-dynamic'");
    expect(nonceOf(csp)).toBeTruthy();
    expect(nonceOf(csp)).not.toBe(nonceOf(second.headers.get('content-security-policy')));
    // Forwarded to the page render through overridden request headers.
    expect(first.headers.get('x-middleware-request-x-nonce')).toBe(nonceOf(csp));
    // Redirects carry it too.
    expect(
      proxy(new NextRequest('http://localhost:3000/admin')).headers.get('content-security-policy'),
    ).toContain('nonce-');
  });

  it('runs on pages but not on static assets or health checks', () => {
    const source = new RegExp(`^${config.matcher[0]!.source}$`);
    expect(source.test('/product/cse-forge-75')).toBe(true);
    expect(source.test('/_next/static/chunks/main.js')).toBe(false);
    expect(source.test('/api/health')).toBe(false);
  });
});
