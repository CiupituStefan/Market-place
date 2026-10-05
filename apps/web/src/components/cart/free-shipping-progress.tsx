import { TruckIcon } from 'lucide-react';
import type { Cart } from '@/lib/api/cart';
import { formatMoney } from '@/lib/format';

/** Display only: the shipping amount itself comes from cart-service. */
export function FreeShippingProgress({ cart }: { cart: Cart }) {
  const threshold = cart.freeShippingThreshold.amount;
  if (threshold <= 0) return null;
  const counted = cart.subtotal.amount - cart.discount.amount;
  const remaining = Math.max(threshold - counted, 0);
  const progress = Math.min(counted / threshold, 1);
  return (
    <div className="grid gap-2 rounded-2xl bg-secondary/60 p-4 text-sm">
      <p className="flex items-center gap-2">
        <TruckIcon className="size-4 text-brand" aria-hidden="true" />
        {remaining === 0 || cart.shipping.amount === 0
          ? 'Your order ships free.'
          : `Add ${formatMoney({ amount: remaining, currency: cart.subtotal.currency })} more for free shipping.`}
      </p>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-border"
        role="progressbar"
        aria-label="Progress to free shipping"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
      >
        <div
          className="h-full rounded-full bg-brand"
          style={{ width: `${String(progress * 100)}%` }}
        />
      </div>
    </div>
  );
}
