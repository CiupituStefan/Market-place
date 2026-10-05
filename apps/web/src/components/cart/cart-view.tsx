'use client';

import { CloudOffIcon, ShoppingBagIcon } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/empty-state';
import { ProductArt } from '@/components/product/product-art';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCart } from '@/lib/api/cart';
import { userMessage } from '@/lib/api/errors';
import { formatMoney } from '@/lib/format';
import { OrderSummary } from './order-summary';

export function CartView() {
  const cart = useCart();

  if (cart.isPending) {
    return (
      <div className="grid gap-4" aria-busy="true" aria-label="Loading cart">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
    );
  }
  if (cart.isError) {
    return (
      <EmptyState
        icon={CloudOffIcon}
        title="We couldn’t load your cart"
        description={userMessage(cart.error)}
        action={
          <Button variant="outline" onClick={() => void cart.refetch()}>
            Try again
          </Button>
        }
      />
    );
  }
  if (cart.data.items.length === 0) {
    return (
      <EmptyState
        icon={ShoppingBagIcon}
        title="Your cart is empty"
        description="Find a board you love — it will wait here for you."
        action={
          <Button asChild>
            <Link href="/shop/keyboards">Shop keyboards</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
      <ul className="divide-y border-y">
        {cart.data.items.map((item) => (
          <li key={item.id} className="flex gap-4 py-6">
            <div className="flex size-24 shrink-0 items-center justify-center rounded-xl bg-stage p-2">
              <ProductArt preview={item.preview} title="" className="w-full" />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <Link href={`/product/${item.productSlug}`} className="font-medium hover:underline">
                {item.name}
              </Link>
              <p className="text-sm text-muted-foreground">{item.optionsLabel}</p>
              <p className="text-sm text-muted-foreground">Qty {item.quantity}</p>
              {!item.available && (
                <p className="text-sm text-destructive">No longer available in this quantity</p>
              )}
            </div>
            <p className="font-medium tabular-nums">{formatMoney(item.lineTotal)}</p>
          </li>
        ))}
      </ul>
      <OrderSummary
        cart={cart.data}
        action={
          <Button size="lg" className="w-full" asChild>
            <Link href="/checkout">Checkout</Link>
          </Button>
        }
      />
    </div>
  );
}
