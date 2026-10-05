import type { Metadata } from 'next';
import { SearchForm } from '@/components/layout/search-form';
import { ProductListing } from '@/components/shop/product-listing';
import { catalog, parseCatalogQuery } from '@/lib/catalog';

export async function generateMetadata(props: PageProps<'/search'>): Promise<Metadata> {
  const { q } = parseCatalogQuery(await props.searchParams);
  return {
    title: q ? `Search: ${q}` : 'Search',
    // Internal search results should never be indexed.
    robots: { index: false, follow: true },
    alternates: { canonical: '/search' },
  };
}

export default async function SearchPage(props: PageProps<'/search'>) {
  const query = parseCatalogQuery(await props.searchParams);
  const listing = query.q ? await catalog.listProducts(query) : null;
  return (
    <div className="container-page py-10">
      <header className="mb-10 max-w-2xl">
        <h1 className="text-4xl font-semibold tracking-tight">
          {query.q ? (
            <>
              Results for <span className="text-brand">“{query.q}”</span>
            </>
          ) : (
            'Search'
          )}
        </h1>
        <SearchForm className="mt-6 max-w-md" defaultValue={query.q ?? ''} />
        <p className="mt-3 text-sm text-muted-foreground">
          Search by product name, brand, SKU, category or spec.
        </p>
      </header>
      {listing && <ProductListing listing={listing} query={query} pathname="/search" />}
    </div>
  );
}
