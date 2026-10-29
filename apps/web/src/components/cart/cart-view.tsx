'use client';

import { MAX_LINE_QUANTITY, type CartItem } from '@market/types';
import {
  AlertTriangleIcon,
  CloudOffIcon,
  MinusIcon,
  PlusIcon,
  ShoppingBagIcon,
  TrashIcon,
} from 'lucide-react';
import Link from '@/components/i18n/link';
import { useI18n } from '@/components/i18n/provider';
import { EmptyState } from '@/components/empty-state';
import { ProductArt } from '@/components/product/product-art';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCart, useRemoveCartItem, useUpdateCartQuantity, type Cart } from '@/lib/api/cart';
import { userMessage } from '@/lib/api/errors';
import { CouponForm } from './coupon-form';
import { FreeShippingProgress } from './free-shipping-progress';
import { OrderSummary } from './order-summary';

export function CartView() {
  const { t } = useI18n();
  const copy = t.cart;
  const cart = useCart();

  if (cart.isPending) {
    return (
      <div className="grid gap-4" aria-busy="true" aria-label={copy.loading}>
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
    );
  }
  if (cart.isError) {
    return (
      <EmptyState
        icon={CloudOffIcon}
        title={copy.loadFailed}
        description={userMessage(cart.error, t)}
        action={
          <Button variant="outline" onClick={() => void cart.refetch()}>
            {t.common.tryAgain}
          </Button>
        }
      />
    );
  }
  if (cart.data.items.length === 0) {
    return (
      <EmptyState
        icon={ShoppingBagIcon}
        title={copy.emptyTitle}
        description={copy.emptyBody}
        action={
          <Button asChild>
            <Link href="/shop/keyboards">{copy.shopKeyboards}</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
      <div className="grid gap-6">
        <Notices cart={cart.data} />
        <FreeShippingProgress cart={cart.data} />
        <ul className="divide-y border-y">
          {cart.data.items.map((item) => (
            <CartLine key={item.id} item={item} />
          ))}
        </ul>
      </div>
      <OrderSummary
        cart={cart.data}
        extra={<CouponForm couponCode={cart.data.couponCode} />}
        action={
          cart.data.canCheckout ? (
            <Button size="lg" className="w-full" asChild>
              <Link href="/checkout">{copy.checkout}</Link>
            </Button>
          ) : (
            <>
              <Button size="lg" className="w-full" disabled>
                {copy.checkout}
              </Button>
              <p className="mt-2 text-center text-xs text-destructive">{copy.fixItems}</p>
            </>
          )
        }
      />
    </div>
  );
}

function Notices({ cart }: { cart: Cart }) {
  const { t } = useI18n();
  // Item-level stock/availability messages are shown on the line itself.
  const general = cart.notices.filter(
    (notice) => notice.code === 'PRICE_CHANGED' || notice.code === 'COUPON_REMOVED',
  );
  if (general.length === 0) return null;
  return (
    <ul
      role="status"
      className="grid gap-2 rounded-2xl border border-brand/30 bg-brand-soft/60 p-4"
    >
      {general.map((notice, index) => (
        <li key={`${notice.code}-${String(index)}`} className="flex gap-2 text-sm">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
          {t.errors.preferServerMessage
            ? notice.message
            : (t.cart.notices[notice.code] ?? notice.message)}
        </li>
      ))}
    </ul>
  );
}

function CartLine({ item }: { item: CartItem }) {
  const { t, money } = useI18n();
  const copy = t.cart;
  const update = useUpdateCartQuantity();
  const remove = useRemoveCartItem();
  const busy = update.isPending || remove.isPending;
  const error = update.error ?? remove.error;
  const href = item.productSlug
    ? `/product/${item.productSlug}`
    : item.configurator
      ? `/configurator/${item.configurator}`
      : null;
  const maxQuantity =
    item.availableQuantity === null
      ? MAX_LINE_QUANTITY
      : Math.min(MAX_LINE_QUANTITY, Math.max(item.availableQuantity, 1));

  return (
    <li className="flex gap-4 py-6" aria-busy={busy}>
      <div className="flex size-20 shrink-0 items-center justify-center rounded-xl bg-stage p-2 sm:size-24">
        <ProductArt preview={item.preview} title="" className="w-full" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {href ? (
          <Link href={href} className="font-medium hover:underline">
            {item.name}
          </Link>
        ) : (
          <span className="font-medium">{item.name}</span>
        )}
        <p className="text-sm text-muted-foreground">{item.optionsLabel}</p>
        <p className="text-sm text-muted-foreground tabular-nums">
          {copy.each(money(item.unitPrice))}
        </p>
        {!item.available && (
          <p className="text-sm text-destructive">
            {item.availableQuantity === null || item.availableQuantity > 0
              ? item.availableQuantity === null
                ? copy.noLongerAvailable
                : copy.onlyLeft(item.availableQuantity)
              : copy.outOfStock}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <div
            className="flex h-9 items-center rounded-lg border"
            role="group"
            aria-label={copy.quantity}
          >
            <Button
              variant="ghost"
              size="icon"
              className="size-9"
              aria-label={copy.decrease(item.name)}
              disabled={busy || item.quantity <= 1}
              onClick={() => {
                update.mutate({ itemId: item.id, quantity: item.quantity - 1 });
              }}
            >
              <MinusIcon />
            </Button>
            <output
              className="w-8 text-center font-mono text-sm tabular-nums"
              aria-label={copy.quantityOf(item.name)}
            >
              {item.quantity}
            </output>
            <Button
              variant="ghost"
              size="icon"
              className="size-9"
              aria-label={copy.increase(item.name)}
              disabled={busy || item.quantity >= maxQuantity}
              onClick={() => {
                update.mutate({ itemId: item.id, quantity: item.quantity + 1 });
              }}
            >
              <PlusIcon />
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => {
              remove.mutate(item.id);
            }}
          >
            <TrashIcon /> {copy.remove}
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {userMessage(error, t)}
          </p>
        )}
      </div>
      <p className="shrink-0 font-medium tabular-nums">{money(item.lineTotal)}</p>
    </li>
  );
}
