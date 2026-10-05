import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/seo/breadcrumbs';
import { ProductListing } from '@/components/shop/product-listing';
import { catalog, categoryTrail, parseCatalogQuery } from '@/lib/catalog';
import { listingMetadata } from '@/lib/seo/listing-metadata';
import { categoryCrumbs } from '@/lib/seo/structured-data';

export async function generateMetadata(props: PageProps<'/shop/[category]'>): Promise<Metadata> {
  const { category: slug } = await props.params;
  const category = await catalog.getCategory(slug);
  if (!category) return {};
  const query = parseCatalogQuery(await props.searchParams);
  return {
    title: category.name,
    description: category.description,
    openGraph: { title: category.name, description: category.description, url: `/shop/${slug}` },
    ...listingMetadata(`/shop/${slug}`, query),
  };
}

export default async function CategoryPage(props: PageProps<'/shop/[category]'>) {
  const { category: slug } = await props.params;
  const [category, categories] = await Promise.all([
    catalog.getCategory(slug),
    catalog.getCategories(),
  ]);
  if (!category) notFound();

  const query = parseCatalogQuery(await props.searchParams);
  const listing = await catalog.listProducts(query, slug);
  const children = categories.filter((c) => c.parentSlug === slug);
  const pathname = `/shop/${slug}`;

  return (
    <div className="container-page py-10">
      <Breadcrumbs crumbs={categoryCrumbs(categoryTrail(categories, slug))} />
      <header className="mt-6 mb-10 max-w-2xl">
        <h1 className="text-4xl font-semibold tracking-tight">{category.name}</h1>
        <p className="mt-3 text-muted-foreground">{category.description}</p>
        {children.length > 0 && (
          <ul className="mt-6 flex flex-wrap gap-2">
            {children.map((child) => (
              <li key={child.slug}>
                <Link
                  href={`/shop/${child.slug}`}
                  className="rounded-full border px-3.5 py-1.5 text-sm hover:bg-accent"
                >
                  {child.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </header>
      <ProductListing listing={listing} query={query} pathname={pathname} />
    </div>
  );
}
