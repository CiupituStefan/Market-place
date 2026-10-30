import { DomainError, ErrorCode } from '@market/types';
import { describe, expect, it } from 'vitest';
import type { Database } from '../src/db/database.js';
import { CheckoutService } from '../src/orders/checkout.service.js';
import { FakeCart, FakeInventory, address, testConfig } from './harness.js';

describe('order-service: store closed (preview before launch)', () => {
  it('refuses every checkout before touching the cart, stock or database', async () => {
    const cart = new FakeCart();
    const inventory = new FakeInventory();
    // No database at all: the check must come first.
    const checkout = new CheckoutService(
      undefined as unknown as Database,
      testConfig({ ORDERS_ENABLED: 'false' }),
      cart,
      inventory,
    );
    const attempt = checkout.place({ userId: null, guestToken: 'guest-token' }, 'key-12345678', {
      email: 'ana@example.com',
      shippingAddress: { ...address, company: null, line2: null, region: null, phone: null },
      billingAddress: null,
      expectedTotal: 100,
      notes: null,
    });
    await expect(attempt).rejects.toBeInstanceOf(DomainError);
    await expect(attempt).rejects.toMatchObject({ code: ErrorCode.STORE_CLOSED });
  });

  it('is open by default', () => {
    expect(testConfig().ORDERS_ENABLED).toBe(true);
  });
});
