import { test as base, expect } from '@playwright/test';
import { ShopApi, uniqueEmail } from './api.js';
import { Mailbox } from './mail.js';

interface Fixtures {
  /** A fresh API client with its own cookies (a separate visitor). */
  api: ShopApi;
  /** An API client signed in as the seeded administrator. */
  adminApi: ShopApi;
  /** A unique customer email and its Mailpit mailbox. */
  customer: { email: string; mailbox: Mailbox };
}

/**
 * Every journey also checks what a user never sees: no Content-Security-Policy violation and no
 * uncaught error in the page. A regression in either fails the test that caused it.
 */
export const test = base.extend<Fixtures & { pageProblems: string[] }>({
  pageProblems: [
    async ({ page }, use) => {
      const problems: string[] = [];
      await page.exposeBinding('__e2eReportViolation', (_source, text: string) => {
        problems.push(text);
      });
      await page.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (event) => {
          void (
            window as unknown as { __e2eReportViolation: (text: string) => Promise<void> }
          ).__e2eReportViolation(
            `CSP ${event.effectiveDirective} blocked ${event.blockedURI === '' ? 'inline' : event.blockedURI} on ${location.pathname}`,
          );
        });
      });
      page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
      await use(problems);
      expect(problems, 'CSP violations or uncaught errors in the page').toEqual([]);
    },
    { auto: true },
  ],

  api: async ({}, use) => {
    const api = await ShopApi.create();
    await use(api);
    await api.dispose();
  },

  adminApi: async ({}, use) => {
    const api = await ShopApi.admin();
    await use(api);
    await api.dispose();
  },

  customer: async ({ request }, use) => {
    const email = uniqueEmail('shopper');
    await use({ email, mailbox: new Mailbox(request, email) });
  },
});

export { expect };
