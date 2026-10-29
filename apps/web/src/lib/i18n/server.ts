import 'server-only';
import { headers } from 'next/headers';
import { DEFAULT_LOCALE, isLocale, LOCALE_HEADER, type Locale } from './config';
import { i18nFor, type I18n } from './core';

/** The page's language, as decided by the proxy (from the URL). */
export async function getLocale(): Promise<Locale> {
  const value = (await headers()).get(LOCALE_HEADER);
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** Dictionary and formatters for Server Components and metadata. */
export async function getI18n(): Promise<I18n> {
  return i18nFor(await getLocale());
}
