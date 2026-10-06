import { ShopApi, uniqueEmail } from '../src/api.js';
import { expect, test } from '../src/fixtures.js';

test.describe('security in the browser', () => {
  test('every page gets its own CSP nonce, and no inline script runs without it', async ({
    page,
    request,
    pageProblems,
  }) => {
    const nonceOf = async () => {
      const response = await request.get('/');
      const csp = response.headers()['content-security-policy'] ?? '';
      expect(csp).toContain("'strict-dynamic'");
      expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
      expect(csp).toContain("frame-ancestors 'none'");
      return /'nonce-([^']+)'/.exec(csp)?.[1];
    };
    const [a, b] = [await nonceOf(), await nonceOf()];
    expect(a).toBeTruthy();
    expect(a).not.toBe(b);

    // An attacker's markup reaching the DOM (as a stored-XSS bug would put it there): its inline
    // handler must not run, and the browser reports the attempt.
    await page.goto('/');
    const ran = await page.evaluate(async () => {
      const w = window as unknown as { pwned?: boolean };
      w.pwned = false;
      document.body.insertAdjacentHTML(
        'beforeend',
        '<img src="/x.png" onerror="window.pwned=true">',
      );
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      return w.pwned;
    });
    expect(ran).toBe(false);
    await expect.poll(() => pageProblems.length).toBeGreaterThan(0);
    expect(pageProblems.join()).toContain('CSP script-src-attr blocked inline');
    pageProblems.length = 0; // the violation this test provoked on purpose
  });

  test('private areas: anonymous visitors are sent to sign in, customers kept out of the back office', async ({
    page,
    browser,
  }) => {
    await page.goto('/account/orders');
    await expect(page).toHaveURL(/\/login\?next=%2Faccount%2Forders/);

    // A signed-in customer (not staff).
    const email = uniqueEmail('customer');
    const password = 'correct horse battery staple 42';
    const api = await ShopApi.create();
    await api.ok('POST', 'auth/register', { email, password, firstName: 'Ion', lastName: 'Pop' });
    await api.ok('POST', 'auth/login', { email, password });
    const forbidden = await api.call<{ error: { code: string; requestId: string } }>(
      'GET',
      'orders/manage',
    );
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.requestId).toBeTruthy();
    await api.dispose();

    const context = await browser.newContext();
    const customerPage = await context.newPage();
    await customerPage.goto('/login');
    await customerPage.getByLabel('Email').fill(email);
    await customerPage.getByLabel('Password').fill(password);
    await customerPage.getByRole('button', { name: 'Sign in' }).click();
    await expect(customerPage).not.toHaveURL(/\/login/);
    await customerPage.goto('/admin/orders');
    await expect(customerPage.getByRole('table')).toHaveCount(0);
    await expect(customerPage.getByText('You don’t have access')).toBeVisible();
    await context.close();
  });
});
