import { CategoryTiles } from '@/components/home/category-tiles';
import { ConfiguratorTeaser } from '@/components/home/configurator-teaser';
import { Hero } from '@/components/home/hero';
import { NewsletterForm } from '@/components/home/newsletter-form';
import { ReviewWall } from '@/components/home/review-wall';
import { SectionHeading } from '@/components/home/section-heading';
import { WhyUs } from '@/components/home/why-us';
import { ProductGrid } from '@/components/product/product-card';
import { JsonLd } from '@/components/seo/json-ld';
import { catalog } from '@/lib/catalog';
import { organizationJsonLd, websiteJsonLd } from '@/lib/seo/structured-data';

export default async function HomePage() {
  const [featured, bestSellers, newArrivals, categories, reviews, ratingStats] = await Promise.all([
    catalog.getFeatured(),
    catalog.getBestSellers(4),
    catalog.getNewArrivals(4),
    catalog.getCategories(),
    catalog.getReviews(),
    catalog.getRatingStats(),
  ]);
  const tiles = [
    ...categories.filter((c) => c.slug !== 'accessories' && c.parentSlug === null),
    ...categories.filter((c) => c.parentSlug === 'accessories'),
  ];

  return (
    <>
      <JsonLd data={[organizationJsonLd(), websiteJsonLd()]} />
      <Hero />

      <section
        aria-labelledby="featured-title"
        className="container-page py-16 [contain-intrinsic-size:auto_900px] [content-visibility:auto]"
      >
        <SectionHeading
          id="featured-title"
          eyebrow="Featured"
          title="Keyboards worth sitting down for"
          description="Our flagship boards, from compact 65% to full-size."
          href="/shop/keyboards"
          linkLabel="All keyboards"
        />
        <ProductGrid products={featured} />
      </section>

      <section
        aria-labelledby="categories-title"
        className="container-page py-16 [contain-intrinsic-size:auto_900px] [content-visibility:auto]"
      >
        <SectionHeading
          id="categories-title"
          eyebrow="Shop by category"
          title="Everything for your setup"
        />
        <CategoryTiles categories={tiles} />
      </section>

      <section
        aria-labelledby="bestsellers-title"
        className="container-page py-16 [contain-intrinsic-size:auto_900px] [content-visibility:auto]"
      >
        <SectionHeading
          id="bestsellers-title"
          eyebrow="Best sellers"
          title="Most loved by our customers"
          href="/shop?sort=rating"
        />
        <ProductGrid products={bestSellers} />
      </section>

      <section
        aria-labelledby="new-title"
        className="container-page py-16 [contain-intrinsic-size:auto_900px] [content-visibility:auto]"
      >
        <SectionHeading
          id="new-title"
          eyebrow="New arrivals"
          title="Fresh off the bench"
          href="/shop?sort=newest"
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
        <SectionHeading id="why-title" eyebrow="Why CSE" title="Obsessive about the details" />
        <WhyUs />
      </section>

      <section
        aria-labelledby="reviews-title"
        className="container-page py-16 [contain-intrinsic-size:auto_900px] [content-visibility:auto]"
      >
        <SectionHeading
          id="reviews-title"
          eyebrow="Reviews"
          title="Typists agree"
          description={`${ratingStats.average.toFixed(1)} average across ${ratingStats.count.toLocaleString('en')} reviews.`}
        />
        <ReviewWall reviews={reviews} />
      </section>

      <section
        aria-labelledby="newsletter-title"
        className="container-page py-16 [contain-intrinsic-size:auto_900px] [content-visibility:auto]"
      >
        <div className="flex flex-col items-start gap-8 rounded-3xl bg-primary p-8 text-primary-foreground md:flex-row md:items-center md:justify-between md:p-14">
          <div className="max-w-lg">
            <p className="eyebrow">Newsletter</p>
            <h2 id="newsletter-title" className="mt-3 text-3xl font-semibold tracking-tight">
              First to know about drops.
            </h2>
            <p className="mt-3 opacity-75">
              Limited runs, restocks and build guides — before they hit the site.
            </p>
          </div>
          <div className="w-full max-w-md text-foreground [&_p:not([role=alert])]:text-primary-foreground/70">
            <NewsletterForm />
          </div>
        </div>
      </section>
    </>
  );
}
