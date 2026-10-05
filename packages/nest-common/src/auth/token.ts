import { ACCESS_TOKEN_COOKIE } from '@market/types';
import type { IncomingHttpHeaders } from 'node:http';

/** Reads one cookie from a Cookie header without pulling in a parser dependency. */
export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) {
      const value = part.slice(index + 1).trim();
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }
  }
  return undefined;
}

/**
 * Access token from `Authorization: Bearer` (non-browser clients) or the session
 * cookie (browser). The header wins when both are present.
 */
export function extractAccessToken(headers: IncomingHttpHeaders): string | undefined {
  const authorization = headers.authorization;
  if (authorization?.startsWith('Bearer ')) return authorization.slice(7).trim() || undefined;
  return readCookie(headers.cookie, ACCESS_TOKEN_COOKIE);
}
