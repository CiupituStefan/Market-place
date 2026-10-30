import type { Metadata } from 'next';
import Link from '@/components/i18n/link';
import { ProductArt } from '@/components/product/product-art';
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
  const [listing, categories] = await Promise.all([
    catalog.listProducts(locale, query),
    // The shelf links are a shortcut: if categories fail to load, the listing still shows.
    catalog.getCategories(locale).catch(() => []),
  ]);
  const shelves = categories.filter((category) => category.parentSlug === null);
  return (
    <div className="container-page py-10">
      <Breadcrumbs
        crumbs={[
          { name: t.shop.home, href: '/' },
          { name: t.shop.shop, href: '/shop' },
        ]}
      />
      <header className="mt-6 mb-10 max-w-2xl">
        <h1 className="display text-[clamp(2.75rem,6vw,5.5rem)]">{t.shop.allTitle}</h1>
        <p className="mt-4 text-lg text-muted-foreground">{t.shop.allIntro}</p>
      </header>
      <nav aria-label={t.shop.shop} className="mb-12">
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {shelves.map((shelf) => (
            <li key={shelf.slug}>
              <Link
                href={`/shop/${shelf.slug}`}
                className="group panel flex flex-col gap-3 rounded-2xl p-2.5 transition-[border-color,box-shadow] duration-300 hover:border-foreground/20 hover:shadow-lg"
              >
                <span className="flex aspect-[16/9] items-center justify-center rounded-xl bg-stage px-[14%]">
                  <ProductArt
                    preview={shelf.preview}
                    title=""
                    className="w-full transition-transform duration-500 group-hover:scale-[1.05] motion-reduce:transform-none"
                  />
                </span>
                <span className="px-2 pb-1.5 text-lg font-semibold tracking-tight">
                  {shelf.name}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <ProductListing listing={listing} query={query} pathname="/shop" />
    </div>
  );
}
