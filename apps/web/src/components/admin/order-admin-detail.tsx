'use client';

import { SHIPPING_COUNTRIES, type Address, type Order, type Payment } from '@market/types';
import { useState, type SubmitEvent } from 'react';
import { OrderStatusBadge, orderStatusLabel } from '@/components/orders/order-status';
import { FormField } from '@/components/auth/form-field';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useAdminOrder,
  useChangeOrderStatus,
  useOrderPayments,
  useRefund,
  type StatusChange,
} from '@/lib/api/admin';
import { formatDateTime, formatMoney } from '@/lib/format';
import {
  AdminPage,
  ErrorNote,
  formText,
  Panel,
  parseAmount,
  SelectField,
  toAmountInput,
} from './admin-page';

export function OrderAdminDetail({ id }: { id: string }) {
  const order = useAdminOrder(id);
  if (order.isPending) {
    return (
      <AdminPage title="Order" back={{ href: '/admin/orders', label: 'Orders' }}>
        <Skeleton className="h-96" />
      </AdminPage>
    );
  }
  if (order.isError) {
    return (
      <AdminPage title="Order" back={{ href: '/admin/orders', label: 'Orders' }}>
        <ErrorNote error={order.error} />
      </AdminPage>
    );
  }
  const o = order.data;
  return (
    <AdminPage
      title={
        <span className="flex flex-wrap items-center gap-3">
          {o.number} <OrderStatusBadge status={o.status} />
        </span>
      }
      description={`${o.email} · placed ${formatDateTime(o.createdAt)}`}
      back={{ href: '/admin/orders', label: 'Orders' }}
    >
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="grid content-start gap-6">
          <Panel title="Items">
            <ul className="divide-y">
              {o.items.map((item) => (
                <li key={item.id} className="flex justify-between gap-4 py-3 text-sm">
                  <div>
                    <p className="font-medium">
                      {item.quantity} × {item.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.sku}
                      {item.optionsLabel ? ` · ${item.optionsLabel}` : ''}
                    </p>
                  </div>
                  <span className="tabular-nums">{formatMoney(item.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 grid gap-1 border-t pt-3 text-sm">
              <Row label="Subtotal" value={formatMoney(o.subtotal)} />
              {o.discount.amount > 0 && (
                <Row
                  label={`Discount${o.couponCode ? ` (${o.couponCode})` : ''}`}
                  value={`−${formatMoney(o.discount)}`}
                />
              )}
              <Row
                label="Shipping"
                value={o.shipping.amount === 0 ? 'Free' : formatMoney(o.shipping)}
              />
              <Row
                label={`VAT included (${(o.vatRateBps / 100).toFixed(0)}%)`}
                value={formatMoney(o.tax)}
              />
              <Row label="Total" value={formatMoney(o.total)} strong />
            </dl>
          </Panel>
          <PaymentsPanel order={o} />
          <Panel title="Timeline">
            <ol className="grid gap-3 text-sm">
              {[...o.history].reverse().map((entry, i) => (
                <li key={`${entry.at}-${String(i)}`} className="grid gap-0.5 border-l-2 pl-3">
                  <span className="font-medium">{orderStatusLabel(entry.status)}</span>
                  {entry.note && <span className="text-muted-foreground">{entry.note}</span>}
                  <span className="text-xs text-muted-foreground">{formatDateTime(entry.at)}</span>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
        <div className="grid content-start gap-6">
          <FulfilmentPanel order={o} />
          <Panel title="Shipping address">
            <AddressBlock address={o.shippingAddress} />
            {o.notes && <p className="mt-3 rounded-lg bg-secondary p-3 text-sm">“{o.notes}”</p>}
          </Panel>
        </div>
      </div>
    </AdminPage>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? 'flex justify-between font-semibold' : 'flex justify-between'}>
      <dt className={strong ? '' : 'text-muted-foreground'}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

function AddressBlock({ address }: { address: Address }) {
  return (
    <address className="text-sm leading-relaxed not-italic">
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
      {address.phone && (
        <>
          <br />
          {address.phone}
        </>
      )}
    </address>
  );
}

/** Only the next legal step is offered; the service enforces the state machine anyway. */
function FulfilmentPanel({ order }: { order: Order }) {
  const change = useChangeOrderStatus(order.id);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (order.status === 'SHIPPED' || order.status === 'DELIVERED') {
    return (
      <Panel title="Shipping">
        <dl className="grid gap-1 text-sm">
          <Row label="Carrier" value={order.carrier ?? '—'} />
          <Row label="Tracking" value={order.trackingNumber ?? '—'} />
          {order.shippedAt && <Row label="Shipped" value={formatDateTime(order.shippedAt)} />}
          {order.deliveredAt && <Row label="Delivered" value={formatDateTime(order.deliveredAt)} />}
        </dl>
        {order.trackingUrl && (
          <a
            href={order.trackingUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-sm underline"
          >
            Track parcel
          </a>
        )}
        {order.status === 'SHIPPED' && (
          <Button
            className="mt-4 w-full"
            disabled={change.isPending}
            onClick={() => {
              change.mutate({ status: 'DELIVERED' });
            }}
          >
            Mark delivered
          </Button>
        )}
        <ErrorNote error={change.error} />
      </Panel>
    );
  }

  function ship(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (k: string) => formText(data, k);
    const next: Record<string, string> = {};
    if (!text('carrier')) next.carrier = 'Required';
    if (text('trackingNumber').length < 3) next.trackingNumber = 'At least 3 characters';
    const url = text('trackingUrl');
    if (url && !url.startsWith('https://')) next.trackingUrl = 'Must start with https://';
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    const body: StatusChange = {
      status: 'SHIPPED',
      carrier: text('carrier'),
      trackingNumber: text('trackingNumber'),
      trackingUrl: url || null,
    };
    change.mutate(body);
  }

  return (
    <Panel title="Fulfilment">
      {order.status === 'PAID' && (
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">
            Paid {order.paidAt ? formatDateTime(order.paidAt) : ''}. Start preparing it.
          </p>
          <Button
            disabled={change.isPending}
            onClick={() => {
              change.mutate({ status: 'PROCESSING' });
            }}
          >
            Start preparing
          </Button>
        </div>
      )}
      {order.status === 'PROCESSING' && (
        <form onSubmit={ship} noValidate className="grid gap-3">
          <FormField label="Carrier" name="carrier" defaultValue="DHL" error={errors.carrier} />
          <FormField label="Tracking number" name="trackingNumber" error={errors.trackingNumber} />
          <FormField
            label="Tracking URL (optional)"
            name="trackingUrl"
            type="url"
            placeholder="https://"
            error={errors.trackingUrl}
          />
          <Button type="submit" disabled={change.isPending}>
            Mark shipped
          </Button>
          <p className="text-xs text-muted-foreground">
            The customer gets an email with the tracking number.
          </p>
        </form>
      )}
      {order.status === 'PENDING_PAYMENT' && (
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">
            Waiting for payment
            {order.paymentDueAt ? ` until ${formatDateTime(order.paymentDueAt)}` : ''}. Cancelling
            releases the stock and discount.
          </p>
          <Button
            variant="outline"
            disabled={change.isPending}
            onClick={() => {
              if (window.confirm(`Cancel order ${order.number}?`))
                change.mutate({ status: 'CANCELLED' });
            }}
          >
            Cancel order
          </Button>
        </div>
      )}
      {['CANCELLED', 'REFUNDED', 'FAILED', 'PENDING'].includes(order.status) && (
        <p className="text-sm text-muted-foreground">
          {orderStatusLabel(order.status)}
          {order.cancelledAt ? ` on ${formatDateTime(order.cancelledAt)}` : ''}. No further steps.
        </p>
      )}
      <div className="mt-3">
        <ErrorNote error={change.error} />
      </div>
    </Panel>
  );
}

const REFUND_REASONS = [
  { value: 'requested_by_customer', label: 'Requested by customer' },
  { value: 'duplicate', label: 'Duplicate payment' },
  { value: 'fraudulent', label: 'Fraudulent' },
] as const;

function PaymentsPanel({ order }: { order: Order }) {
  const payments = useOrderPayments(order.id);
  return (
    <Panel title="Payments">
      {payments.isPending ? (
        <Skeleton className="h-16" />
      ) : payments.isError ? (
        <ErrorNote error={payments.error} />
      ) : payments.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No payment attempts yet.</p>
      ) : (
        <ul className="grid gap-4">
          {payments.data.map((payment) => (
            <PaymentRow key={payment.id} order={order} payment={payment} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function PaymentRow({ order, payment }: { order: Order; payment: Payment }) {
  const refund = useRefund(order.id);
  const [open, setOpen] = useState(false);
  const [amountError, setAmountError] = useState<string>();
  const refundable = payment.amount.amount - payment.refunded.amount;
  const canRefund =
    refundable > 0 && (payment.status === 'SUCCEEDED' || payment.status === 'PARTIALLY_REFUNDED');

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const amount = parseAmount(formText(data, 'amount'));
    if (amount === null || amount <= 0 || amount > refundable) {
      setAmountError(`Between 0.01 and ${toAmountInput(refundable)}`);
      return;
    }
    setAmountError(undefined);
    const label = formatMoney({ amount, currency: payment.amount.currency });
    if (!window.confirm(`Refund ${label} to the customer? This cannot be undone.`)) return;
    refund.mutate(
      {
        paymentId: payment.id,
        amount: amount === refundable ? undefined : amount,
        reason: data.get('reason') as (typeof REFUND_REASONS)[number]['value'],
      },
      {
        onSuccess: () => {
          setOpen(false);
        },
      },
    );
  }

  return (
    <li className="rounded-xl border p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">
          {formatMoney(payment.amount)} · {payment.status.replaceAll('_', ' ').toLowerCase()}
        </span>
        <span className="font-mono text-xs text-muted-foreground">
          {payment.providerPaymentId ?? payment.provider}
        </span>
      </div>
      {payment.lastError && <p className="mt-1 text-destructive">{payment.lastError}</p>}
      {payment.refunds.length > 0 && (
        <ul className="mt-2 grid gap-1 text-muted-foreground">
          {payment.refunds.map((r) => (
            <li key={r.id}>
              Refund {formatMoney(r.amount)} · {r.status.toLowerCase()} ·{' '}
              {formatDateTime(r.createdAt)}
            </li>
          ))}
        </ul>
      )}
      {canRefund && !open && (
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => {
            setOpen(true);
          }}
        >
          Refund…
        </Button>
      )}
      {open && (
        <form
          onSubmit={submit}
          noValidate
          className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        >
          <FormField
            label={`Amount (max ${toAmountInput(refundable)})`}
            name="amount"
            inputMode="decimal"
            defaultValue={toAmountInput(refundable)}
            error={amountError}
          />
          <SelectField label="Reason" name="reason" options={REFUND_REASONS} />
          <div className="flex gap-2">
            <Button type="submit" disabled={refund.isPending}>
              Refund
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setOpen(false);
              }}
            >
              Cancel
            </Button>
          </div>
          <div className="sm:col-span-3">
            <ErrorNote error={refund.error} />
          </div>
        </form>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        Refunds are sent to Stripe; the order updates when Stripe confirms them.
      </p>
    </li>
  );
}
