import { LockIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Cart } from '@/lib/api/cart';
import { formatMoney } from '@/lib/format';

export function OrderSummary({
  cart,
  action,
  extra,
}: {
  cart: Cart;
  action?: ReactNode;
  extra?: ReactNode;
}) {
  const rows = [
    { label: 'Subtotal', value: formatMoney(cart.subtotal) },
    ...(cart.discount.amount > 0
      ? [
          {
            label: `Discount${cart.couponCode ? ` (${cart.couponCode})` : ''}`,
            value: `−${formatMoney(cart.discount)}`,
          },
        ]
      : []),
    {
      label: 'Shipping',
      value: cart.shipping.amount === 0 ? 'Free' : formatMoney(cart.shipping),
    },
    { label: 'Incl. VAT', value: formatMoney(cart.tax) },
  ];
  return (
    <aside
      aria-label="Order summary"
      className="h-fit rounded-3xl border bg-card p-6 lg:sticky lg:top-32"
    >
      <h2 className="text-lg font-semibold">Order summary</h2>
      <dl className="mt-6 grid gap-3 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="tabular-nums">{row.value}</dd>
          </div>
        ))}
        <div className="mt-2 flex justify-between border-t pt-4 text-base font-semibold">
          <dt>Total</dt>
          <dd className="tabular-nums">{formatMoney(cart.total)}</dd>
        </div>
      </dl>
      {extra && <div className="mt-6">{extra}</div>}
      {action && <div className="mt-6">{action}</div>}
      <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <LockIcon className="size-3" aria-hidden="true" /> Secure checkout powered by Stripe
      </p>
    </aside>
  );
}
