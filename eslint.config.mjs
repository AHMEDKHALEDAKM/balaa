import tseslint from 'typescript-eslint';
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      'apps/dashboard/out/**',
      '**/.expo/**',
      '**/dist/**',
      '**/next-env.d.ts',
      'supabase/functions/**',
      'apps/dashboard/public/vendor/**',
    ],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    // Google Apps Script: files share one global scope, so top-level functions and
    // globals (crypto, process, Promise) are used from other files or by Google itself.
    files: ['apps-script/**/*.js'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-this-alias': 'off',
    },
  },
);
