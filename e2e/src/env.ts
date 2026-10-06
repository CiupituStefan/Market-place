/** Where the shop under test is. Defaults: Docker Compose on this machine. */
export const env = {
  webUrl: process.env.E2E_WEB_URL ?? 'http://localhost:3000',
  apiUrl: process.env.E2E_API_URL ?? 'http://localhost:4000',
  mailUrl: process.env.E2E_MAIL_URL ?? 'http://localhost:8025',
  adminEmail: process.env.E2E_ADMIN_EMAIL ?? 'admin@csekeyboards.test',
  adminPassword: process.env.E2E_ADMIN_PASSWORD ?? 'admin passphrase for local dev',
  /** A Chromium already on the machine, instead of Playwright's download. */
  chromiumPath: process.env.E2E_CHROMIUM_PATH,
  ci: Boolean(process.env.CI),
};
