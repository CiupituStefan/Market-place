import { Mailbox } from '../src/mail.js';
import { expect, test } from '../src/fixtures.js';
import { shop } from '../src/shop.js';

const password = 'tactile switches clack loudly 7';

test.describe('customer account', () => {
  test('register, confirm the email, sign in, buy, and find the order in the account', async ({
    page,
    customer,
    adminApi,
  }) => {
    await page.goto('/register');
    await page.getByLabel('First name').fill('Maria');
    await page.getByLabel('Last name').fill('Ionescu');
    await page.getByLabel('Email').fill(customer.email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByLabel('Confirm password').fill(password);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();

    const welcome = await customer.mailbox.waitFor(/^Confirm your email address$/);
    await page.goto(Mailbox.link(welcome, '/verify-email'));
    // One deliberate click: link scanners that open the email must not confirm it.
    await page.getByRole('button', { name: 'Confirm my email' }).click();
    await expect(page.getByText('Your email is confirmed.')).toBeVisible();

    await page.goto('/login');
    await page.getByLabel('Email').fill(customer.email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).not.toHaveURL(/\/login/);

    const { slug } = await adminApi.createStockedProduct(3);
    await shop.addToCart(page, slug);
    // Signed in: the checkout already knows the email.
    const orderId = await shop.checkout(page, null);
    await shop.pay(page);
    await shop.expectStatus(page, 'Paid');
    const confirmation = await customer.mailbox.waitFor(/^Order .+ confirmed$/);
    const orderNumber = /^Order (\S+) confirmed$/.exec(confirmation.subject)?.[1] ?? '';

    await page.goto('/account/orders');
    const row = page.getByRole('link', { name: new RegExp(orderNumber) });
    await expect(row).toBeVisible();
    await row.click();
    await expect(page).toHaveURL(new RegExp(`/account/orders/${orderId}$`));
    await shop.expectStatus(page, 'Paid');
  });
});
