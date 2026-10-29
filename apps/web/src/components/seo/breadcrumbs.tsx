import { ChevronRightIcon } from 'lucide-react';
import Link from '@/components/i18n/link';
import { getI18n } from '@/lib/i18n/server';
import { breadcrumbJsonLd, type Crumb } from '@/lib/seo/structured-data';
import { JsonLd } from './json-ld';

export async function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  const { t, locale } = await getI18n();
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs, locale)} />
      <nav aria-label={t.shop.breadcrumb} className="text-xs text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1">
          {crumbs.map((crumb, index) => {
            const last = index === crumbs.length - 1;
            return (
              <li key={crumb.href} className="flex items-center gap-1">
                {last ? (
                  <span aria-current="page" className="text-foreground">
                    {crumb.name}
                  </span>
                ) : (
                  <>
                    <Link href={crumb.href} className="hover:text-foreground">
                      {crumb.name}
                    </Link>
                    <ChevronRightIcon className="size-3" aria-hidden="true" />
                  </>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
