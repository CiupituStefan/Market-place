import type { Metadata } from 'next';
import { SearchForm } from '@/components/layout/search-form';
import { ProductListing } from '@/components/shop/product-listing';
import { catalog, parseCatalogQuery } from '@/lib/catalog';
import { getI18n } from '@/lib/i18n/server';
import { localizedAlternates } from '@/lib/seo/alternates';

export async function generateMetadata(props: PageProps<'/search'>): Promise<Metadata> {
  const { q } = parseCatalogQuery(await props.searchParams);
  const { t, locale } = await getI18n();
  return {
    title: q ? t.search.metaTitle(q) : t.search.title,
    // Internal search results should never be indexed.
    robots: { index: false, follow: true },
    alternates: localizedAlternates('/search', locale),
  };
}

export default async function SearchPage(props: PageProps<'/search'>) {
  const query = parseCatalogQuery(await props.searchParams);
  const { t, locale } = await getI18n();
  const listing = query.q ? await catalog.listProducts(locale, query) : null;
  return (
    <div className="container-page py-10">
      <header className="mb-10 max-w-2xl">
        <h1 className="display text-[clamp(3rem,7vw,6.5rem)]">
          {query.q ? (
            <>
              {t.search.resultsFor} <span className="text-brand">“{query.q}”</span>
            </>
          ) : (
            t.search.title
          )}
        </h1>
        <SearchForm className="mt-6 max-w-md" defaultValue={query.q ?? ''} />
        <p className="mt-3 text-sm text-muted-foreground">{t.search.hint}</p>
      </header>
      {listing && <ProductListing listing={listing} query={query} pathname="/search" />}
    </div>
  );
}
