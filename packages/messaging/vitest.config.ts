import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    environment: 'node',
    // PGlite (Postgres in WebAssembly) boots in seconds; under a loaded CI runner
    // that can exceed vitest's 5s/10s defaults.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
