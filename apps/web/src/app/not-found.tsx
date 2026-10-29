import Link from '@/components/i18n/link';
import { getI18n } from '@/lib/i18n/server';

/** Fallback for URLs outside every route group (no store chrome available here). */
export default async function GlobalNotFound() {
  const { t } = await getI18n();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="eyebrow">404</p>
      <h1 className="text-3xl font-semibold tracking-tight">{t.errorPage.notFound}</h1>
      <Link href="/" className="underline underline-offset-4">
        {t.errorPage.back}
      </Link>
    </main>
  );
}
