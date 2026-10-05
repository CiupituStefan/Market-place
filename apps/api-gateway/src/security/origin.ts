const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export interface OriginCheckInput {
  method: string;
  origin: string | undefined;
  referer: string | undefined;
  hasCookies: boolean;
}

/**
 * CSRF defence for cookie-authenticated APIs (OWASP "verify origin with standard
 * headers"), layered on top of SameSite=Lax session cookies:
 *
 * - safe methods never change state, so they pass;
 * - otherwise the Origin (or, failing that, the Referer) must be an allowed origin;
 * - a request with neither header is only accepted if it carries no cookies —
 *   it cannot be riding a victim's session (e.g. server-to-server or CLI calls).
 */
export function isOriginAllowed(
  input: OriginCheckInput,
  allowedOrigins: ReadonlySet<string>,
): boolean {
  if (SAFE_METHODS.has(input.method.toUpperCase())) return true;
  if (input.origin && input.origin !== 'null') return allowedOrigins.has(input.origin);
  if (input.referer) {
    try {
      return allowedOrigins.has(new URL(input.referer).origin);
    } catch {
      return false;
    }
  }
  return !input.hasCookies;
}
