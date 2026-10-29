'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { i18nFor, type I18n } from '@/lib/i18n/core';
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/config';

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

/** The page's language for Client Components (set once, in the root layout). */
export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

/** Dictionary and formatters for Client Components. */
export function useI18n(): I18n {
  return i18nFor(useContext(LocaleContext));
}
