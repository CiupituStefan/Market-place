'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { useI18n } from '@/components/i18n/provider';
import { toSearchParams, type CatalogQuery } from '@/lib/catalog/query';
import { splitLocale } from '@/lib/i18n/config';

/** Updates the catalog query in the URL (the URL is the single source of filter state). */
export function useCatalogNavigation(query: CatalogQuery) {
  const router = useRouter();
  const { path } = useI18n();
  // The page's own path in its language (the browser shows /ro/... on Romanian pages).
  const pathname = path(splitLocale(usePathname()).path);
  const [isPending, startTransition] = useTransition();

  function navigate(patch: Partial<CatalogQuery>) {
    // Any filter change resets pagination.
    const params = toSearchParams({ ...query, page: 1, ...patch });
    const search = params.toString();
    startTransition(() => {
      router.push(search ? `${pathname}?${search}` : pathname, { scroll: false });
    });
  }

  return { navigate, isPending };
}
