import { defineConfig, devices } from '@playwright/test';
import { env } from './src/env.js';

/**
 * End-to-end tests against a running shop: Docker Compose locally and in CI
 * (`docker compose up --wait`, then `pnpm --filter @market/e2e e2e`). See docs/testing.md.
 *
 * The journeys share one database, so every test creates its own data (unique emails, its own
 * product where stock matters) and never depends on another test's leftovers. That lets them
 * run in parallel and be re-run against the same stack.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: env.ci,
  // A failure is a failure: no blind retries hiding flaky journeys. Traces and screenshots of
  // the first attempt say what happened.
  retries: 0,
  workers: env.ci ? 2 : 4,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: env.ci
    ? [['list'], ['html', { open: 'never' }], ['github']]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: env.webUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'en-GB',
    timezoneId: 'Europe/Bucharest',
    launchOptions: env.chromiumPath ? { executablePath: env.chromiumPath } : {},
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    // The storefront is mobile-first: the purchase journey also runs on a phone viewport.
    { name: 'mobile', use: { ...devices['Pixel 7'] }, grep: /@mobile/ },
  ],
});
