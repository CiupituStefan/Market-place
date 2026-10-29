'use client';

import { useI18n } from '@/components/i18n/provider';
import { Button } from '@/components/ui/button';

/** Never shows error details to shoppers; the digest lets support find the server log. */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();
  return (
    <main className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="eyebrow">{t.errorPage.eyebrow}</p>
      <h1 className="text-3xl font-semibold tracking-tight">{t.errorPage.title}</h1>
      <p className="max-w-md text-muted-foreground">{t.errorPage.body}</p>
      {error.digest && (
        <p className="font-mono text-xs text-muted-foreground">
          {t.errorPage.reference}: {error.digest}
        </p>
      )}
      <Button onClick={reset}>{t.common.tryAgain}</Button>
    </main>
  );
}
