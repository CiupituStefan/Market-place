'use client';

import '@/lib/security/zod-jitless';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { useState, type ReactNode } from 'react';
import { LocaleProvider } from '@/components/i18n/provider';
import { ApiError } from '@/lib/api/errors';
import type { Locale } from '@/lib/i18n/config';

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Client errors (4xx) are final; only retry transient failures.
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status < 500) && failureCount < 2,
      },
      mutations: { retry: false },
    },
  });
}

/** `nonce`: the request's CSP nonce, for next-themes' inline (pre-hydration) script. */
export function Providers({
  children,
  nonce,
  locale,
}: {
  children: ReactNode;
  nonce?: string | undefined;
  locale: Locale;
}) {
  const [queryClient] = useState(makeQueryClient);
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
      nonce={nonce}
    >
      <LocaleProvider locale={locale}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </LocaleProvider>
    </ThemeProvider>
  );
}
