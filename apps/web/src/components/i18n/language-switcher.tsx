'use client';

import { usePathname } from 'next/navigation';
import { LOCALE_COOKIE, localizePath, splitLocale, type Locale } from '@/lib/i18n/config';
import { cn } from '@/lib/utils';
import { useI18n } from './provider';

const YEAR = 60 * 60 * 24 * 365;

/** The explicit choice wins over the country from now on (see lib/i18n/routing.ts). */
function rememberLocale(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; Max-Age=${String(YEAR)}; Path=/; SameSite=Lax`;
}

/**
 * RO / EN switch: plain links to the same page in the other language (a full page load, so
 * every Server Component renders in it), remembering the choice in a cookie on the way.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, t } = useI18n();
  const { path } = splitLocale(usePathname());
  return (
    <div
      role="group"
      aria-label={t.common.language}
      className={cn('flex items-center rounded-full border p-0.5 text-xs font-medium', className)}
    >
      {(['ro', 'en'] as const).map((value) =>
        value === locale ? (
          <span
            key={value}
            lang={value}
            aria-current="true"
            className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-full bg-primary px-2 py-1 text-primary-foreground uppercase"
          >
            {value}
          </span>
        ) : (
          // A plain link: a full load renders every Server Component in the new language.
          <a
            key={value}
            href={localizePath(path, value)}
            hrefLang={value}
            lang={value}
            onClick={(event) => {
              rememberLocale(value);
              // Keep the query (search terms, filters) in the other language too.
              event.currentTarget.search = window.location.search;
            }}
            className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-full px-2 py-1 text-muted-foreground uppercase transition-colors hover:text-foreground"
          >
            {value}
          </a>
        ),
      )}
    </div>
  );
}
