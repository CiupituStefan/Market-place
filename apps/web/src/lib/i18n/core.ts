import type { Money } from '@market/types';
import { formatMoney } from '@/lib/format';
import { LOCALE_INFO, localizePath, type Locale } from './config';
import { MESSAGES, type Messages } from './messages';

export interface I18n {
  locale: Locale;
  /** The dictionary for this locale: `t.cart.title`, `t.cart.items(3)`. */
  t: Messages;
  /** A storefront path in this locale: `path('/shop')` → `/ro/shop` in Romanian. */
  path: (path: string) => string;
  money: (money: Money) => string;
  date: (iso: string) => string;
  dateTime: (iso: string) => string;
  number: (value: number) => string;
}

const cache = new Map<Locale, I18n>();

/** Everything locale-dependent, for one locale. Same object on the server and in the browser. */
export function i18nFor(locale: Locale): I18n {
  let i18n = cache.get(locale);
  if (!i18n) {
    const intl = LOCALE_INFO[locale].intl;
    const date = new Intl.DateTimeFormat(intl, { dateStyle: 'medium' });
    const dateTime = new Intl.DateTimeFormat(intl, { dateStyle: 'medium', timeStyle: 'short' });
    const number = new Intl.NumberFormat(intl);
    i18n = {
      locale,
      t: MESSAGES[locale],
      path: (path) => localizePath(path, locale),
      money: (money) => formatMoney(money, intl),
      date: (iso) => date.format(new Date(iso)),
      dateTime: (iso) => dateTime.format(new Date(iso)),
      number: (value) => number.format(value),
    };
    cache.set(locale, i18n);
  }
  return i18n;
}
