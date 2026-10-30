import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/seo/breadcrumbs';
import { CategoryHeader } from '@/components/shop/category-header';
import { ProductListing } from '@/components/shop/product-listing';
import { catalog, categoryTrail, parseCatalogQuery } from '@/lib/catalog';
import { getI18n } from '@/lib/i18n/server';
import { localizePath } from '@/lib/i18n/config';
import { listingMetadata } from '@/lib/seo/listing-metadata';
import { categoryCrumbs } from '@/lib/seo/structured-data';

export async function generateMetadata(props: PageProps<'/shop/[category]'>): Promise<Metadata> {
  const { category: slug } = await props.params;
  const { locale } = await getI18n();
  const category = await catalog.getCategory(locale, slug);
  if (!category) return {};
  const query = parseCatalogQuery(await props.searchParams);
  return {
    title: category.name,
    description: category.description,
    openGraph: {
      title: category.name,
      description: category.description,
      url: localizePath(`/shop/${slug}`, locale),
    },
    ...listingMetadata(`/shop/${slug}`, query, locale),
  };
}

export default async function CategoryPage(props: PageProps<'/shop/[category]'>) {
  const { category: slug } = await props.params;
  const i18n = await getI18n();
  const { t, locale } = i18n;
  const [category, categories] = await Promise.all([
    catalog.getCategory(locale, slug),
    catalog.getCategories(locale),
  ]);
  if (!category) notFound();

  const query = parseCatalogQuery(await props.searchParams);
  const listing = await catalog.listProducts(locale, query, slug);
  const children = categories.filter((c) => c.parentSlug === slug);
  const pathname = `/shop/${slug}`;

  return (
    <div className="container-page py-10">
      <Breadcrumbs crumbs={categoryCrumbs(categoryTrail(categories, slug), t)} />
      <CategoryHeader i18n={i18n} category={category} subcategories={children} />
      <ProductListing listing={listing} query={query} pathname={pathname} />
    </div>
  );
}
