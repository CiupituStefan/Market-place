import { NextResponse, type NextRequest } from 'next/server';

/** Same name as auth-service's access cookie (`ACCESS_TOKEN_COOKIE` in @market/types). */
const SESSION_COOKIE = 'cse_at';

/**
 * Sends visitors without a session straight to sign-in for private areas, before
 * any page code runs. This is a UX shortcut, not the security boundary: the API
 * (gateway + services) verifies tokens and roles on every call.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  const login = new URL('/login', request.url);
  login.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ['/admin/:path*', '/account/:path*'],
};
