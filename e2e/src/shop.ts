import type { Page } from '@playwright/test';
import { address } from './api.js';
import { expect } from './fixtures.js';

/**
 * What a shopper does, in the words of the page (roles and labels, never CSS): the tests read
 * like the journey, and a change that breaks accessibility breaks them too.
 */
export const shop = {
  /** The product's default variant into the cart (from its page, or the page already open). */
  async addToCart(page: Page, slug?: string): Promise<void> {
    if (slug) await page.goto(`/product/${slug}`);
    // The page is server-rendered: a tap before React hydrates it does nothing (as for a real
    // shopper on a slow phone). Tap again until the button confirms; the item is added once.
    await expect(async () => {
      if (await page.getByRole('button', { name: 'Add to cart' }).isVisible()) {
        await page.getByRole('button', { name: 'Add to cart' }).click();
      }
      await expect(page.getByRole('button', { name: 'Added to cart' })).toBeVisible({
        timeout: 2_000,
      });
    }).toPass({ timeout: 20_000 });
  },

  /** Cart → checkout → order placed; returns the order page URL's order id. */
  async checkout(page: Page, email: string | null): Promise<string> {
    await page.goto('/cart');
    await page.getByRole('link', { name: 'Checkout' }).click();
    await expect(page).toHaveURL(/\/checkout$/);
    // Signed-in customers have their email filled in already.
    if (email) await page.getByLabel('Email').fill(email);
    const shipping = address();
    await page.getByLabel('First name').fill(shipping.firstName);
    await page.getByLabel('Last name').fill(shipping.lastName);
    await page.getByLabel('Address', { exact: true }).fill(shipping.line1);
    await page.getByLabel('City').fill(shipping.city);
    await page.getByLabel('Postal code').fill(shipping.postalCode);
    await page.getByLabel('Country').selectOption(shipping.country);
    await page.getByRole('button', { name: 'Place order' }).click();
    await expect(page).toHaveURL(/\/order\/[0-9a-f-]{36}$/);
    return page.url().split('/').pop() ?? '';
  },

  /** On the order page: pays with the test provider (`decline` simulates a refused card). */
  async pay(page: Page, outcome: 'succeed' | 'decline' = 'succeed'): Promise<void> {
    if (outcome === 'decline') {
      await page.getByRole('button', { name: 'Simulate decline' }).click();
      await expect(page.getByText('Your card was declined. Try again.')).toBeVisible();
      return;
    }
    await page.getByRole('button', { name: /^Pay .* \(test\)$/ }).click();
  },

  /** The order's status badge reads `status`, as the webhook-confirmed state comes in. */
  async expectStatus(page: Page, status: string): Promise<void> {
    await expect(page.getByText(status, { exact: true }).first()).toBeVisible({ timeout: 45_000 });
  },
};
