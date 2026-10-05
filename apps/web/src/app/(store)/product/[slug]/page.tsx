import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ProductGrid } from '@/components/product/product-card';
import { ProductDetails } from '@/components/product/product-details';
import {
  ProductExperience,
  ProductExperienceFromUrl,
} from '@/components/product/product-experience';
import { Rating } from '@/components/product/rating';
import { Breadcrumbs } from '@/components/seo/breadcrumbs';
import { JsonLd } from '@/components/seo/json-ld';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { catalog, categoryTrail } from '@/lib/catalog';
import { defaultSelection } from '@/lib/catalog/variants';
import { categoryCrumbs, productJsonLd } from '@/lib/seo/structured-data';

/**
 * Incremental static regeneration: product pages are rendered on first request,
 * cached, and refreshed in the background every five minutes. Nothing is
 * prerendered at build time, so builds do not depend on the catalog API.
 */
export const revalidate = 300;

export function generateStaticParams(): { slug: string }[] {
  return [];
}

export async function generateMetadata(props: PageProps<'/product/[slug]'>): Promise<Metadata> {
  const { slug } = await props.params;
  const product = await catalog.getProduct(slug);
  if (!product) return {};
  const description = `${product.tagline}. ${product.description[0] ?? ''}`.slice(0, 160);
  return {
    title: product.name,
    description,
    // Variant query strings (?variant=SKU) all canonicalise to the product URL.
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: {
      title: product.name,
      description,
      url: `/product/${product.slug}`,
      ...(product.images[0]
        ? { images: [{ url: product.images[0].url, alt: product.images[0].alt }] }
        : {}),
    },
  };
}

export default async function ProductPage(props: PageProps<'/product/[slug]'>) {
  const { slug } = await props.params;
  const product = await catalog.getProduct(slug);
  if (!product) notFound();

  const [categories, related] = await Promise.all([
    catalog.getCategories(),
    catalog.getRelated(product),
  ]);
  const crumbs = [
    ...categoryCrumbs(categoryTrail(categories, product.categorySlug)),
    { name: product.name, href: `/product/${product.slug}` },
  ];

  return (
    <div className="container-page py-8">
      <JsonLd data={productJsonLd(product)} />
      <Breadcrumbs crumbs={crumbs} />

      <div className="mt-6">
        <Suspense
          fallback={
            <ProductExperience product={product} initialSelection={defaultSelection(product)} />
          }
        >
          <ProductExperienceFromUrl product={product} />
        </Suspense>
      </div>

      <section aria-label="Product information" className="mt-24">
        <ProductDetails product={product} />
      </section>

      <section id="reviews" aria-labelledby="reviews-title" className="mt-24 scroll-mt-28">
        <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow">Reviews</p>
            <h2 id="reviews-title" className="mt-3 text-3xl font-semibold tracking-tight">
              What owners say
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-4xl font-semibold tabular-nums">
              {product.rating.average.toFixed(1)}
            </span>
            <Rating value={product.rating.average} count={product.rating.count} size="md" />
          </div>
        </div>
        <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          No written reviews yet. Owners can review after their order is delivered.
        </p>
      </section>

      {product.faq.length > 0 && (
        <section aria-labelledby="faq-title" className="mt-24 grid gap-8 md:grid-cols-[1fr_2fr]">
          <div>
            <p className="eyebrow">FAQ</p>
            <h2 id="faq-title" className="mt-3 text-3xl font-semibold tracking-tight">
              Good questions
            </h2>
          </div>
          <Accordion type="single" collapsible>
            {product.faq.map((item) => (
              <AccordionItem key={item.question} value={item.question}>
                <AccordionTrigger>{item.question}</AccordionTrigger>
                <AccordionContent>{item.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      )}

      <section aria-labelledby="related-title" className="mt-24">
        <h2 id="related-title" className="mb-10 text-3xl font-semibold tracking-tight">
          You might also like
        </h2>
        <ProductGrid products={related} />
      </section>
    </div>
  );
}
