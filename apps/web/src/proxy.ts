import { NextResponse, type NextRequest } from 'next/server';
import { publicEnv } from '@/lib/env';
import { buildCsp, createNonce } from '@/lib/security/csp';

/** Same name as auth-service's access cookie (`ACCESS_TOKEN_COOKIE` in @market/types). */
const SESSION_COOKIE = 'cse_at';
const PRIVATE_AREAS = ['/admin', '/account'];

const isPrivate = (pathname: string) =>
  PRIVATE_AREAS.some((area) => pathname === area || pathname.startsWith(`${area}/`));

/**
 * Runs before every page:
 * - gives the response a fresh CSP nonce; Next.js reads it from the request's
 *   Content-Security-Policy header and puts it on its own scripts;
 * - sends visitors without a session straight to sign-in for private areas. That is a UX
 *   shortcut, not the security boundary: the API verifies tokens and roles on every call.
 */
export function proxy(request: NextRequest) {
  const nonce = createNonce();
  const csp = buildCsp({
    nonce,
    development: process.env.NODE_ENV === 'development',
    apiUrl: publicEnv.NEXT_PUBLIC_API_URL,
    assetUrl: process.env.NEXT_PUBLIC_ASSET_BASE_URL,
    https: publicEnv.NEXT_PUBLIC_SITE_URL.startsWith('https://'),
  });

  let response: NextResponse;
  if (isPrivate(request.nextUrl.pathname) && !request.cookies.has(SESSION_COOKIE)) {
    const login = new URL('/login', request.url);
    login.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`);
    response = NextResponse.redirect(login);
  } else {
    const headers = new Headers(request.headers);
    headers.set('x-nonce', nonce);
    headers.set('content-security-policy', csp);
    response = NextResponse.next({ request: { headers } });
  }
  response.headers.set('content-security-policy', csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: not static files, the image optimiser, metadata files or health checks.
      source:
        '/((?!_next/static|_next/image|api/health|favicon.ico|icon.svg|robots.txt|sitemap.xml|opengraph-image).*)',
      // Prefetches carry no HTML of their own.
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
