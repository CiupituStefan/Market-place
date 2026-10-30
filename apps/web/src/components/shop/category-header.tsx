import { ArrowUpRightIcon } from 'lucide-react';
import Link from '@/components/i18n/link';
import { ProductArt } from '@/components/product/product-art';
import type { Category } from '@/lib/catalog';
import type { I18n } from '@/lib/i18n/core';
import { CATEGORY_GUIDES } from '@/lib/knowledge/category-guides';

/**
 * The top of a shelf: its name and description from the catalogue, its sub-shelves, the guide
 * topics that help choose from it, and its drawing on a glass stage.
 */
export function CategoryHeader({
  i18n,
  category,
  subcategories,
}: {
  i18n: I18n;
  category: Category;
  subcategories: Category[];
}) {
  const { t } = i18n;
  const guides = CATEGORY_GUIDES[category.slug] ?? CATEGORY_GUIDES[category.parentSlug ?? ''] ?? [];

  return (
    <header className="mt-6 mb-12 grid gap-8 lg:grid-cols-12 lg:items-center">
      <div className="lg:col-span-6">
        <h1 className="display text-[clamp(2.75rem,6vw,5.5rem)]">{category.name}</h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
          {category.description}
        </p>
        {subcategories.length > 0 && (
          <ul className="mt-6 flex flex-wrap gap-2">
            {subcategories.map((child) => (
              <li key={child.slug}>
                <Link
                  href={`/shop/${child.slug}`}
                  className="inline-flex rounded-full border border-border px-3.5 py-2 text-sm font-medium transition-colors hover:border-foreground/30 hover:bg-foreground/[0.05]"
                >
                  {child.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
        {guides.length > 0 && (
          <p className="mt-6 flex flex-wrap items-center gap-2 text-[0.9375rem]">
            <span className="text-muted-foreground">{t.home.components.choose}:</span>
            {guides.map((slug) => (
              <Link
                key={slug}
                href={`/learn/${slug}`}
                className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-3 py-2 text-sm font-medium transition-colors hover:bg-brand/20"
              >
                {t.learn.topicNames[slug]}{' '}
                <ArrowUpRightIcon className="size-3.5" aria-hidden="true" />
              </Link>
            ))}
          </p>
        )}
      </div>
      <div className="lg:col-span-6">
        <div className="glass rounded-3xl p-3">
          <div className="flex aspect-[16/8] items-center justify-center rounded-2xl bg-stage/70 px-[12%]">
            <ProductArt
              preview={category.preview}
              quality="full"
              title={t.home.components.art(category.name)}
              className="w-full max-w-lg"
            />
          </div>
        </div>
      </div>
    </header>
  );
}
