import { ShopApi } from '../src/api.js';
import { expect, test } from '../src/fixtures.js';

test.describe('no overselling', () => {
  test('two shoppers race for the last unit: exactly one order gets it', async ({
    page,
    adminApi,
    customer,
  }) => {
    const { slug, variantId } = await adminApi.createStockedProduct(1);
    const [first, second] = await Promise.all([ShopApi.create(), ShopApi.create()]);
    try {
      // Both carts accept the item: stock is only reserved when an order is placed.
      const [cartA, cartB] = await Promise.all([
        first.addToCart(variantId),
        second.addToCart(variantId),
      ]);
      const results = await Promise.all([
        first.placeOrder(customer.email, cartA.total.amount),
        second.placeOrder(customer.email, cartB.total.amount),
      ]);

      const statuses = results.map((result) => result.status).sort();
      expect(statuses).toEqual([201, 409]);
      const refused = results.find((result) => result.status === 409);
      expect(refused?.body.error?.code).toBe('INSUFFICIENT_STOCK');

      const stock = await adminApi.stockOf(variantId);
      expect(stock).toMatchObject({ onHand: 1, reserved: 1, available: 0 });
    } finally {
      await Promise.all([first.dispose(), second.dispose()]);
    }

    // The storefront learns it is sold out (inventory → Kafka → catalog).
    await expect
      .poll(
        async () => {
          await page.goto(`/product/${slug}`);
          return page.getByRole('button', { name: 'Sold out' }).isVisible();
        },
        { timeout: 45_000, intervals: [2_000] },
      )
      .toBe(true);
    await expect(page.getByRole('button', { name: 'Sold out' })).toBeDisabled();
  });
});
