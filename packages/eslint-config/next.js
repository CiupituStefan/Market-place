// @ts-check
import nextPlugin from '@next/eslint-plugin-next';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { base } from './base.js';

/**
 * Config for the Next.js app: strict TypeScript base + React Hooks (incl. React
 * Compiler rules) + Next.js Core Web Vitals rules.
 *
 * @param {{ tsconfigRootDir: string }} options
 */
export function next({ tsconfigRootDir }) {
  return tseslint.config(
    { ignores: ['.next/**', 'out/**', 'next-env.d.ts'] },
    ...base({ tsconfigRootDir }),
    nextPlugin.configs['core-web-vitals'],
    reactHooks.configs.flat['recommended-latest'],
    {
      languageOptions: {
        globals: { ...globals.browser, ...globals.node },
      },
    },
    {
      files: ['**/*.ts', '**/*.tsx'],
      rules: {
        // Server actions / event handlers commonly return promises to React.
        '@typescript-eslint/no-misused-promises': [
          'error',
          { checksVoidReturn: { attributes: false } },
        ],
      },
    },
  );
}
