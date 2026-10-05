'use client';

import { Button } from '@/components/ui/button';

/** Never shows error details to shoppers; the digest lets support find the server log. */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="eyebrow">Error</p>
      <h1 className="text-3xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="max-w-md text-muted-foreground">
        Please try again. If it keeps happening, contact support.
      </p>
      {error.digest && (
        <p className="font-mono text-xs text-muted-foreground">Reference: {error.digest}</p>
      )}
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
