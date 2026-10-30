import { connection } from 'next/server';
import { ComponentIndex } from '@/components/home/component-index';
import { GuideTeaser } from '@/components/home/guide-teaser';
import { HomeHero, type HeroBoard } from '@/components/home/home-hero';
import { NewsletterForm } from '@/components/home/newsletter-form';
import { PrototypeStory } from '@/components/home/prototype-story';
import { StackScene } from '@/components/home/stack-scene';
import Link from '@/components/i18n/link';
import { Diagram } from '@/components/knowledge/diagrams';
import { Button } from '@/components/ui/button';
import { JsonLd } from '@/components/seo/json-ld';
import { catalog, KEYBOARD_LAYOUTS, type ProductSummary } from '@/lib/catalog';
import { storeOpen } from '@/lib/env';
import { getI18n } from '@/lib/i18n/server';
import { organizationJsonLd, websiteJsonLd } from '@/lib/seo/structured-data';

/** One board per size, smallest first, as the hero's size picker offers them. */
function heroBoards(products: ProductSummary[]): HeroBoard[] {
  const boards: HeroBoard[] = [];
  for (const layout of KEYBOARD_LAYOUTS) {
    const product = products.find(
      (p) => p.categorySlug === 'keyboards' && p.attributes.layout?.includes(layout),
    );
    if (!product) continue;
    boards.push({
      slug: product.slug,
      name: product.name,
      tagline: product.tagline,
      layout,
      price: product.price,
      preview: product.preview,
    });
  }
  return boards;
}

/**
 * The home page, as an argument: what the shop is (and a size to try), what a keyboard is made
 * of, everything in the shop grouped the same way, the prototype the guide was written from,
 * the guide itself, and the way to hear when the shop opens.
 */
export default async function HomePage() {
  // Rendered per request from cached catalog data, so builds never need the API.
  await connection();
  const i18n = await getI18n();
  const { t, locale } = i18n;
  const copy = t.home;
  const [products, categories, configurator] = await Promise.all([
    catalog.getOverview(locale),
    catalog.getCategories(locale),
    catalog.getConfigurator(locale, 'cse-custom'),
  ]);

  return (
    <>
      <JsonLd data={[organizationJsonLd(locale), websiteJsonLd(locale)]} />
      <HomeHero boards={heroBoards(products)} />
      <StackScene
        diagram={
          <Diagram id="exploded-stack" locale={locale} title={copy.stack.art} className="w-full" />
        }
      />
      <ComponentIndex
        i18n={i18n}
        categories={categories}
        products={products}
        basePrice={configurator ? i18n.money(configurator.basePrice) : null}
      />
      <PrototypeStory i18n={i18n} />
      <GuideTeaser i18n={i18n} />

      <section
        id="newsletter"
        aria-labelledby="close-title"
        className="container-page scroll-mt-28 py-12"
      >
        <div className="glass grid gap-10 rounded-3xl p-8 sm:p-12 lg:grid-cols-12 lg:items-end lg:p-16">
          <h2
            id="close-title"
            className="display text-[clamp(2.5rem,5vw,4.5rem)] whitespace-pre-line lg:col-span-7"
          >
            {storeOpen ? copy.close.openTitle : copy.close.previewTitle}
          </h2>
          <div className="lg:col-span-5">
            <p className="max-w-md text-lg leading-relaxed text-muted-foreground">
              {storeOpen ? copy.close.openBody : copy.close.previewBody}
            </p>
            <div className="mt-6">
              {storeOpen ? (
                <Button size="lg" variant="brand" asChild>
                  <Link href="/shop/keyboards">{copy.close.openAction}</Link>
                </Button>
              ) : (
                <NewsletterForm />
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
