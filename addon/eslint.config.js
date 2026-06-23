import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  // Only lint application source; build output is generated.
  { ignores: ['dist/**'] },

  // Base JS + TypeScript recommended rule sets.
  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['src/**/*.{ts,tsx}'],
    // Register the React Hooks plugin explicitly. eslint-plugin-react-hooks v7
    // still ships its `configs.recommended` with a `plugins: [...]` array, which
    // ESLint 10 flat config rejects, so we wire up the plugin object ourselves
    // and pull in its recommended rule set below.
    plugins: {
      'react-hooks': reactHooks,
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      // Browser + es2022 globals so DOM types (fetch, document, window, URL,
      // confirm, HTMLElement, Blob, ...) don't trip no-undef.
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Keep exhaustive-deps an error so the existing
      // `eslint-disable-next-line react-hooks/exhaustive-deps` comments
      // remain load-bearing (react-hooks v7 recommended defaults it to "warn").
      'react-hooks/exhaustive-deps': 'error',

      // --- react-hooks v7 React Compiler rules relaxed for existing patterns ---
      // Intentional "sync prop into state" effect (ModelCombobox query mirror).
      'react-hooks/set-state-in-effect': 'off',
      // Intentional "latest value" ref written during render (ReviewTable txRef).
      'react-hooks/refs': 'off',

      // --- ESLint core rules (new in v9/v10) relaxed for intentional code ---
      // Defensive `let x = ''` initializer before a try/catch reassigns it (ai.ts).
      'no-useless-assignment': 'off',
      // PDF text sanitizer matches control chars on purpose (pdf.ts).
      'no-control-regex': 'off',
      // Errors are re-thrown with a custom message; chaining `cause` not required (ai.ts).
      'preserve-caught-error': 'off',
    },
  },

  {
    // Test files use `any` for fixtures/mocks intentionally.
    files: ['src/**/*.test.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
