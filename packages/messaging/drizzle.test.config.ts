import { defineConfig } from 'drizzle-kit';

/** Generates the migrations used by this package's tests (test/migrations). */
export default defineConfig({
  dialect: 'postgresql',
  schema: './test/schema.ts',
  out: './test/migrations',
  strict: true,
});
