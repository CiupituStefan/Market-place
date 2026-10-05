import Link from 'next/link';

/** Fallback for URLs outside every route group (no store chrome available here). */
export default function GlobalNotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="eyebrow">404</p>
      <h1 className="text-3xl font-semibold tracking-tight">Page not found</h1>
      <Link href="/" className="underline underline-offset-4">
        Back to CSE Keyboards
      </Link>
    </main>
  );
}
