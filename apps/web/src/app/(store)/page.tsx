import { CategoryTiles } from '@/components/home/category-tiles';
import { ConfiguratorTeaser } from '@/components/home/configurator-teaser';
import { Hero } from '@/components/home/hero';
import { NewsletterForm } from '@/components/home/newsletter-form';
import { SectionHeading } from '@/components/home/section-heading';
import { WhyUs } from '@/components/home/why-us';
import { ProductGrid } from '@/components/product/product-card';
import { JsonLd } from '@/components/seo/json-ld';
import { connection } from 'next/server';
import { catalog } from '@/lib/catalog';
import { getI18n } from '@/lib/i18n/server';
import { organizationJsonLd, websiteJsonLd } from '@/lib/seo/structured-data';

export default async function HomePage() {
  // Rendered per request from cached catalog data, so builds never need the API.
  await connection();
  const { t, locale } = await getI18n();
  const copy = t.home;
  const [featured, bestSellers, newArrivals, categories] = await Promise.all([
    catalog.getFeatured(locale),
    catalog.getBestSellers(locale, 4),
    catalog.getNewArrivals(locale, 4),
    catalog.getCategories(locale),
  ]);
  const tiles = [
    ...categories.filter((c) => c.slug !== 'accessories' && c.parentSlug === null),
    ...categories.filter((c) => c.parentSlug === 'accessories'),
  ];

  return (
    <>
      <JsonLd data={[organizationJsonLd(locale), websiteJsonLd(locale)]} />
      <Hero />

      <section
        aria-labelledby="featured-title"
        className="container-page py-16 [contain-intrinsic-size:auto_900px] [content-visibility:auto]"
      >
        <SectionHeading
          id="featured-title"
          eyebrow={copy.featured.eyebrow}
          title={copy.featured.title}
          description={copy.featured.description}
          href="/shop/keyboards"
          linkLabel={copy.featured.link}
        />
        <ProductGrid products={featured} />
      </section>

      <section
        aria-labelledby="categories-title"
        className="container-page py-16 [contain-intrinsic-size:auto_900px] [content-visibility:auto]"
      >
        <SectionHeading
          id="categories-title"
          eyebrow={copy.categories.eyebrow}
          title={copy.categories.title}
        />
        <CategoryTiles categories={tiles} />
      </section>

      <section
        aria-labelledby="bestsellers-title"
        className="container-page py-16 [contain-intrinsic-size:auto_900px] [content-visibility:auto]"
      >
        <SectionHeading
          id="bestsellers-title"
          eyebrow={copy.bestSellers.eyebrow}
          title={copy.bestSellers.title}
          href="/shop?sort=rating"
          linkLabel={t.common.viewAll}
        />
        <ProductGrid products={bestSellers} />
      </section>

      <section
        aria-labelledby="new-title"
        className="container-page py-16 [contain-intrinsic-size:auto_900px] [content-visibility:auto]"
      >
        <SectionHeading
          id="new-title"
          eyebrow={copy.newArrivals.eyebrow}
          title={copy.newArrivals.title}
          href="/shop?sort=newest"
          linkLabel={t.common.viewAll}
        />
        <ProductGrid products={newArrivals} />
      </section>

      <section
        id="configurator"
        aria-labelledby="configurator-title"
        className="container-page scroll-mt-28 py-16 [contain-intrinsic-size:auto_900px] [content-visibility:auto]"
      >
        <ConfiguratorTeaser />
      </section>

      <section
        aria-labelledby="why-title"
        className="container-page py-16 [contain-intrinsic-size:auto_900px] [content-visibility:auto]"
      >
        <SectionHeading id="why-title" eyebrow={copy.why.eyebrow} title={copy.why.title} />
        <WhyUs />
      </section>

      {/* Reviews section returns in the review-service phase, fed by real verified reviews. */}

      <section
        aria-labelledby="newsletter-title"
        className="container-page py-16 [contain-intrinsic-size:auto_900px] [content-visibility:auto]"
      >
        <div className="flex flex-col items-start gap-8 rounded-3xl bg-primary p-8 text-primary-foreground md:flex-row md:items-center md:justify-between md:p-14">
          <div className="max-w-lg">
            <p className="eyebrow">{copy.newsletter.eyebrow}</p>
            <h2 id="newsletter-title" className="mt-3 text-3xl font-semibold tracking-tight">
              {copy.newsletter.title}
            </h2>
            <p className="mt-3 opacity-75">{copy.newsletter.body}</p>
          </div>
          <div className="w-full max-w-md text-foreground [&_p:not([role=alert])]:text-primary-foreground/70">
            <NewsletterForm />
          </div>
        </div>
      </section>
    </>
  );
}
