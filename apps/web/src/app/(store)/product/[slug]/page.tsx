import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ProductGrid } from '@/components/product/product-card';
import { ProductDetails } from '@/components/product/product-details';
import {
  ProductExperience,
  ProductExperienceFromUrl,
} from '@/components/product/product-experience';
import { ReviewsSection } from '@/components/reviews/reviews-section';
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
import { localizePath } from '@/lib/i18n/config';
import { getI18n } from '@/lib/i18n/server';
import { localizedAlternates } from '@/lib/seo/alternates';
import { categoryCrumbs, productJsonLd } from '@/lib/seo/structured-data';

/**
 * Rendered per request: cached HTML would carry one visitor's CSP nonce to everyone
 * (src/proxy.ts). The catalog data itself stays cached (60 s, tag "catalog"), so a render
 * costs no API round trip most of the time, and builds do not depend on the catalog API.
 */
export const dynamic = 'force-dynamic';

export async function generateMetadata(props: PageProps<'/product/[slug]'>): Promise<Metadata> {
  const { slug } = await props.params;
  const { locale } = await getI18n();
  const product = await catalog.getProduct(locale, slug);
  if (!product) return {};
  const description = `${product.tagline}. ${product.description[0] ?? ''}`.slice(0, 160);
  return {
    title: product.name,
    description,
    // Variant query strings (?variant=SKU) all canonicalise to the product URL.
    alternates: localizedAlternates(`/product/${product.slug}`, locale),
    openGraph: {
      title: product.name,
      description,
      url: localizePath(`/product/${product.slug}`, locale),
      ...(product.images[0]
        ? { images: [{ url: product.images[0].url, alt: product.images[0].alt }] }
        : {}),
    },
  };
}

export default async function ProductPage(props: PageProps<'/product/[slug]'>) {
  const { slug } = await props.params;
  const { t, locale } = await getI18n();
  const product = await catalog.getProduct(locale, slug);
  if (!product) notFound();

  const [categories, related] = await Promise.all([
    catalog.getCategories(locale),
    catalog.getRelated(locale, product),
  ]);
  const crumbs = [
    ...categoryCrumbs(categoryTrail(categories, product.categorySlug), t),
    { name: product.name, href: `/product/${product.slug}` },
  ];

  return (
    <div className="container-page py-8">
      <JsonLd data={productJsonLd(product, locale)} />
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

      <section aria-label={t.product.tabs.label} className="mt-24">
        <ProductDetails product={product} />
      </section>

      <section id="reviews" aria-labelledby="reviews-title" className="mt-24 scroll-mt-28">
        <div className="mb-8">
          <h2 id="reviews-title" className="display text-[clamp(2.5rem,5vw,4.5rem)]">
            {t.product.reviewsHeading}
          </h2>
        </div>
        <ReviewsSection productId={product.id} />
      </section>

      {product.faq.length > 0 && (
        <section aria-labelledby="faq-title" className="mt-24 grid gap-8 md:grid-cols-[1fr_2fr]">
          <div>
            <h2 id="faq-title" className="display text-[clamp(2.5rem,5vw,4.5rem)]">
              {t.product.faqHeading}
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
        <h2 id="related-title" className="display mb-10 text-[clamp(2.5rem,5vw,4.5rem)]">
          {t.product.related}
        </h2>
        <ProductGrid products={related} />
      </section>
    </div>
  );
}
