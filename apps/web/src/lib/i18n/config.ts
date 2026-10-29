/**
 * The storefront speaks English (default, unprefixed URLs) and Romanian (under /ro). Visitors
 * from Romania land on Romanian the first time; anyone can switch, and the choice is kept in a
 * cookie. Decision: docs/adr/ADR-026-storefront-languages.md.
 */
export const LOCALES = ['en', 'ro'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';
/** The visitor's explicit choice (language switcher). Wins over the country. */
export const LOCALE_COOKIE = 'cse_locale';
/** Set by the proxy on the request, read by Server Components. */
export const LOCALE_HEADER = 'x-locale';

export const LOCALE_INFO: Record<
  Locale,
  { label: string; htmlLang: string; intl: string; openGraph: string }
> = {
  en: { label: 'English', htmlLang: 'en', intl: 'en-IE', openGraph: 'en_GB' },
  ro: { label: 'Română', htmlLang: 'ro', intl: 'ro-RO', openGraph: 'ro_RO' },
};

/** Countries whose visitors get Romanian by default. */
export const ROMANIAN_COUNTRIES = new Set(['RO', 'MD']);

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** Paths that are never localised: the back office and API routes. */
export function isUnlocalized(path: string): boolean {
  return /^\/(admin|api)(\/|$)/.test(path);
}

/** `/shop` → `/ro/shop` for Romanian; English paths stay as they are. */
export function localizePath(path: string, locale: Locale): string {
  if (locale === DEFAULT_LOCALE || !path.startsWith('/') || isUnlocalized(path)) return path;
  return path === '/' ? '/ro' : `/ro${path}`;
}

/** `/ro/shop` → { locale: 'ro', path: '/shop' }; unprefixed paths are English. */
export function splitLocale(pathname: string): { locale: Locale; path: string } {
  if (pathname === '/ro' || pathname.startsWith('/ro/') || pathname.startsWith('/ro?')) {
    const rest = pathname.slice(3);
    return { locale: 'ro', path: rest === '' || rest.startsWith('?') ? `/${rest}` : rest };
  }
  return { locale: DEFAULT_LOCALE, path: pathname };
}
