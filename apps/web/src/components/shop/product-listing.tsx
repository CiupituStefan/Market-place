import { SearchXIcon } from 'lucide-react';
import Link from 'next/link';
import { ProductGrid } from '@/components/product/product-card';
import { Button } from '@/components/ui/button';
import type { ProductListing as Listing } from '@/lib/catalog';
import { activeFilterCount, type CatalogQuery } from '@/lib/catalog/query';
import { pluralize } from '@/lib/format';
import { ActiveFilters } from './active-filters';
import { Filters } from './filters';
import { MobileFilters } from './mobile-filters';
import { Pagination } from './pagination';
import { SortSelect } from './sort-select';

interface ProductListingProps {
  listing: Listing;
  query: CatalogQuery;
  pathname: string;
}

export function ProductListing({ listing, query, pathname }: ProductListingProps) {
  const activeCount = activeFilterCount(query);
  return (
    <div className="grid gap-10 lg:grid-cols-[15rem_1fr]">
      <aside aria-label="Filters" className="hidden lg:block">
        <div className="sticky top-32">
          {/* Keyed by the query so local inputs (price) reset when the URL changes. */}
          <Filters key={JSON.stringify(query)} query={query} facets={listing.facets} />
        </div>
      </aside>
      <div>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <MobileFilters query={query} facets={listing.facets} activeCount={activeCount} />
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {pluralize(listing.total, 'product')}
            </p>
          </div>
          <SortSelect query={query} />
        </div>
        <div className="mb-8">
          <ActiveFilters query={query} pathname={pathname} />
        </div>
        {listing.items.length > 0 ? (
          <>
            <ProductGrid products={listing.items} className="xl:grid-cols-3" />
            <Pagination query={query} pathname={pathname} totalPages={listing.totalPages} />
          </>
        ) : (
          <div className="flex flex-col items-center rounded-3xl border border-dashed px-6 py-20 text-center">
            <SearchXIcon className="size-8 text-muted-foreground" aria-hidden="true" />
            <h2 className="mt-4 text-lg font-semibold">No products match</h2>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Try removing a filter or searching for something broader.
            </p>
            <Button variant="outline" className="mt-6" asChild>
              <Link href={pathname}>Reset filters</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
