'use client';

import { ShoppingBagIcon } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useCart } from '@/lib/api/cart';

/** Header cart button with the live item count (from the shared ['cart'] query). */
export function CartLink() {
  const cart = useCart();
  const count = cart.data?.itemCount ?? 0;
  const label = count > 0 ? `Cart, ${String(count)} item${count === 1 ? '' : 's'}` : 'Cart';
  return (
    <Button variant="ghost" size="icon" asChild className="relative">
      <Link href="/cart" aria-label={label} prefetch={false}>
        <ShoppingBagIcon />
        {count > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 font-mono text-[10px] leading-none font-semibold text-brand-foreground tabular-nums"
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </Link>
    </Button>
  );
}
