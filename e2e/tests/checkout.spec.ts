import { expect, test } from '../src/fixtures.js';
import { shop } from '../src/shop.js';

test.describe('guest checkout', () => {
  test('a visitor finds a keyboard, buys it and pays, and gets the confirmation @mobile', async ({
    page,
    customer,
  }) => {
    // Browse like a shopper: the keyboards category, then the first product in it.
    await page.goto('/shop/keyboards');
    await page.getByRole('article').first().getByRole('heading').getByRole('link').click();
    await expect(page).toHaveURL(/\/product\//);
    await shop.addToCart(page);

    await shop.checkout(page, customer.email);
    await shop.expectStatus(page, 'Awaiting payment');
    await shop.pay(page);
    // Paid only once the provider's (signed) webhook says so: the page waits for it.
    await shop.expectStatus(page, 'Paid');

    // The email (sent from the order.paid event, through Kafka) names the same order.
    const email = await customer.mailbox.waitFor(/^Order .+ confirmed$/);
    expect(email.text).toMatch(/thanks for your order/i);
    const orderNumber = /^Order (\S+) confirmed$/.exec(email.subject)?.[1] ?? '';
    await expect(page.getByText(orderNumber).first()).toBeVisible();
  });

  test('a declined card can be retried, and only the successful payment counts', async ({
    page,
    customer,
    adminApi,
  }) => {
    const { slug } = await adminApi.createStockedProduct(5);
    await shop.addToCart(page, slug);
    await shop.checkout(page, customer.email);

    await shop.pay(page, 'decline');
    await shop.expectStatus(page, 'Awaiting payment');
    await shop.pay(page);
    await shop.expectStatus(page, 'Paid');
    await customer.mailbox.waitFor(/^Order .+ confirmed$/);
  });
});

test.describe('prices are decided by the server', () => {
  test('a stale total is refused, and the cart ignores client-sent prices', async ({
    api,
    adminApi,
    customer,
  }) => {
    const { variantId } = await adminApi.createStockedProduct(5, 4_900);
    const cart = await api.ok<{ total: { amount: number } }>('POST', 'cart/items', {
      variantId,
      quantity: 1,
    });
    // The cart computes from the catalog; a field like `price` is not accepted at all.
    const tampered = await api.call('POST', 'cart/items', { variantId, quantity: 1, price: 1 });
    expect(tampered.status).toBe(400);

    const stale = await api.placeOrder(customer.email, cart.total.amount - 100);
    expect(stale.status).toBe(409);
    expect(stale.body.error?.code).toBe('PRICE_CHANGED');

    const placed = await api.placeOrder(customer.email, cart.total.amount);
    expect(placed.status).toBe(201);
  });
});
