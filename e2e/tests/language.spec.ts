import { expect, test } from '../src/fixtures.js';

/** A shopper's browser: crawlers (and headless browsers) are never redirected by country. */
const DESKTOP =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

test.describe('languages', () => {
  test('visitors from Romania land on Romanian, everyone else on English', async ({ request }) => {
    const visit = (country: string, cookie?: string) =>
      request.get('/shop?sort=newest', {
        headers: {
          'user-agent': DESKTOP,
          'x-vercel-ip-country': country,
          ...(cookie ? { cookie } : {}),
        },
        maxRedirects: 0,
      });
    const fromRomania = await visit('RO');
    expect(fromRomania.status()).toBe(307);
    expect(fromRomania.headers().location).toMatch(/\/ro\/shop\?sort=newest$/);
    expect((await visit('DE')).status()).toBe(200);
    // Having chosen English beats the country.
    expect((await visit('RO', 'cse_locale=en')).status()).toBe(200);
  });

  test('a shopper reads a product in Romanian, then switches to English', async ({ page }) => {
    await page.goto('/ro/product/cse-forge-75');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ro');
    await expect(page.getByRole('heading', { level: 1, name: 'CSE Forge 75' })).toBeVisible();
    await expect(page.getByText('Tastatură mecanică 75%').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Adaugă în coș' })).toBeVisible();
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute(
      'href',
      /\/product\/cse-forge-75$/,
    );

    await page.getByRole('group', { name: 'Limbă' }).getByRole('link', { name: 'en' }).click();
    await expect(page).toHaveURL(/\/product\/cse-forge-75$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('button', { name: 'Add to cart' })).toBeVisible();
    expect((await page.context().cookies()).find((c) => c.name === 'cse_locale')?.value).toBe('en');
  });
});
