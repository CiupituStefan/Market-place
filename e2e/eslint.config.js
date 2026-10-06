import { node } from '@market/eslint-config/node';

export default [
  { ignores: ['playwright-report/', 'test-results/', 'blob-report/'] },
  ...node({ tsconfigRootDir: import.meta.dirname }),
  // Playwright fixtures that need no other fixture are declared with `async ({}, use)`.
  { rules: { 'no-empty-pattern': 'off' } },
];
