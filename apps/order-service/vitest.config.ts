import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // NestJS dependency injection needs decorator metadata, which only SWC/tsc emit.
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    environment: 'node',
    // PGlite and real-Postgres concurrency tests need more than vitest's defaults.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    setupFiles: ['reflect-metadata'],
  },
});
