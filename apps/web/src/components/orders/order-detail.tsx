'use client';

import type { Address, Order } from '@market/types';
import { SHIPPING_COUNTRIES } from '@market/types';
import { ClockIcon, CloudOffIcon, PackageIcon, TruckIcon } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/empty-state';
import { ProductArt } from '@/components/product/product-art';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError, userMessage } from '@/lib/api/errors';
import { useCancelOrder, useOrder } from '@/lib/api/orders';
import { formatDateTime, formatMoney } from '@/lib/format';
import { orderStatusLabel, OrderStatusBadge } from './order-status';

/** One order, for its owner (session) or the guest who placed it (order token). */
export function OrderDetail({ orderId, backHref }: { orderId: string; backHref: string | null }) {
  const order = useOrder(orderId);

  if (order.isPending) {
    return (
      <div className="grid gap-4" aria-busy="true" aria-label="Loading order">
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (order.isError) {
    const missing = order.error instanceof ApiError && order.error.status === 404;
    return (
      <EmptyState
        icon={missing ? PackageIcon : CloudOffIcon}
        title={missing ? 'Order not found' : 'We couldn’t load this order'}
        description={
          missing
            ? 'Sign in with the account that placed it, or use the link in your confirmation email.'
            : userMessage(order.error)
        }
        action={
          missing ? (
            <Button asChild>
              <Link
                href={`/login?next=${encodeURIComponent(`/order/${orderId}`)}`}
                prefetch={false}
              >
                Sign in
              </Link>
            </Button>
          ) : (
            <Button variant="outline" onClick={() => void order.refetch()}>
              Try again
            </Button>
          )
        }
      />
    );
  }
  return <OrderView order={order.data} backHref={backHref} />;
}

function OrderView({ order, backHref }: { order: Order; backHref: string | null }) {
  const cancel = useCancelOrder(order.id);
  const rows = [
    { label: 'Subtotal', value: formatMoney(order.subtotal) },
    ...(order.discount.amount > 0
      ? [
          {
            label: `Discount${order.couponCode ? ` (${order.couponCode})` : ''}`,
            value: `−${formatMoney(order.discount)}`,
          },
        ]
      : []),
    {
      label: 'Shipping',
      value: order.shipping.amount === 0 ? 'Free' : formatMoney(order.shipping),
    },
    {
      label: `Incl. VAT ${(order.vatRateBps / 100).toLocaleString('en-IE')}%`,
      value: formatMoney(order.tax),
    },
  ];

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-sm text-muted-foreground">Order {order.number}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Placed {formatDateTime(order.createdAt)} · {order.email}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      {order.status === 'PENDING_PAYMENT' && (
        <section
          aria-label="Payment"
          className="flex flex-wrap items-center gap-4 rounded-2xl border border-brand/30 bg-brand-soft/60 p-5"
        >
          <ClockIcon className="size-5 text-brand" aria-hidden="true" />
          <div className="flex-1 text-sm">
            <p className="font-medium">Awaiting payment</p>
            {order.paymentDueAt && (
              <p className="text-muted-foreground">
                Your items are held until {formatDateTime(order.paymentDueAt)}. Unpaid orders are
                cancelled automatically after that.
              </p>
            )}
          </div>
          <Button
            variant="outline"
            disabled={cancel.isPending}
            onClick={() => {
              cancel.mutate();
            }}
          >
            Cancel order
          </Button>
          {cancel.isError && (
            <p role="alert" className="w-full text-sm text-destructive">
              {userMessage(cancel.error)}
            </p>
          )}
        </section>
      )}

      {order.trackingNumber && (
        <section
          aria-label="Tracking"
          className="flex items-center gap-3 rounded-2xl border p-5 text-sm"
        >
          <TruckIcon className="size-5 text-brand" aria-hidden="true" />
          <span>
            {order.carrier} · <span className="font-mono">{order.trackingNumber}</span>
          </span>
          {order.trackingUrl && (
            <a
              href={order.trackingUrl}
              target="_blank"
              rel="noreferrer"
              className="ml-auto underline"
            >
              Track parcel
            </a>
          )}
        </section>
      )}

      <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
        <ul className="divide-y border-y">
          {order.items.map((item) => (
            <li key={item.id} className="flex gap-4 py-5">
              <div className="flex size-20 shrink-0 items-center justify-center rounded-xl bg-stage p-2">
                <ProductArt preview={item.preview} title="" className="w-full" />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="font-medium">{item.name}</span>
                <span className="text-sm text-muted-foreground">{item.optionsLabel}</span>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {item.quantity} × {formatMoney(item.unitPrice)}
                </span>
              </div>
              <span className="shrink-0 font-medium tabular-nums">
                {formatMoney(item.lineTotal)}
              </span>
            </li>
          ))}
        </ul>

        <aside className="grid h-fit gap-6">
          <dl className="grid gap-3 rounded-3xl border p-6 text-sm">
            {rows.map((row) => (
              <div key={row.label} className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className="tabular-nums">{row.value}</dd>
              </div>
            ))}
            <div className="mt-2 flex justify-between border-t pt-4 text-base font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatMoney(order.total)}</dd>
            </div>
          </dl>
          <AddressBlock title="Shipping to" address={order.shippingAddress} />
          <ol className="grid gap-3 text-sm" aria-label="Order timeline">
            {order.history.map((entry, index) => (
              <li key={`${entry.at}-${String(index)}`} className="flex gap-3">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" aria-hidden="true" />
                <div>
                  <p className="font-medium">{orderStatusLabel(entry.status)}</p>
                  {entry.note && <p className="text-muted-foreground">{entry.note}</p>}
                  <p className="text-xs text-muted-foreground">{formatDateTime(entry.at)}</p>
                </div>
              </li>
            ))}
          </ol>
        </aside>
      </div>

      {backHref && (
        <Button variant="outline" asChild className="w-fit">
          <Link href={backHref}>All orders</Link>
        </Button>
      )}
    </div>
  );
}

function AddressBlock({ title, address }: { title: string; address: Address }) {
  return (
    <div className="text-sm">
      <h3 className="font-semibold">{title}</h3>
      <address className="mt-2 text-muted-foreground not-italic">
        {address.firstName} {address.lastName}
        {address.company && (
          <>
            <br />
            {address.company}
          </>
        )}
        <br />
        {address.line1}
        {address.line2 && (
          <>
            <br />
            {address.line2}
          </>
        )}
        <br />
        {address.postalCode} {address.city}
        <br />
        {SHIPPING_COUNTRIES[address.country]}
      </address>
    </div>
  );
}
