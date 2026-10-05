import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/seo/breadcrumbs';
import { ProductListing } from '@/components/shop/product-listing';
import { catalog, parseCatalogQuery } from '@/lib/catalog';
import { listingMetadata } from '@/lib/seo/listing-metadata';

export async function generateMetadata(props: PageProps<'/shop'>): Promise<Metadata> {
  const query = parseCatalogQuery(await props.searchParams);
  return {
    title: 'Shop all',
    description: 'Mechanical keyboards, switches, keycaps and accessories from CSE Keyboards.',
    ...listingMetadata('/shop', query),
  };
}

export default async function ShopPage(props: PageProps<'/shop'>) {
  const query = parseCatalogQuery(await props.searchParams);
  const listing = await catalog.listProducts(query);
  return (
    <div className="container-page py-10">
      <Breadcrumbs
        crumbs={[
          { name: 'Home', href: '/' },
          { name: 'Shop', href: '/shop' },
        ]}
      />
      <header className="mt-6 mb-10 max-w-2xl">
        <h1 className="text-4xl font-semibold tracking-tight">Shop all</h1>
        <p className="mt-3 text-muted-foreground">
          Keyboards, switches, keycaps and everything around them.
        </p>
      </header>
      <ProductListing listing={listing} query={query} pathname="/shop" />
    </div>
  );
}
