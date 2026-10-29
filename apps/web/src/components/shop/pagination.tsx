import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import Link from '@/components/i18n/link';
import { toSearchParams, type CatalogQuery } from '@/lib/catalog/query';
import { getI18n } from '@/lib/i18n/server';
import { cn } from '@/lib/utils';

export async function Pagination({
  query,
  pathname,
  totalPages,
}: {
  query: CatalogQuery;
  pathname: string;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;
  const { t } = await getI18n();
  const href = (page: number) => {
    const search = toSearchParams({ ...query, page }).toString();
    return search ? `${pathname}?${search}` : pathname;
  };
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  const linkClass =
    'inline-flex size-10 items-center justify-center rounded-lg border text-sm hover:bg-accent';
  return (
    <nav aria-label={t.listing.pagination} className="mt-16 flex items-center justify-center gap-2">
      {query.page > 1 && (
        <Link
          href={href(query.page - 1)}
          className={linkClass}
          aria-label={t.listing.previousPage}
          rel="prev"
        >
          <ChevronLeftIcon className="size-4" />
        </Link>
      )}
      {pages.map((page) => (
        <Link
          key={page}
          href={href(page)}
          aria-current={page === query.page ? 'page' : undefined}
          className={cn(
            linkClass,
            page === query.page &&
              'border-primary bg-primary text-primary-foreground hover:bg-primary',
          )}
        >
          {page}
        </Link>
      ))}
      {query.page < totalPages && (
        <Link
          href={href(query.page + 1)}
          className={linkClass}
          aria-label={t.listing.nextPage}
          rel="next"
        >
          <ChevronRightIcon className="size-4" />
        </Link>
      )}
    </nav>
  );
}
