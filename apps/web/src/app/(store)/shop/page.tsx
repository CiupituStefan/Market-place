import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/seo/breadcrumbs';
import { ProductListing } from '@/components/shop/product-listing';
import { catalog, parseCatalogQuery } from '@/lib/catalog';
import { getI18n } from '@/lib/i18n/server';
import { listingMetadata } from '@/lib/seo/listing-metadata';

export async function generateMetadata(props: PageProps<'/shop'>): Promise<Metadata> {
  const query = parseCatalogQuery(await props.searchParams);
  const { t, locale } = await getI18n();
  return {
    title: t.shop.allTitle,
    description: t.shop.allDescription,
    ...listingMetadata('/shop', query, locale),
  };
}

export default async function ShopPage(props: PageProps<'/shop'>) {
  const query = parseCatalogQuery(await props.searchParams);
  const { t, locale } = await getI18n();
  const listing = await catalog.listProducts(locale, query);
  return (
    <div className="container-page py-10">
      <Breadcrumbs
        crumbs={[
          { name: t.shop.home, href: '/' },
          { name: t.shop.shop, href: '/shop' },
        ]}
      />
      <header className="mt-6 mb-10 max-w-2xl">
        <h1 className="text-4xl font-semibold tracking-tight">{t.shop.allTitle}</h1>
        <p className="mt-3 text-muted-foreground">{t.shop.allIntro}</p>
      </header>
      <ProductListing listing={listing} query={query} pathname="/shop" />
    </div>
  );
}
