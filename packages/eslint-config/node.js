// @ts-check
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { base } from './base.js';

/**
 * Config for Node.js workspaces (shared libraries and NestJS services).
 *
 * @param {{ tsconfigRootDir: string, nest?: boolean }} options
 */
export function node({ tsconfigRootDir, nest = false }) {
  return tseslint.config(
    ...base({ tsconfigRootDir }),
    {
      languageOptions: {
        globals: { ...globals.node },
      },
    },
    nest
      ? {
          files: ['**/*.ts'],
          rules: {
            // NestJS DI relies on emitted constructor metadata: a type-only import of an
            // injected class would be erased and break injection at runtime.
            '@typescript-eslint/consistent-type-imports': 'off',
            // Nest modules are decorated empty classes by design.
            '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
            // ESLint's core rule does not see reads inside decorator arguments
            // (e.g. @Body(new ZodValidationPipe(Schema))) and reports false positives.
            'no-useless-assignment': 'off',
          },
        }
      : {},
  );
}
