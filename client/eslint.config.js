import js from '@eslint/js';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

/**
 * Flat ESLint config (ESLint 9).
 * Baseline guardrails for a React 18 + MUI + Apollo codebase:
 *  - correctness first (hooks rules, no-undef, eqeqeq)
 *  - hygiene (unused vars/imports, prefer-const, no-var)
 *  - console allowed for warn/error (logger parity), flagged otherwise
 */
export default [
  { ignores: ['dist/**', 'node_modules/**', '*.config.js'] },

  js.configs.recommended,

  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        ...globals.browser,
        process: 'readonly',
        __APP_VERSION__: 'readonly',
      },
    },
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooks,
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off', // automatic JSX runtime
      'react/prop-types': 'off', // migrating toward TS-level safety incrementally

      // ── Correctness ──
      'no-undef': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react/jsx-key': 'error',

      // ── Hygiene / consistency ──
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': ['warn', 'always'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      // Copy contains apostrophes/quotes by design (Indian-English copy)
      'react/no-unescaped-entities': 'off',
    },
  },

  {
    // Logger IS the console wrapper – direct calls are its job, and helper
    // signatures stay flexible for call-site ergonomics.
    files: ['src/shared/lib/logger.js'],
    rules: {
      'no-console': 'off',
      'no-unused-vars': 'off',
    },
  },

  {
    // Scaffold for the upcoming /auth/refresh integration – several exports
    // are intentionally ahead of their call sites.
    files: ['src/shared/auth/api/errorHandler.js'],
    rules: {
      'no-unused-vars': 'off',
      'prefer-const': 'off',
    },
  },
];

