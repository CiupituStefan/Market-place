import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { config, proxy } from './proxy';

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

  it('only guards private areas', () => {
    expect(config.matcher).toEqual(['/admin/:path*', '/account/:path*']);
  });
});
