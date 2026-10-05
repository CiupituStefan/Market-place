import Link from 'next/link';
import type { Badge as BadgeType, ProductSummary } from '@/lib/catalog/schemas';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Price } from './price';
import { ProductMedia } from './product-media';
import { Rating } from './rating';

const BADGE_LABEL: Record<BadgeType, string> = {
  NEW: 'New',
  BESTSELLER: 'Bestseller',
  LIMITED: 'Limited',
  SALE: 'Sale',
};

interface ProductCardProps {
  product: ProductSummary;
  priority?: boolean;
  className?: string;
}

export function ProductCard({ product, priority, className }: ProductCardProps) {
  const soldOut = product.availability === 'OUT_OF_STOCK';
  return (
    <article className={cn('group relative flex flex-col', className)}>
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-stage">
        <div className="absolute inset-0 flex items-center justify-center p-6 transition-transform duration-500 ease-out group-hover:scale-[1.04] motion-reduce:transform-none">
          <ProductMedia
            image={product.images[0]}
            preview={product.preview}
            alt={product.name}
            priority={priority}
            sizes="(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 90vw"
            className="w-full"
          />
        </div>
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          {product.badges.map((badge) => (
            <Badge key={badge} variant={badge === 'SALE' ? 'brand' : 'outline'}>
              {BADGE_LABEL[badge]}
            </Badge>
          ))}
          {soldOut && <Badge variant="outline">Sold out</Badge>}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 pt-4">
        <p className="font-mono text-[0.7rem] tracking-wider text-muted-foreground uppercase">
          {product.brand}
        </p>
        <h3 className="leading-snug font-medium">
          <Link
            href={`/product/${product.slug}`}
            className="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:ring-[3px] focus-visible:after:ring-ring/60"
          >
            {product.name}
          </Link>
        </h3>
        <p className="line-clamp-1 text-sm text-muted-foreground">{product.tagline}</p>
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
      className={cn('grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 xl:grid-cols-4', className)}
    >
      {products.map((product, index) => (
        <ProductCard key={product.id} product={product} priority={index < 2} />
      ))}
    </div>
  );
}
