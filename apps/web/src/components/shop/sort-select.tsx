'use client';

import { useId } from 'react';
import type { CatalogQuery } from '@/lib/catalog/query';
import { SORT_OPTIONS, type SortOption } from '@/lib/catalog/schemas';
import { useCatalogNavigation } from './use-catalog-navigation';

export function SortSelect({ query }: { query: CatalogQuery }) {
  const id = useId();
  const { navigate } = useCatalogNavigation(query);
  return (
    <div className="flex items-center gap-2 text-sm">
      <label htmlFor={id} className="text-muted-foreground">
        Sort by
      </label>
      <select
        id={id}
        value={query.sort}
        onChange={(e) => {
          navigate({ sort: e.target.value as SortOption });
        }}
        className="h-9 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
