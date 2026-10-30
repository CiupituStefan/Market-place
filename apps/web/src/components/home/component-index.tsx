import { ArrowRightIcon } from 'lucide-react';
import Link from '@/components/i18n/link';
import { Reveal } from '@/components/motion/reveal';
import { ProductArt } from '@/components/product/product-art';
import { Button } from '@/components/ui/button';
import type { Category, ProductSummary } from '@/lib/catalog';
import type { I18n } from '@/lib/i18n/core';
import { CATEGORY_GUIDES } from '@/lib/knowledge/category-guides';
import { cn } from '@/lib/utils';

/** Card sizes on the 12-column grid: the keyboards lead, the rest follow in build order. */
const SPAN: Record<string, string> = {
  keyboards: 'lg:col-span-7',
  switches: 'lg:col-span-5',
  keycaps: 'lg:col-span-5',
  accessories: 'lg:col-span-7',
};

interface Shelf {
  category: Category;
  products: ProductSummary[];
  children: Category[];
}

function shelves(categories: Category[], products: ProductSummary[]): Shelf[] {
  return categories
    .filter((category) => category.parentSlug === null)
    .map((category) => {
      const children = categories.filter((child) => child.parentSlug === category.slug);
      const slugs = new Set([category.slug, ...children.map((child) => child.slug)]);
      return {
        category,
        children,
        products: products.filter((product) => slugs.has(product.categorySlug)),
      };
    })
    .filter((shelf) => shelf.products.length > 0);
}

/**
 * The whole shop, grouped the way a keyboard is built: one card per shelf with its drawing,
 * its own description, how many products it holds and where its prices start, and the guide
 * topic that helps choose. Then the configurator, for building one from parts.
 */
export function ComponentIndex({
  i18n,
  categories,
  products,
  basePrice,
}: {
  i18n: I18n;
  categories: Category[];
  products: ProductSummary[];
  basePrice: string | null;
}) {
  const copy = i18n.t.home.components;
  const learn = i18n.t.learn.topicNames;

  return (
    <section aria-labelledby="components-title" className="container-page py-24">
      <div className="max-w-2xl">
        <h2 id="components-title" className="display text-[clamp(2.25rem,4.4vw,4rem)]">
          {copy.title}
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">{copy.intro}</p>
      </div>

      <Reveal className="mt-12 grid gap-4 lg:grid-cols-12">
        {shelves(categories, products).map(({ category, children, products: items }) => {
          const cheapest = items.reduce((low, p) => (p.price.amount < low.price.amount ? p : low));
          const guides = CATEGORY_GUIDES[category.slug] ?? [];
          return (
            <article
              key={category.slug}
              data-animate
              className={cn(
                'group panel relative flex flex-col overflow-hidden p-3 transition-[border-color,box-shadow] duration-300 hover:border-foreground/20 hover:shadow-lg',
                SPAN[category.slug] ?? 'lg:col-span-6',
              )}
            >
              <div className="relative flex aspect-[16/9] items-center justify-center overflow-hidden rounded-2xl bg-stage px-[12%]">
                <ProductArt
                  preview={category.preview}
                  quality="full"
                  title={copy.art(category.name)}
                  className="w-full max-w-md transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-[1.04] motion-reduce:transform-none"
                />
              </div>
              <div className="flex flex-1 flex-col p-4 sm:p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h3 className="text-2xl font-semibold tracking-tight">
                    <Link
                      href={`/shop/${category.slug}`}
                      className="after:absolute after:inset-0 after:rounded-[inherit] focus-visible:outline-none focus-visible:after:ring-[3px] focus-visible:after:ring-ring/60"
                    >
                      {category.name}
                    </Link>
                  </h3>
                  <p className="text-[0.9375rem] text-muted-foreground tabular-nums">
                    {copy.count(items.length)} ·{' '}
                    <span className="font-semibold text-foreground">
                      {copy.from(i18n.money(cheapest.price))}
                    </span>
                  </p>
                </div>
                <p className="mt-3 max-w-xl text-[0.9375rem] leading-relaxed text-muted-foreground">
                  {category.description}
                </p>
                {(children.length > 0 || guides.length > 0) && (
                  <div className="relative z-10 mt-auto flex flex-wrap gap-2 pt-5">
                    {children.map((child) => (
                      <Link
                        key={child.slug}
                        href={`/shop/${child.slug}`}
                        className="rounded-full border border-border px-3 py-2 text-sm font-medium transition-colors hover:border-foreground/30 hover:bg-foreground/[0.05]"
                      >
                        {child.name}
                      </Link>
                    ))}
                    {guides.map((slug) => (
                      <Link
                        key={slug}
                        href={`/learn/${slug}`}
                        className="rounded-full bg-brand-soft px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-brand/20"
                      >
                        {copy.choose}: {learn[slug]}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </article>
          );
        })}

        {basePrice && (
          <article
            data-animate
            className="glass relative flex flex-col gap-6 overflow-hidden rounded-3xl p-6 sm:p-8 lg:col-span-12 lg:flex-row lg:items-center lg:justify-between"
          >
            <div className="max-w-2xl">
              <h3 className="text-2xl font-semibold tracking-tight">{copy.build.title}</h3>
              <p className="mt-2 text-lg text-muted-foreground">{copy.build.body(basePrice)}</p>
            </div>
            <Button size="lg" asChild className="shrink-0 self-start lg:self-auto">
              <Link href="/configurator">
                {copy.build.action} <ArrowRightIcon aria-hidden="true" />
              </Link>
            </Button>
          </article>
        )}
      </Reveal>
    </section>
  );
}
