import { money, percentage, type Currency, type DiscountType, type Money } from '@market/types';

export interface PricingSettings {
  currency: Currency;
  /** VAT included in prices, in basis points. */
  vatRateBps: number;
  freeShippingThreshold: number;
  shippingFlatRate: number;
}

export interface PricedTotals {
  subtotal: Money;
  discount: Money;
  shipping: Money;
  tax: Money;
  total: Money;
}

/**
 * Server-side cart arithmetic, all in integer minor units:
 *   subtotal  = Σ unit price × quantity (current catalog prices)
 *   discount  = % of subtotal (half-up) or a fixed amount, never above the subtotal
 *   shipping  = free from the threshold (after discount), otherwise flat; none for an empty cart
 *   total     = subtotal − discount + shipping
 *   tax       = VAT contained in the VAT-inclusive total
 */
export function priceCart(
  lines: readonly { unitPrice: number; quantity: number }[],
  discount: { type: DiscountType; value: number } | null,
  settings: PricingSettings,
): PricedTotals {
  const { currency } = settings;
  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const discountAmount = !discount
    ? 0
    : discount.type === 'PERCENTAGE'
      ? percentage(money(subtotal, currency), discount.value).amount
      : Math.min(discount.value, subtotal);
  const afterDiscount = subtotal - discountAmount;
  const shipping =
    lines.length === 0 || afterDiscount >= settings.freeShippingThreshold
      ? 0
      : settings.shippingFlatRate;
  const total = afterDiscount + shipping;
  const tax = Math.round((total * settings.vatRateBps) / (10_000 + settings.vatRateBps));
  return {
    subtotal: money(subtotal, currency),
    discount: money(discountAmount, currency),
    shipping: money(shipping, currency),
    tax: money(tax, currency),
    total: money(total, currency),
  };
}
