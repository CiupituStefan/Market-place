import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE_PATH,
} from '@market/types';
import type { CookieOptions, Response } from 'express';
import type { AppConfig } from '../config.js';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
  sessionExpiresAt: Date;
}

function base(config: AppConfig): CookieOptions {
  return {
    httpOnly: true,
    secure: config.COOKIE_SECURE,
    ...(config.COOKIE_DOMAIN ? { domain: config.COOKIE_DOMAIN } : {}),
  };
}

/**
 * Access cookie: SameSite=Lax so top-level navigations keep the session. It lives
 * as long as the session even though the JWT inside expires after minutes: an
 * expired token yields TOKEN_EXPIRED, which tells the client to refresh, and the
 * web proxy can see that a session exists.
 * Refresh cookie: SameSite=Strict and scoped to /api/v1/auth, so it is sent only
 * to the endpoints that rotate or revoke it.
 */
export function setSessionCookies(res: Response, tokens: IssuedTokens, config: AppConfig): void {
  res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...base(config),
    sameSite: 'lax',
    path: '/',
    expires: tokens.sessionExpiresAt,
  });
  res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...base(config),
    sameSite: 'strict',
    path: REFRESH_TOKEN_COOKIE_PATH,
    expires: tokens.sessionExpiresAt,
  });
}

export function clearSessionCookies(res: Response, config: AppConfig): void {
  res.clearCookie(ACCESS_TOKEN_COOKIE, { ...base(config), sameSite: 'lax', path: '/' });
  res.clearCookie(REFRESH_TOKEN_COOKIE, {
    ...base(config),
    sameSite: 'strict',
    path: REFRESH_TOKEN_COOKIE_PATH,
  });
}
