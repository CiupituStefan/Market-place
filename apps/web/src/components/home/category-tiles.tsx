import Link from 'next/link';
import { ProductArt } from '@/components/product/product-art';
import type { Category } from '@/lib/catalog/schemas';
import { cn } from '@/lib/utils';

export function CategoryTiles({ categories }: { categories: Category[] }) {
  return (
    <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {categories.map((category, index) => (
        <li key={category.slug} className={cn(index === 0 && 'col-span-2 row-span-2')}>
          <Link
            href={`/shop/${category.slug}`}
            className="group relative flex h-full min-h-44 flex-col justify-between overflow-hidden rounded-2xl bg-stage p-5 transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <div className="relative z-10">
              <h3
                className={cn(
                  'font-semibold tracking-tight',
                  index === 0 ? 'text-2xl' : 'text-base',
                )}
              >
                {category.name}
              </h3>
              {index === 0 && (
                <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                  {category.description}
                </p>
              )}
            </div>
            <ProductArt
              preview={category.preview}
              title=""
              className={cn(
                'mt-4 self-end transition-transform duration-500 group-hover:-translate-y-1 group-hover:scale-[1.03]',
                index === 0 ? 'w-full' : 'w-4/5',
              )}
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}
