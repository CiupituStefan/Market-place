import { XIcon } from 'lucide-react';
import Link from 'next/link';
import { FILTER_KEYS, toSearchParams, type CatalogQuery } from '@/lib/catalog/query';

/** Removable filter chips rendered as plain links (work without JavaScript). */
export function ActiveFilters({ query, pathname }: { query: CatalogQuery; pathname: string }) {
  const href = (patch: Partial<CatalogQuery>) => {
    const search = toSearchParams({ ...query, page: 1, ...patch }).toString();
    return search ? `${pathname}?${search}` : pathname;
  };

  const chips: { label: string; href: string }[] = [];
  for (const { key } of FILTER_KEYS) {
    for (const value of query[key]) {
      chips.push({ label: value, href: href({ [key]: query[key].filter((v) => v !== value) }) });
    }
  }
  if (query.inStock) chips.push({ label: 'In stock', href: href({ inStock: false }) });
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    chips.push({
      label: `€${query.minPrice ?? 0} – ${query.maxPrice !== undefined ? `€${query.maxPrice}` : 'any'}`,
      href: href({ minPrice: undefined, maxPrice: undefined }),
    });
  }
  if (chips.length === 0) return null;

  const clearAll = toSearchParams({ q: query.q, sort: query.sort }).toString();
  return (
    <ul className="flex flex-wrap items-center gap-2" aria-label="Active filters">
      {chips.map((chip) => (
        <li key={chip.href}>
          <Link
            href={chip.href}
            scroll={false}
            className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs hover:bg-accent"
          >
            {chip.label}
            <XIcon className="size-3" aria-hidden="true" />
            <span className="sr-only">Remove filter</span>
          </Link>
        </li>
      ))}
      <li>
        <Link
          href={clearAll ? `${pathname}?${clearAll}` : pathname}
          scroll={false}
          className="text-xs underline"
        >
          Clear all
        </Link>
      </li>
    </ul>
  );
}
