import type { z } from 'zod';

export class ConfigError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Invalid environment configuration:\n  - ${issues.join('\n  - ')}`);
    this.name = 'ConfigError';
    this.issues = issues;
  }
}

/**
 * Validates environment variables against a schema and returns a typed, frozen
 * config object. Fails fast at boot with every problem listed at once.
 *
 * Error messages name the variable and the rule, never the value, so secrets
 * cannot leak into logs through a misconfiguration.
 */
export function loadEnv<S extends z.ZodObject>(
  schema: S,
  source: Record<string, string | undefined> = process.env,
): Readonly<z.infer<S>> {
  // Treat empty strings as "unset" so `FOO=` in a .env file falls back to defaults.
  const cleaned = Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined && value !== ''),
  );
  const result = schema.safeParse(cleaned);
  if (!result.success) {
    throw new ConfigError(
      result.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`),
    );
  }
  return Object.freeze(result.data);
}
