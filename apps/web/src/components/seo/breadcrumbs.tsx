import { ChevronRightIcon } from 'lucide-react';
import Link from 'next/link';
import { breadcrumbJsonLd, type Crumb } from '@/lib/seo/structured-data';
import { JsonLd } from './json-ld';

export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
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
