import { describe, expect, it } from 'vitest';
import { escapeHtml, renderEmail } from './blocks.js';
import { formatMoney, renderTemplate, templateDefinitions, TEMPLATES } from './templates.js';

const context = { webUrl: 'https://shop.test' };
const footer = { reason: 'Because.', unsubscribeUrl: null };
const eur = (amount: number) => ({ amount, currency: 'EUR' });
const orderId = '6f1c2a51-6c1e-4a53-9a65-3b8a7c1d2e3f';
const expiresAt = '2026-10-06T10:00:00.000Z';

/** Valid sample data for every template (also proves each one renders). */
const samples: Record<(typeof TEMPLATES)[number], unknown> = {
  EMAIL_VERIFICATION: {
    firstName: 'Ana',
    link: 'https://shop.test/verify-email?token=t',
    expiresAt,
  },
  PASSWORD_RESET: { firstName: null, link: 'https://shop.test/reset-password?token=t', expiresAt },
  ORDER_CONFIRMATION: {
    orderId,
    orderNumber: 'CSE-1',
    paidAt: expiresAt,
    summary: {
      lines: [{ name: 'Board', sku: 'B', quantity: 1, unitPrice: eur(10_000) }],
      subtotal: eur(10_000),
      discount: eur(0),
      shipping: eur(1_500),
      tax: eur(1_836),
      total: eur(11_500),
      couponCode: null,
    },
  },
  ORDER_SHIPPED: {
    orderId,
    orderNumber: 'CSE-1',
    carrier: 'DHL',
    trackingNumber: 'T1',
    trackingUrl: null,
  },
  ORDER_DELIVERED: { orderId, orderNumber: 'CSE-1' },
  ORDER_CANCELLED: { orderId, orderNumber: 'CSE-1', reason: 'ADMIN', refundRequired: false },
  PAYMENT_FAILED: { orderId, orderNumber: 'CSE-1', failureMessage: null },
  REFUND_ISSUED: {
    orderId,
    orderNumber: 'CSE-1',
    refunded: eur(11_500),
    totalRefunded: eur(11_500),
    isFullRefund: true,
  },
  NEWSLETTER_CONFIRM: { link: 'https://shop.test/newsletter/confirm?token=t' },
  NEWSLETTER_WELCOME: {},
};

describe('email templates', () => {
  it.each(TEMPLATES)('%s renders HTML and a plain-text alternative', (name) => {
    const email = renderEmail(renderTemplate(name, samples[name], context), footer);
    expect(email.subject.length).toBeGreaterThan(5);
    expect(email.html).toMatch(/^<!doctype html>/);
    expect(email.text).toContain('CSE Keyboards');
    expect(email.text).not.toContain('<');
    expect(templateDefinitions[name].category).toBeDefined();
  });

  it('formats money in minor units', () => {
    expect(formatMoney(eur(12_999))).toBe('€129.99');
    expect(formatMoney({ amount: 5_000, currency: 'USD' })).toBe('US$50.00');
  });

  it('escapes data in HTML', () => {
    const email = renderEmail(
      renderTemplate(
        'PAYMENT_FAILED',
        { orderId, orderNumber: 'CSE-1', failureMessage: '<script>alert(1)</script>' },
        context,
      ),
      footer,
    );
    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;script&gt;');
    expect(escapeHtml(`"'&`)).toBe('&quot;&#39;&amp;');
  });

  it('refuses non-http links and invalid data', () => {
    expect(() =>
      renderEmail(
        {
          subject: 's',
          preheader: 'p',
          blocks: [{ type: 'button', label: 'x', href: 'javascript:alert(1)' }],
        },
        footer,
      ),
    ).toThrow(/javascript/);
    expect(() => renderTemplate('ORDER_DELIVERED', { orderId: 'nope' }, context)).toThrow();
  });
});
