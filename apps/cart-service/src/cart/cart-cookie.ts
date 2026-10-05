import { CART_TOKEN_COOKIE } from '@market/types';
import type { CookieOptions, Request, Response } from 'express';
import { readCookie } from '@market/nest-common';
import type { AppConfig } from '../config.js';
import type { CartIdentity, CookieInstruction } from './cart.service.js';

function options(config: AppConfig): CookieOptions {
  return {
    httpOnly: true,
    secure: config.COOKIE_SECURE,
    // Lax: the cart must survive arriving from an external link; mutations are
    // still CSRF-checked by the gateway (Origin/Referer).
    sameSite: 'lax',
    path: '/',
    ...(config.COOKIE_DOMAIN ? { domain: config.COOKIE_DOMAIN } : {}),
  };
}

const TOKEN_FORMAT = /^[A-Za-z0-9_-]{43}$/;

/** The visitor token from the cookie, ignoring anything that is not one of ours. */
export function guestToken(req: Request): string | null {
  const value = readCookie(req.headers.cookie, CART_TOKEN_COOKIE);
  return value && TOKEN_FORMAT.test(value) ? value : null;
}

export function identityOf(req: Request, userId: string | undefined): CartIdentity {
  return { userId: userId ?? null, guestToken: guestToken(req) };
}

export function applyCookie(
  res: Response,
  instruction: CookieInstruction,
  config: AppConfig,
): void {
  if (instruction.setGuestToken) {
    res.cookie(CART_TOKEN_COOKIE, instruction.setGuestToken, {
      ...options(config),
      maxAge: config.GUEST_CART_TTL_DAYS * 24 * 60 * 60 * 1000,
    });
  } else if (instruction.clearGuestToken) {
    res.clearCookie(CART_TOKEN_COOKIE, options(config));
  }
}
