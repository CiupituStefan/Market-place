import { z } from 'zod';

/**
 * Languages the shop speaks to customers (ADR-026). English is the default and the fallback.
 * The storefront tells the API which one the shopper uses with `?locale=` on requests whose
 * response or resulting emails contain text.
 */
export const LOCALES = ['en', 'ro'] as const;
export const LocaleSchema = z.enum(LOCALES);
export type Locale = z.infer<typeof LocaleSchema>;

/** `?locale=`: anything missing or unknown is English rather than an error. */
export const LocaleParamSchema = LocaleSchema.default('en').catch('en');

/** Storefront path in a language: `/order/1` → `/ro/order/1` (English paths are unprefixed). */
export function localizedPath(path: string, locale: Locale): string {
  if (locale === 'en') return path;
  return path === '/' ? `/${locale}` : `/${locale}${path}`;
}
