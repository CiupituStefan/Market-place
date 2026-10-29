import { NextResponse, type NextRequest } from 'next/server';
import { publicEnv } from '@/lib/env';
import { LOCALE_COOKIE, LOCALE_HEADER, localizePath } from '@/lib/i18n/config';
import { decideLocale } from '@/lib/i18n/routing';
import { buildCsp, createNonce } from '@/lib/security/csp';

/** Same name as auth-service's access cookie (`ACCESS_TOKEN_COOKIE` in @market/types). */
const SESSION_COOKIE = 'cse_at';
const PRIVATE_AREAS = ['/admin', '/account'];

const isPrivate = (pathname: string) =>
  PRIVATE_AREAS.some((area) => pathname === area || pathname.startsWith(`${area}/`));

/**
 * Runs before every page:
 * - picks the language: `/ro/...` is Romanian (rewritten to the same page, with the language
 *   in a request header), unprefixed is English; visitors in Romania (or who chose Romanian)
 *   are sent to the Romanian URL. See lib/i18n/routing.ts;
 * - gives the response a fresh CSP nonce; Next.js reads it from the request's
 *   Content-Security-Policy header and puts it on its own scripts;
 * - sends visitors without a session straight to sign-in for private areas. That is a UX
 *   shortcut, not the security boundary: the API verifies tokens and roles on every call.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const decision = decideLocale({
    pathname,
    search,
    method: request.method,
    cookie: request.cookies.get(LOCALE_COOKIE)?.value,
    // Vercel's edge sets the visitor's country (and overwrites a client-sent value);
    // CloudFront's header is the equivalent behind AWS.
    country:
      request.headers.get('x-vercel-ip-country') ??
      request.headers.get('cloudfront-viewer-country'),
    userAgent: request.headers.get('user-agent'),
  });
  if (decision.action === 'redirect') {
    // Temporary: the right URL depends on who asks.
    return NextResponse.redirect(new URL(decision.to, request.url), 307);
  }
  const { locale, path } = decision;

  const nonce = createNonce();
  const csp = buildCsp({
    nonce,
    development: process.env.NODE_ENV === 'development',
    apiUrl: publicEnv.NEXT_PUBLIC_API_URL,
    assetUrl: process.env.NEXT_PUBLIC_ASSET_BASE_URL,
    https: publicEnv.NEXT_PUBLIC_SITE_URL.startsWith('https://'),
  });

  let response: NextResponse;
  if (isPrivate(path) && !request.cookies.has(SESSION_COOKIE)) {
    const login = new URL(localizePath('/login', locale), request.url);
    login.searchParams.set('next', `${pathname}${search}`);
    response = NextResponse.redirect(login);
  } else {
    const headers = new Headers(request.headers);
    headers.set('x-nonce', nonce);
    headers.set('content-security-policy', csp);
    headers.set(LOCALE_HEADER, locale);
    response =
      path === pathname
        ? NextResponse.next({ request: { headers } })
        : NextResponse.rewrite(new URL(`${path}${search}`, request.url), {
            request: { headers },
          });
  }
  response.headers.set('content-security-policy', csp);
  return response;
}

export const config = {
  matcher: [
    // Pages only (prefetches included, so /ro/... links prefetch the right page): not static
    // files, the image optimiser, metadata files or health checks.
    '/((?!_next/static|_next/image|api/health|favicon.ico|icon.svg|robots.txt|sitemap.xml|opengraph-image).*)',
  ],
};
