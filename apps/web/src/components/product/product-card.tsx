'use client';

import Link from '@/components/i18n/link';
import { useI18n } from '@/components/i18n/provider';
import type { ProductSummary } from '@/lib/catalog/schemas';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Price } from './price';
import { ProductMedia } from './product-media';
import { Rating } from './rating';

interface ProductCardProps {
  product: ProductSummary;
  priority?: boolean;
  className?: string;
}

export function ProductCard({ product, priority, className }: ProductCardProps) {
  const { t } = useI18n();
  const soldOut = product.availability === 'OUT_OF_STOCK';
  return (
    <article className={cn('group relative flex flex-col', className)}>
      <div className="relative aspect-square overflow-hidden rounded-2xl border border-border bg-stage transition-[border-color,box-shadow] duration-300 group-hover:border-foreground/20 group-hover:shadow-lg">
        <div className="absolute inset-0 flex items-center justify-center p-[8%] transition-transform duration-500 ease-out group-hover:scale-[1.04] motion-reduce:transform-none">
          <ProductMedia
            image={product.images[0]}
            preview={product.preview}
            alt={product.name}
            priority={priority}
            sizes="(min-width: 1024px) 32vw, (min-width: 640px) 48vw, 100vw"
            className="w-full"
          />
        </div>
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          {product.badges.map((badge) => (
            <Badge key={badge} variant={badge === 'SALE' ? 'brand' : 'outline'}>
              {t.product.badges[badge]}
            </Badge>
          ))}
          {soldOut && <Badge variant="outline">{t.product.soldOut}</Badge>}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 pt-4">
        <h3 className="text-lg leading-snug font-semibold tracking-tight">
          <Link
            href={`/product/${product.slug}`}
            className="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:ring-[3px] focus-visible:after:ring-ring/60"
          >
            {product.name}
          </Link>
        </h3>
        <p className="line-clamp-2 text-[0.9375rem] text-muted-foreground">{product.tagline}</p>
        <Rating value={product.rating.average} count={product.rating.count} />
        <Price
          price={product.price}
          compareAt={product.compareAtPrice}
          from
          className="mt-auto pt-1"
        />
      </div>
    </article>
  );
}

export function ProductGrid({
  products,
  className,
}: {
  products: ProductSummary[];
  className?: string;
}) {
  return (
    <div
      className={cn('grid grid-cols-1 gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3', className)}
    >
      {products.map((product, index) => (
        <ProductCard key={product.id} product={product} priority={index < 2} />
      ))}
    </div>
  );
}
