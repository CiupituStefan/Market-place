import { connection } from 'next/server';
import { CatalogueTable } from '@/components/home/catalogue-table';
import { CloserLook } from '@/components/home/closer-look';
import { HomeHero, type HeroBoard } from '@/components/home/home-hero';
import { Materials } from '@/components/home/materials';
import { NewsletterForm } from '@/components/home/newsletter-form';
import { Reveal } from '@/components/home/reveal';
import Link from '@/components/i18n/link';
import { JsonLd } from '@/components/seo/json-ld';
import { catalog, KEYBOARD_LAYOUTS, type ProductSummary } from '@/lib/catalog';
import { storeOpen } from '@/lib/env';
import { getI18n } from '@/lib/i18n/server';
import { organizationJsonLd, websiteJsonLd } from '@/lib/seo/structured-data';

const CLOSER_LOOK = 'cse-forge-75';

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

export default async function HomePage() {
  // Rendered per request from cached catalog data, so builds never need the API.
  await connection();
  const i18n = await getI18n();
  const { t, locale } = i18n;
  const copy = t.home;
  const [products, categories, closer, configurator] = await Promise.all([
    catalog.getOverview(locale),
    catalog.getCategories(locale),
    catalog.getProduct(locale, CLOSER_LOOK),
    catalog.getConfigurator(locale, 'cse-custom'),
  ]);
  const keyboards = products.filter((p) => p.categorySlug === 'keyboards');
  const aluminium = keyboards
    .filter((p) => p.attributes.material?.includes('Aluminium'))
    .map((p) => p.name);
  const switchPreview = products.find((p) => p.kind === 'switch')?.preview ?? null;

  return (
    <>
      <JsonLd data={[organizationJsonLd(locale), websiteJsonLd(locale)]} />
      <Reveal />
      <HomeHero boards={heroBoards(products)} />

      {closer && closer.highlights.length > 0 && (
        <CloserLook slug={closer.slug} preview={closer.preview} highlights={closer.highlights} />
      )}

      <CatalogueTable i18n={i18n} categories={categories} products={products} />

      <Materials
        i18n={i18n}
        aluminium={aluminium}
        switchPreview={switchPreview}
        buildPreview={closer?.preview ?? keyboards[0]?.preview ?? null}
        basePrice={configurator ? i18n.money(configurator.basePrice) : null}
      />

      <section
        id="newsletter"
        aria-labelledby="close-title"
        className="scroll-mt-28 bg-brand text-brand-foreground"
      >
        <div className="container-page grid gap-10 py-24 lg:grid-cols-12 lg:items-end lg:gap-8 lg:py-32">
          <h2
            id="close-title"
            data-reveal
            className="display text-[clamp(3.25rem,8vw,8rem)] whitespace-pre-line lg:col-span-7"
          >
            {storeOpen ? copy.close.openTitle : copy.close.previewTitle}
          </h2>
          <div data-reveal className="lg:col-span-5">
            <p className="max-w-md text-xl leading-snug">
              {storeOpen ? copy.close.openBody : copy.close.previewBody}
            </p>
            <div className="mt-8">
              {storeOpen ? (
                <Link
                  href="/shop/keyboards"
                  className="inline-flex h-13 items-center bg-brand-foreground px-7 text-base font-semibold text-brand"
                >
                  {copy.close.openAction}
                </Link>
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
