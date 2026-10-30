import Image from 'next/image';
import Link from '@/components/i18n/link';
import type { Category, ProductSummary } from '@/lib/catalog';
import { WORLD_IMAGES } from '@/lib/image-credits';
import type { I18n } from '@/lib/i18n/core';

interface Row {
  category: Category;
  count: number;
  from: ProductSummary['price'] | null;
}

/** Shelves in shop order: the three top-level ones, then what sits under accessories. */
function rows(categories: Category[], products: ProductSummary[]): Row[] {
  const shelves = [
    ...categories.filter((c) => c.parentSlug === null && c.slug !== 'accessories'),
    ...categories.filter((c) => c.parentSlug === 'accessories'),
  ];
  return shelves
    .map((category) => {
      const items = products.filter((p) => p.categorySlug === category.slug);
      const cheapest = items.reduce<ProductSummary | null>(
        (low, p) => (low === null || p.price.amount < low.price.amount ? p : low),
        null,
      );
      return { category, count: items.length, from: cheapest?.price ?? null };
    })
    .filter((row) => row.count > 0);
}

/**
 * The whole shop as one table, the way a type specimen lists its sizes: each shelf set large,
 * with how many things are on it and what the cheapest costs, beside the keyboard of a
 * typesetting machine.
 */
export function CatalogueTable({
  i18n,
  categories,
  products,
}: {
  i18n: I18n;
  categories: Category[];
  products: ProductSummary[];
}) {
  const copy = i18n.t.home.catalogue;
  const picture = WORLD_IMAGES.linotype;

  return (
    <section aria-labelledby="catalogue-title" className="container-page py-24 lg:py-32">
      <div className="grid gap-12 lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-7">
          <h2
            id="catalogue-title"
            className="display text-[clamp(3rem,7vw,7rem)] whitespace-pre-line"
          >
            {copy.title}
          </h2>
          <table className="mt-12 w-full border-collapse text-left">
            <caption className="sr-only">{copy.label}</caption>
            <tbody>
              {rows(categories, products).map(({ category, count, from }) => (
                <tr key={category.slug} data-reveal className="group border-t-2 border-foreground">
                  <th scope="row" className="py-4 pr-4 align-baseline font-normal">
                    <Link
                      href={`/shop/${category.slug}`}
                      className="text-[clamp(1.5rem,3.2vw,2.75rem)] leading-tight font-semibold tracking-tight group-hover:text-brand"
                    >
                      {category.name}
                    </Link>
                  </th>
                  <td className="hidden py-4 pr-4 align-baseline text-base whitespace-nowrap text-muted-foreground tabular-nums sm:table-cell">
                    {copy.count(count)}
                  </td>
                  <td className="py-4 text-right align-baseline text-lg font-semibold whitespace-nowrap tabular-nums">
                    {from && copy.from(i18n.money(from))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <figure data-reveal className="lg:col-span-5 lg:pt-4">
          <Image
            src={picture.src}
            width={picture.width}
            height={picture.height}
            alt={copy.picture}
            sizes="(min-width: 1024px) 40vw, 100vw"
            className="h-auto w-full"
          />
          <figcaption className="mt-3 text-sm text-muted-foreground">
            {copy.picture}. {picture.creator}, {picture.licence}.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
