import {
  isLocale,
  isUnlocalized,
  localizePath,
  ROMANIAN_COUNTRIES,
  splitLocale,
  type Locale,
} from './config';

/** Search engines and link previews must see the URL they asked for, never a geo redirect. */
const BOT =
  /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|preview|lighthouse|headless/i;

export type LocaleDecision =
  { action: 'redirect'; to: string } | { action: 'render'; locale: Locale; path: string };

/**
 * Which language a page request gets, from what the proxy knows. Pure, so it is unit-tested.
 * - `/ro/...` is always Romanian and `/...` (unprefixed) is English when that is what was
 *   asked for: a URL means the same thing for everyone, which search engines and shared links
 *   rely on.
 * - On an unprefixed page, a visitor who chose Romanian (cookie), or who has not chosen and is
 *   in Romania, is redirected to the Romanian URL.
 */
export function decideLocale(request: {
  pathname: string;
  search: string;
  method: string;
  cookie: string | undefined;
  country: string | null;
  userAgent: string | null;
}): LocaleDecision {
  const { locale, path } = splitLocale(request.pathname);
  if (locale === 'ro') {
    // The back office is English only: /ro/admin is just /admin.
    if (isUnlocalized(path)) return { action: 'redirect', to: `${path}${request.search}` };
    return { action: 'render', locale, path };
  }
  if (request.method !== 'GET' || isUnlocalized(path) || BOT.test(request.userAgent ?? '')) {
    return { action: 'render', locale: 'en', path };
  }
  const chosen = isLocale(request.cookie) ? request.cookie : null;
  const wantsRomanian =
    chosen === 'ro' ||
    (chosen === null && ROMANIAN_COUNTRIES.has((request.country ?? '').toUpperCase()));
  if (wantsRomanian)
    return { action: 'redirect', to: `${localizePath(path, 'ro')}${request.search}` };
  return { action: 'render', locale: 'en', path };
}
