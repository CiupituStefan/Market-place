import { money, type Currency, type Order, type OrderSummary } from '@market/types';
import type { HistoryRow, OrderItemRow, OrderRow } from '../db/schema.js';
import { isCustomerVisible } from './status.js';

const iso = (date: Date | null) => date?.toISOString() ?? null;

export function toOrder(row: OrderRow, items: OrderItemRow[], history: HistoryRow[]): Order {
  const currency = row.currency as Currency;
  return {
    id: row.id,
    number: row.number,
    status: row.status,
    email: row.email,
    items: items.map((item) => ({
      id: item.id,
      kind: item.kind,
      variantId: item.variantId,
      configurationId: item.configurationId,
      configurator: item.configurator,
      selection: item.selection,
      productSlug: item.productSlug,
      sku: item.sku,
      name: item.name,
      optionsLabel: item.optionsLabel,
      preview: item.preview,
      imageUrl: item.imageUrl,
      quantity: item.quantity,
      unitPrice: money(item.unitPrice, currency),
      lineTotal: money(item.lineTotal, currency),
    })),
    subtotal: money(row.subtotal, currency),
    discount: money(row.discount, currency),
    shipping: money(row.shipping, currency),
    tax: money(row.tax, currency),
    vatRateBps: row.vatRateBps,
    total: money(row.total, currency),
    couponCode: row.couponCode,
    shippingAddress: row.shippingAddress,
    billingAddress: row.billingAddress,
    notes: row.notes,
    paymentDueAt: row.status === 'PENDING_PAYMENT' ? iso(row.paymentDueAt) : null,
    paidAt: iso(row.paidAt),
    cancelledAt: iso(row.cancelledAt),
    cancelReason: row.cancelReason,
    carrier: row.carrier,
    trackingNumber: row.trackingNumber,
    trackingUrl: row.trackingUrl,
    shippedAt: iso(row.shippedAt),
    deliveredAt: iso(row.deliveredAt),
    // Customers see the visible part of the timeline only.
    history: history
      .filter((entry) => isCustomerVisible(entry.toStatus))
      .map((entry) => ({
        status: entry.toStatus,
        note: entry.note,
        at: entry.createdAt.toISOString(),
      })),
    createdAt: row.createdAt.toISOString(),
  };
}

export function toSummary(row: OrderRow, items: OrderItemRow[]): OrderSummary {
  return {
    id: row.id,
    number: row.number,
    status: row.status,
    email: row.email,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    total: money(row.total, row.currency as Currency),
    previews: items.slice(0, 4).map((item) => item.preview),
    createdAt: row.createdAt.toISOString(),
  };
}
