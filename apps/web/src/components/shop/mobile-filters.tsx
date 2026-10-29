'use client';

import { SlidersHorizontalIcon } from 'lucide-react';
import { useI18n } from '@/components/i18n/provider';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import type { CatalogQuery } from '@/lib/catalog/query';
import type { Facet } from '@/lib/catalog/schemas';
import { Filters } from './filters';

export function MobileFilters({
  query,
  facets,
  activeCount,
}: {
  query: CatalogQuery;
  facets: Facet[];
  activeCount: number;
}) {
  const { t } = useI18n();
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="lg:hidden">
          <SlidersHorizontalIcon /> {t.listing.filters}
          {activeCount > 0 && ` (${String(activeCount)})`}
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t.listing.filters}</SheetTitle>
          <SheetDescription>{t.listing.filtersHint}</SheetDescription>
        </SheetHeader>
        <div className="px-5 pb-8">
          <Filters query={query} facets={facets} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
