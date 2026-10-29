import { getI18n } from '@/lib/i18n/server';
import Link from '@/components/i18n/link';
import { Button } from '@/components/ui/button';

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <div className="container-page flex flex-col items-center py-28 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight">{t.pages.notFound.title}</h1>
      <p className="mt-4 max-w-md text-muted-foreground">{t.pages.notFound.body}</p>
      <div className="mt-8 flex gap-3">
        <Button asChild>
          <Link href="/shop">{t.pages.notFound.browse}</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">{t.pages.notFound.home}</Link>
        </Button>
      </div>
    </div>
  );
}
