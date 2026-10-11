import globals from 'globals';

export default [
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022, sourceType: 'module',
      globals: { ...globals.browser, SVGS: 'readonly', SPRMAP: 'readonly', GRASS: 'readonly' },
    },
    rules: {
      'no-undef': 'error',
      'no-import-assign': 'error',
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }],
    },
  },
  {
    files: ['tools/**/*.mjs', 'sim/**/*.mjs', 'test/**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { ...globals.node } },
  },
];
