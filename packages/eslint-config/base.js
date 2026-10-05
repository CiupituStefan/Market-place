// @ts-check
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

/**
 * Base config for every TypeScript workspace. Type-aware linting is enabled via
 * the project service, so each workspace only needs a tsconfig.json.
 *
 * @param {{ tsconfigRootDir: string }} options
 */
export function base({ tsconfigRootDir }) {
  return tseslint.config(
    {
      ignores: ['**/dist/**', '**/.next/**', '**/coverage/**', '**/node_modules/**'],
    },
    js.configs.recommended,
    ...tseslint.configs.strictTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,
    {
      languageOptions: {
        parserOptions: {
          projectService: true,
          tsconfigRootDir,
        },
      },
      linterOptions: {
        reportUnusedDisableDirectives: 'error',
      },
      rules: {
        '@typescript-eslint/consistent-type-imports': [
          'error',
          { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
        ],
        '@typescript-eslint/no-unused-vars': [
          'error',
          { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
        ],
        '@typescript-eslint/restrict-template-expressions': [
          'error',
          { allowNumber: true, allowBoolean: true },
        ],
        '@typescript-eslint/no-floating-promises': 'error',
        '@typescript-eslint/switch-exhaustiveness-check': 'error',
        eqeqeq: ['error', 'always'],
        'no-console': 'error',
      },
    },
    {
      files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
      ...tseslint.configs.disableTypeChecked,
    },
    {
      files: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}', '**/test/**/*.ts'],
      rules: {
        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        // Nest's getHttpServer() is typed as any; passing it to supertest is the standard idiom.
        '@typescript-eslint/no-unsafe-argument': 'off',
      },
    },
    // Must stay last: turns off rules that conflict with Prettier.
    prettier,
  );
}
