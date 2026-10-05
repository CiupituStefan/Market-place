import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import Link from 'next/link';
import { toSearchParams, type CatalogQuery } from '@/lib/catalog/query';
import { cn } from '@/lib/utils';

export function Pagination({
  query,
  pathname,
  totalPages,
}: {
  query: CatalogQuery;
  pathname: string;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;
  const href = (page: number) => {
    const search = toSearchParams({ ...query, page }).toString();
    return search ? `${pathname}?${search}` : pathname;
  };
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  const linkClass =
    'inline-flex size-10 items-center justify-center rounded-lg border text-sm hover:bg-accent';
  return (
    <nav aria-label="Pagination" className="mt-16 flex items-center justify-center gap-2">
      {query.page > 1 && (
        <Link
          href={href(query.page - 1)}
          className={linkClass}
          aria-label="Previous page"
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
        <Link href={href(query.page + 1)} className={linkClass} aria-label="Next page" rel="next">
          <ChevronRightIcon className="size-4" />
        </Link>
      )}
    </nav>
  );
}
