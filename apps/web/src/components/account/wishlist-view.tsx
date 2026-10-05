'use client';

import type { WishlistItem } from '@market/types';
import { CloudOffIcon, HeartIcon, ShoppingBagIcon, TrashIcon } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/empty-state';
import { Price } from '@/components/product/price';
import { ProductArt } from '@/components/product/product-art';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAddToCart, useRemoveFromWishlist, useWishlist } from '@/lib/api/cart';
import { userMessage } from '@/lib/api/errors';
import { RequireSession } from './require-session';

export function WishlistView() {
  return <RequireSession>{() => <WishlistItems />}</RequireSession>;
}

function WishlistItems() {
  const wishlist = useWishlist();

  if (wishlist.isPending) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    );
  }
  if (wishlist.isError) {
    return (
      <EmptyState
        icon={CloudOffIcon}
        title="We couldn’t load your wishlist"
        description={userMessage(wishlist.error)}
        action={
          <Button variant="outline" onClick={() => void wishlist.refetch()}>
            Try again
          </Button>
        }
      />
    );
  }
  if (wishlist.data.length === 0) {
    return (
      <EmptyState
        icon={HeartIcon}
        title="Your wishlist is empty"
        description="Tap the heart on any product to save it here."
        action={
          <Button asChild>
            <Link href="/shop">Browse products</Link>
          </Button>
        }
      />
    );
  }
  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {wishlist.data.map((item) => (
        <WishlistCard key={item.variantId} item={item} />
      ))}
    </ul>
  );
}

function WishlistCard({ item }: { item: WishlistItem }) {
  const addToCart = useAddToCart();
  const remove = useRemoveFromWishlist();
  return (
    <li className="flex flex-col rounded-3xl border p-4">
      <Link
        href={`/product/${item.productSlug}`}
        className="flex aspect-[4/3] items-center justify-center rounded-2xl bg-stage p-6"
      >
        <ProductArt preview={item.preview} title={item.name} className="w-full" />
      </Link>
      <div className="mt-4 flex flex-1 flex-col gap-1">
        <Link href={`/product/${item.productSlug}`} className="font-medium hover:underline">
          {item.name}
        </Link>
        <p className="text-sm text-muted-foreground">{item.optionsLabel}</p>
        <Price price={item.price} compareAt={item.compareAtPrice} />
        {!item.available && <p className="text-sm text-destructive">Currently unavailable</p>}
      </div>
      <div className="mt-4 flex gap-2">
        <Button
          className="flex-1"
          disabled={!item.available || addToCart.isPending}
          onClick={() => {
            addToCart.mutate({ variantId: item.variantId, quantity: 1 });
          }}
        >
          <ShoppingBagIcon /> {addToCart.isSuccess ? 'Added' : 'Add to cart'}
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label={`Remove ${item.name} from wishlist`}
          disabled={remove.isPending}
          onClick={() => {
            remove.mutate(item.variantId);
          }}
        >
          <TrashIcon />
        </Button>
      </div>
      {(addToCart.isError || remove.isError) && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {userMessage(addToCart.error ?? remove.error)}
        </p>
      )}
    </li>
  );
}
