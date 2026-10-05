import { defineConfig } from 'drizzle-kit';

/** `pnpm db:generate` diffs the schema and writes a new SQL migration into ./drizzle. */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  strict: true,
  verbose: true,
});
