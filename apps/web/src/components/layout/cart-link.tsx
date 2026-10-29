'use client';

import { ShoppingBagIcon } from 'lucide-react';
import Link from '@/components/i18n/link';
import { useI18n } from '@/components/i18n/provider';
import { Button } from '@/components/ui/button';
import { useCart } from '@/lib/api/cart';

/** Header cart button with the live item count (from the shared ['cart'] query). */
export function CartLink() {
  const { t } = useI18n();
  const cart = useCart();
  const count = cart.data?.itemCount ?? 0;
  const label = count > 0 ? t.layout.cartWithItems(count) : t.layout.cart;
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
