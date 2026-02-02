module.exports = {
  'parser': '@typescript-eslint/parser',
  'extends': ['eslint:recommended', 'prettier'],
  'plugins': ['@typescript-eslint', 'prettier', 'import'],
  'parserOptions': {
    'ecmaVersion': 2022,
    'sourceType': 'module',
  },
  'env': {
    'node': true,
    'es2022': true,
  },
  'globals': {
    'Bun': 'readonly',
    'console': 'readonly',
    'process': 'readonly',
  },
  'rules': {
    'prettier/prettier': ['error', {}, { 'usePrettierrc': true }],
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-var-requires': 'error',
    'prefer-const': 'error',
    'no-var': 'error',
    'no-console': 'off',
    'quote-props': ['error', 'always'],
    'prefer-arrow-callback': 'error',
    'arrow-spacing': 'error',

    'import/order': [
      'error',
      {
        'groups': ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'type'],
        'newlines-between': 'always',
        'alphabetize': {
          'order': 'asc',
          'caseInsensitive': true,
        },
      },
    ],
    'import/newline-after-import': 'error',
    'import/no-duplicates': 'error',
  },
  'ignorePatterns': ['dist/', 'node_modules/', '*.js'],
};
