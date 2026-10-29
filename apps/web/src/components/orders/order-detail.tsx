'use client';

import type { Address, Order } from '@market/types';
import { SHIPPING_COUNTRIES } from '@market/types';
import { ClockIcon, CloudOffIcon, LoaderIcon, PackageIcon, TruckIcon } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import Link from '@/components/i18n/link';
import { useI18n } from '@/components/i18n/provider';
import { LOCALE_INFO } from '@/lib/i18n/config';
import { useSearchParams } from 'next/navigation';
import { EmptyState } from '@/components/empty-state';
import { ProductArt } from '@/components/product/product-art';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError, userMessage } from '@/lib/api/errors';
import { CART_QUERY_KEY } from '@/lib/api/cart';
import { useCancelOrder, useOrder } from '@/lib/api/orders';
import { OrderStatusBadge } from './order-status';
import { PaymentPanel } from './payment-panel';

/** One order, for its owner (session) or the guest who placed it (order token). */
export function OrderDetail({ orderId, backHref }: { orderId: string; backHref: string | null }) {
  // Stripe redirects back here with ?redirect_status=... after 3-D Secure / bank pages.
  const { t } = useI18n();
  const copy = t.orders;
  const redirectStatus = useSearchParams().get('redirect_status');
  const returnedFromStripe = redirectStatus === 'succeeded' || redirectStatus === 'processing';
  const [submittedHere, setSubmitted] = useState(false);
  const submitted = submittedHere || returnedFromStripe;
  const order = useOrder(orderId, { awaitingPayment: submitted });
  const queryClient = useQueryClient();
  const settled = submitted && order.data !== undefined && order.data.status !== 'PENDING_PAYMENT';
  useEffect(() => {
    if (!settled) return;
    // cart-service empties the cart when it consumes OrderPaid (asynchronous, usually well under
    // a second): refresh the header count now and once more shortly after.
    void queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
    const again = setTimeout(
      () => void queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY }),
      2_000,
    );
    return () => {
      clearTimeout(again);
    };
  }, [settled, queryClient]);

  if (order.isPending) {
    return (
      <div className="grid gap-4" aria-busy="true" aria-label={copy.loading}>
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
        title={missing ? copy.notFound : copy.loadFailed}
        description={missing ? copy.notFoundHint : userMessage(order.error, t)}
        action={
          missing ? (
            <Button asChild>
              <Link
                href={`/login?next=${encodeURIComponent(`/order/${orderId}`)}`}
                prefetch={false}
              >
                {copy.signIn}
              </Link>
            </Button>
          ) : (
            <Button variant="outline" onClick={() => void order.refetch()}>
              {t.common.tryAgain}
            </Button>
          )
        }
      />
    );
  }
  return (
    <OrderView
      order={order.data}
      backHref={backHref}
      paymentSubmitted={submitted}
      onPaymentSubmitted={() => {
        setSubmitted(true);
      }}
    />
  );
}

function OrderView({
  order,
  backHref,
  paymentSubmitted,
  onPaymentSubmitted,
}: {
  order: Order;
  backHref: string | null;
  paymentSubmitted: boolean;
  onPaymentSubmitted: () => void;
}) {
  const { t, locale, money, dateTime } = useI18n();
  const copy = t.orders;
  const summary = t.cart.summary;
  const cancel = useCancelOrder(order.id);
  const rows = [
    { label: summary.subtotal, value: money(order.subtotal) },
    ...(order.discount.amount > 0
      ? [
          {
            label: summary.discount(order.couponCode),
            value: `−${money(order.discount)}`,
          },
        ]
      : []),
    {
      label: summary.shipping,
      value: order.shipping.amount === 0 ? summary.free : money(order.shipping),
    },
    {
      label: copy.vat((order.vatRateBps / 100).toLocaleString(LOCALE_INFO[locale].intl)),
      value: money(order.tax),
    },
  ];

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-sm text-muted-foreground">{copy.number(order.number)}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {copy.placed(dateTime(order.createdAt), order.email)}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      {order.status === 'PENDING_PAYMENT' && (
        <section
          aria-label={copy.payment}
          className="grid gap-5 rounded-2xl border border-brand/30 bg-brand-soft/40 p-5"
        >
          <div className="flex flex-wrap items-center gap-4">
            <ClockIcon className="size-5 text-brand" aria-hidden="true" />
            <div className="flex-1 text-sm">
              <p className="font-medium">{copy.awaitingPayment}</p>
              {order.paymentDueAt && (
                <p className="text-muted-foreground">
                  {copy.heldUntil(dateTime(order.paymentDueAt))}
                </p>
              )}
            </div>
            {!paymentSubmitted && (
              <Button
                variant="outline"
                disabled={cancel.isPending}
                onClick={() => {
                  cancel.mutate();
                }}
              >
                {copy.cancel}
              </Button>
            )}
          </div>
          {cancel.isError && (
            <p role="alert" className="text-sm text-destructive">
              {userMessage(cancel.error, t)}
            </p>
          )}
          {paymentSubmitted ? (
            <p role="status" className="flex items-center gap-2 text-sm">
              <LoaderIcon className="size-4 animate-spin" aria-hidden="true" /> {copy.confirming}
            </p>
          ) : (
            <PaymentPanel order={order} onSubmitted={onPaymentSubmitted} />
          )}
        </section>
      )}

      {order.trackingNumber && (
        <section
          aria-label={copy.tracking}
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
              {copy.trackParcel}
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
                  {item.quantity} × {money(item.unitPrice)}
                </span>
              </div>
              <span className="shrink-0 font-medium tabular-nums">{money(item.lineTotal)}</span>
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
              <dt>{summary.total}</dt>
              <dd className="tabular-nums">{money(order.total)}</dd>
            </div>
          </dl>
          <AddressBlock title={copy.shippingTo} address={order.shippingAddress} />
          <ol className="grid gap-3 text-sm" aria-label={copy.timeline}>
            {order.history.map((entry, index) => (
              <li key={`${entry.at}-${String(index)}`} className="flex gap-3">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" aria-hidden="true" />
                <div>
                  <p className="font-medium">{copy.status[entry.status]}</p>
                  {entry.note && <p className="text-muted-foreground">{entry.note}</p>}
                  <p className="text-xs text-muted-foreground">{dateTime(entry.at)}</p>
                </div>
              </li>
            ))}
          </ol>
        </aside>
      </div>

      {backHref && (
        <Button variant="outline" asChild className="w-fit">
          <Link href={backHref}>{copy.allOrders}</Link>
        </Button>
      )}
    </div>
  );
}

function AddressBlock({ title, address }: { title: string; address: Address }) {
  const { locale } = useI18n();
  const country = new Intl.DisplayNames([LOCALE_INFO[locale].intl], { type: 'region' }).of(
    address.country,
  );
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
        {country ?? SHIPPING_COUNTRIES[address.country]}
      </address>
    </div>
  );
}
