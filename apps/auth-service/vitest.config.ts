import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // NestJS dependency injection needs decorator metadata, which only SWC/tsc emit.
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    environment: 'node',
    // PGlite (Postgres in WebAssembly) boots in seconds; under a loaded CI runner
    // that can exceed vitest's 5s/10s defaults.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    setupFiles: ['reflect-metadata'],
  },
});
