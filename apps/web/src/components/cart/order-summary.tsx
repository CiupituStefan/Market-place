'use client';

import { LockIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Cart } from '@/lib/api/cart';
import { useI18n } from '@/components/i18n/provider';

export function OrderSummary({
  cart,
  action,
  extra,
}: {
  cart: Cart;
  action?: ReactNode;
  extra?: ReactNode;
}) {
  const { t, money } = useI18n();
  const copy = t.cart.summary;
  const rows = [
    { label: copy.subtotal, value: money(cart.subtotal) },
    ...(cart.discount.amount > 0
      ? [
          {
            label: copy.discount(cart.couponCode),
            value: `−${money(cart.discount)}`,
          },
        ]
      : []),
    {
      label: copy.shipping,
      value: cart.shipping.amount === 0 ? copy.free : money(cart.shipping),
    },
    { label: copy.vat, value: money(cart.tax) },
  ];
  return (
    <aside
      aria-label={copy.title}
      className="h-fit rounded-3xl border bg-card p-6 lg:sticky lg:top-32"
    >
      <h2 className="text-lg font-semibold">{copy.title}</h2>
      <dl className="mt-6 grid gap-3 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="tabular-nums">{row.value}</dd>
          </div>
        ))}
        <div className="mt-2 flex justify-between border-t pt-4 text-base font-semibold">
          <dt>{copy.total}</dt>
          <dd className="tabular-nums">{money(cart.total)}</dd>
        </div>
      </dl>
      {extra && <div className="mt-6">{extra}</div>}
      {action && <div className="mt-6">{action}</div>}
      <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <LockIcon className="size-3" aria-hidden="true" /> {copy.secure}
      </p>
    </aside>
  );
}
