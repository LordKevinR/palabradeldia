import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  {
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'off',
    },
  },
];
