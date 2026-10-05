'use client';

import {
  CheckIcon,
  HeartIcon,
  MinusIcon,
  PlusIcon,
  ShieldCheckIcon,
  TruckIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { needsSignIn, useAddToCart, useAddToWishlist } from '@/lib/api/cart';
import { userMessage } from '@/lib/api/errors';
import type { Product } from '@/lib/catalog/schemas';
import {
  availabilityLabel,
  defaultSelection,
  findVariant,
  selectValue,
  type Selection,
} from '@/lib/catalog/variants';
import { cn } from '@/lib/utils';
import { Price } from './price';
import { ProductGallery } from './product-gallery';
import { Rating } from './rating';
import { VariantPicker } from './variant-picker';

const MAX_QUANTITY = 10;

interface ProductExperienceProps {
  product: Product;
  initialSelection: Selection;
}

export function ProductExperience({ product, initialSelection }: ProductExperienceProps) {
  const router = useRouter();
  const [selection, setSelection] = useState<Selection>(initialSelection);
  const [quantity, setQuantity] = useState(1);
  const variant = findVariant(product, selection);
  const purchasable = variant !== undefined && variant.availability !== 'OUT_OF_STOCK';

  const cart = useAddToCart();
  const wishlist = useAddToWishlist();

  function onSelect(optionKey: string, value: string) {
    const next = selectValue(product, selection, optionKey, value);
    setSelection(next);
    const nextVariant = findVariant(product, next);
    if (nextVariant) {
      // Shareable URL for the exact variant without a navigation round-trip.
      const url = new URL(window.location.href);
      url.searchParams.set('variant', nextVariant.sku);
      window.history.replaceState(null, '', url);
    }
    cart.reset();
  }

  function onAddToCart(buyNow: boolean) {
    if (!variant) return;
    cart.mutate(
      { variantId: variant.id, quantity },
      {
        onSuccess: () => {
          if (buyNow) router.push('/checkout');
        },
      },
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1.25fr_1fr] lg:gap-16">
      <div className="lg:sticky lg:top-28 lg:self-start">
        <ProductGallery
          name={product.name}
          images={variant?.images ?? product.images}
          preview={variant?.preview ?? product.preview}
        />
      </div>

      <div className="flex flex-col gap-8">
        <div>
          <p className="font-mono text-xs tracking-wider text-muted-foreground uppercase">
            {product.brand}
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-balance">
            {product.name}
          </h1>
          <p className="mt-2 text-muted-foreground">{product.tagline}</p>
          <a href="#reviews" className="mt-3 inline-block rounded-md">
            <Rating value={product.rating.average} count={product.rating.count} size="md" />
          </a>
        </div>

        <div>
          <Price
            price={variant?.price ?? product.price}
            compareAt={variant?.compareAtPrice ?? product.compareAtPrice}
            size="lg"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Incl. VAT. Shipping calculated at checkout.
          </p>
        </div>

        <VariantPicker product={product} selection={selection} onSelect={onSelect} />

        <div className="flex flex-col gap-4 border-t pt-6">
          <p
            className={cn(
              'flex items-center gap-2 text-sm',
              variant?.availability === 'OUT_OF_STOCK' || !variant
                ? 'text-destructive'
                : 'text-success',
            )}
            aria-live="polite"
          >
            <span className="size-2 rounded-full bg-current" aria-hidden="true" />
            {variant
              ? availabilityLabel(variant.availability)
              : 'This combination is not available'}
            {variant && (
              <span className="ml-auto font-mono text-xs text-muted-foreground">
                SKU {variant.sku}
              </span>
            )}
          </p>

          <div className="flex gap-3">
            <div
              className="flex h-12 items-center rounded-xl border"
              role="group"
              aria-label="Quantity"
            >
              <Button
                variant="ghost"
                size="icon"
                aria-label="Decrease quantity"
                disabled={quantity <= 1}
                onClick={() => {
                  setQuantity((q) => Math.max(1, q - 1));
                }}
              >
                <MinusIcon />
              </Button>
              <output className="w-8 text-center font-mono text-sm tabular-nums" aria-live="polite">
                {quantity}
              </output>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Increase quantity"
                disabled={quantity >= MAX_QUANTITY}
                onClick={() => {
                  setQuantity((q) => Math.min(MAX_QUANTITY, q + 1));
                }}
              >
                <PlusIcon />
              </Button>
            </div>
            <Button
              size="lg"
              className="flex-1"
              disabled={!purchasable || cart.isPending}
              onClick={() => {
                onAddToCart(false);
              }}
            >
              {cart.isSuccess ? (
                <>
                  <CheckIcon /> Added to cart
                </>
              ) : cart.isPending ? (
                'Adding…'
              ) : purchasable ? (
                'Add to cart'
              ) : (
                'Sold out'
              )}
            </Button>
            <Button
              size="lg"
              variant="outline"
              aria-label="Add to wishlist"
              aria-pressed={wishlist.isSuccess}
              disabled={!variant || wishlist.isPending}
              onClick={() => {
                if (variant) wishlist.mutate(variant.id);
              }}
            >
              <HeartIcon className={cn(wishlist.isSuccess && 'fill-brand text-brand')} />
            </Button>
          </div>
          <Button
            size="lg"
            variant="brand"
            disabled={!purchasable || cart.isPending}
            onClick={() => {
              onAddToCart(true);
            }}
          >
            Buy now
          </Button>
          {cart.isError && (
            <p role="alert" className="text-sm text-destructive">
              {userMessage(cart.error)}
            </p>
          )}
          {wishlist.isError && (
            <p role="alert" className="text-sm text-destructive">
              {needsSignIn(wishlist.error) ? (
                <>
                  <Link
                    href={`/login?next=${encodeURIComponent(`/product/${product.slug}`)}`}
                    prefetch={false}
                    className="underline"
                  >
                    Sign in
                  </Link>{' '}
                  to save products to your wishlist.
                </>
              ) : (
                userMessage(wishlist.error)
              )}
            </p>
          )}
        </div>

        <ul className="grid gap-3 rounded-2xl bg-secondary/60 p-5 text-sm">
          <li className="flex gap-3">
            <TruckIcon className="size-5 shrink-0 text-brand" aria-hidden="true" />
            <span>Free EU shipping over €99. Dispatched in 1–2 business days.</span>
          </li>
          <li className="flex gap-3">
            <ShieldCheckIcon className="size-5 shrink-0 text-brand" aria-hidden="true" />
            <span>2-year warranty and 30-day returns.</span>
          </li>
        </ul>

        {product.highlights.length > 0 && (
          <ul className="grid gap-2 text-sm">
            {product.highlights.map((highlight) => (
              <li key={highlight} className="flex gap-2">
                <CheckIcon className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
                {highlight}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * Reads `?variant=SKU` on the client so the product page itself can stay
 * statically generated; the server-rendered fallback shows the default variant.
 */
export function ProductExperienceFromUrl({ product }: { product: Product }) {
  const searchParams = useSearchParams();
  const sku = searchParams.get('variant');
  const requested = product.variants.find((v) => v.sku === sku);
  const initialSelection = requested ? { ...requested.options } : defaultSelection(product);
  return (
    <ProductExperience
      key={requested?.id ?? 'default'}
      product={product}
      initialSelection={initialSelection}
    />
  );
}
