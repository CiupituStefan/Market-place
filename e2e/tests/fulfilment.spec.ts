import { ShopApi } from '../src/api.js';
import { Mailbox } from '../src/mail.js';
import { env } from '../src/env.js';
import { expect, test } from '../src/fixtures.js';
import { shop } from '../src/shop.js';

const password = 'linear switches stay quiet 9';

test.describe('from payment to review', () => {
  test('the back office ships and delivers; the customer is told and leaves a verified review', async ({
    page,
    browser,
    customer,
    adminApi,
  }) => {
    test.slow(); // two browsers, three emails, events through Kafka at every step

    // A customer with a confirmed account (made through the API: the account journey has its own test).
    const signup = await ShopApi.create();
    await signup.ok('POST', 'auth/register', {
      email: customer.email,
      password,
      firstName: 'Radu',
      lastName: 'Marin',
    });
    // Reviews need a confirmed email: confirm it with the token from the welcome email.
    const welcome = await customer.mailbox.waitFor(/^Confirm your email address$/);
    const token = new URL(Mailbox.link(welcome, '/verify-email')).searchParams.get('token');
    await signup.ok('POST', 'auth/verify-email', { token });
    await signup.dispose();
    await page.goto('/login');
    await page.getByLabel('Email').fill(customer.email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).not.toHaveURL(/\/login/);

    const { slug } = await adminApi.createStockedProduct(3);
    await shop.addToCart(page, slug);
    const orderId = await shop.checkout(page, null);
    await shop.pay(page);
    await shop.expectStatus(page, 'Paid');

    // The back office, in its own browser session.
    const staff = await browser.newContext();
    const admin = await staff.newPage();
    await admin.goto('/login?next=%2Fadmin');
    await admin.getByLabel('Email').fill(env.adminEmail);
    await admin.getByLabel('Password').fill(env.adminPassword);
    await admin.getByRole('button', { name: 'Sign in' }).click();
    await expect(admin).toHaveURL(/\/admin$/);
    await admin.goto(`/admin/orders/${orderId}`);
    await admin.getByRole('button', { name: 'Start preparing' }).click();
    await admin.getByLabel('Tracking number').fill('JD014600006281234567');
    await admin.getByRole('button', { name: 'Mark shipped' }).click();
    await expect(admin.getByRole('button', { name: 'Mark delivered' })).toBeVisible();

    const shipped = await customer.mailbox.waitFor(/is on its way$/);
    expect(shipped.text).toContain('JD014600006281234567');
    await admin.getByRole('button', { name: 'Mark delivered' }).click();
    await customer.mailbox.waitFor(/was delivered$/);
    await staff.close();

    await page.goto(`/account/orders/${orderId}`);
    await shop.expectStatus(page, 'Delivered');
    await expect(page.getByText('JD014600006281234567')).toBeVisible();

    // The review: marked as a verified purchase by review-service, from the order events.
    await page.goto(`/product/${slug}#reviews`);
    await page.getByRole('radio', { name: '5 stars' }).click();
    await page.getByLabel('Title').fill('Neat and sturdy');
    await page
      .getByRole('textbox', { name: 'Your review', exact: true })
      .fill('Coils nicely, the connector clicks in firmly.');
    await page.getByLabel('Name shown with your review').fill('Radu M.');
    await page.getByRole('button', { name: 'Post review' }).click();
    // Published at once (nothing for moderation to hold) and shown with the badge.
    const mine = page.getByRole('listitem').filter({ hasText: 'Neat and sturdy' });
    await expect(mine).toBeVisible();
    await expect(mine.getByText('Verified purchase')).toBeVisible();
  });
});
