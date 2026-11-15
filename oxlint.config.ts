import { defineConfig } from 'oxlint';

/** Syntax that `.agents/rules` forbids everywhere, independent of file kind. */
const forbiddenSyntax = [
  {
    'selector': 'FunctionDeclaration',
    'message': 'Use an arrow function bound to a const instead of a function declaration.',
  },
  {
    'selector':
      'FunctionExpression:not(MethodDefinition[kind=/^(constructor|get|set)$/] > FunctionExpression):not(Property[kind=/^(get|set)$/] > FunctionExpression)',
    'message': 'Use an arrow function; only constructors, getters and setters keep function syntax.',
  },
  {
    'selector': "TSAsExpression[typeAnnotation.type='TSUnknownKeyword']",
    'message': 'Do not launder values through `as unknown`; decode or narrow them instead.',
  },
];

/** Type declarations belong in `types/` folders. */
const typeDeclarationSyntax = [
  {
    'selector': 'TSInterfaceDeclaration, TSTypeAliasDeclaration',
    'message': 'Declare interfaces and type aliases in a `types/` folder.',
  },
];

/** A block body holding one expression statement should be an expression body. */
const singleExpressionBlockSyntax = [
  {
    'selector': 'ArrowFunctionExpression > BlockStatement.body[body.length=1] > ExpressionStatement',
    'message':
      'Use an expression body (`void expression` when the result is discarded) instead of a one-statement block.',
  },
];

/** Import specifier prefixes that resolve to project-owned modules. */
const internalPrefixes = [
  '@analyzer/',
  '@benchmark/',
  '@bundler/',
  '@core/',
  '@definitions/',
  '@executor',
  '@extension/',
  '@lsp/',
  '@mcp/',
  '@parser/',
  '@scripts/',
  '@server/',
  '@standards/',
  '@typings/',
  '@tests/',
  '@utils/',
  '@workspace/',
  '$lib',
  '$styles',
  '$app/',
  '$env/',
  './$types',
];

export default defineConfig({
  'jsPlugins': [
    { 'name': 'anti-slop', 'specifier': './tools/oxlint/anti-slop/index.ts' },
    { 'name': 'eslint-js', 'specifier': 'oxlint-plugin-eslint' },
    { 'name': 'standards', 'specifier': './tools/oxlint/standards/index.ts' },
  ],
  'plugins': ['eslint', 'typescript', 'import', 'oxc'],
  'options': { 'typeAware': true },
  'ignorePatterns': [
    '**/dist/**',
    '**/out/**',
    '**/build/**',
    '**/coverage/**',
    '**/.svelte-kit/**',
    '**/node_modules/**',
    '**/*.vsix',
    '**/data/**',
    '.gitlab-ci-local/**',
    '.agent/**',
    '.agents/**',
    '.claude/**',
    '.codex/**',
    '.continue/**',
    '.cursor/**',
    '.gemini/**',
    '.opencode/**',
    '.pi/**',
    '.roo/**',
    '.windsurf/**',
    'tools/oxlint/anti-slop/**',
  ],
  'rules': {
    'anti-slop/no-chained-type-assertions': 'error',
    'anti-slop/no-conditional-empty-object-spread': 'error',
    'anti-slop/no-known-value-widening': 'error',
    'anti-slop/no-module-mocking': 'error',
    'anti-slop/no-object-parameters': 'error',
    'anti-slop/no-reflect-apply': 'error',
    'anti-slop/no-reflect-get': 'error',
    'anti-slop/no-runtime-typeof': ['error', { 'allowInTypeGuards': true }],
    'anti-slop/no-shape-in-symbol-names': 'error',
    'anti-slop/no-unknown-parameters': 'error',
    'anti-slop/no-unknown-returns': 'error',
    'anti-slop/no-unknown-type-aliases': 'error',
    'anti-slop/no-unsafe-dictionary-type': 'error',
    'anti-slop/no-widen-then-assert': 'error',
    'anti-slop/require-safety-comment-for-type-assertion': 'error',

    'standards/no-line-comments': 'error',
    'standards/require-export-jsdoc': 'error',
    'standards/import-groups': ['error', { 'internalPrefixes': internalPrefixes }],

    'eslint/curly': ['error', 'multi'],
    'eslint/func-style': ['error', 'expression'],
    'eslint/prefer-arrow-callback': 'error',
    'eslint/arrow-body-style': ['error', 'as-needed'],
    'eslint/eqeqeq': ['error', 'always'],
    'eslint/prefer-const': 'error',
    'eslint/no-var': 'error',
    'eslint/no-unreachable': 'error',
    'eslint/no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
    'eslint/no-redeclare': 'error',
    'eslint/no-constant-condition': ['error', { 'checkLoops': false }],
    'eslint/no-else-return': 'error',
    'eslint/no-warning-comments': ['error', { 'terms': ['todo', 'fixme', 'hack'], 'location': 'anywhere' }],
    'eslint/id-denylist': ['error', 'msg', 'btn', 'req', 'res', 'cfg', 'mgr', 'srv', 'usr'],
    'eslint/no-restricted-imports': [
      'error',
      {
        'patterns': [
          {
            'group': ['./*', './**', '../*', '../**', '!./$types'],
            'message': 'Use a path alias instead of a relative import.',
          },
        ],
      },
    ],
    'eslint-js/quote-props': ['error', 'always'],
    'eslint-js/no-restricted-syntax': [
      'error',
      ...forbiddenSyntax,
      ...typeDeclarationSyntax,
      ...singleExpressionBlockSyntax,
    ],

    'typescript/no-explicit-any': 'error',
    'typescript/no-non-null-assertion': 'error',
    'typescript/no-require-imports': 'error',
    'typescript/consistent-type-imports': ['error', { 'prefer': 'type-imports', 'fixStyle': 'separate-type-imports' }],
    'typescript/strict-boolean-expressions': [
      'error',
      {
        'allowAny': false,
        'allowString': false,
        'allowNumber': false,
        'allowNullableObject': false,
        'allowNullableBoolean': false,
        'allowNullableString': false,
        'allowNullableNumber': false,
        'allowNullableEnum': false,
      },
    ],

    'import/no-duplicates': 'error',
    'import/first': 'error',
    'import/newline-after-import': 'error',
  },
  'overrides': [
    {
      'files': ['**/types/**', '**/*.d.ts'],
      'rules': {
        'eslint-js/no-restricted-syntax': ['error', ...forbiddenSyntax, ...singleExpressionBlockSyntax],
      },
    },
    {
      'files': ['apps/web/src/**/*.svelte', 'apps/web/src/routes/**/+*.ts'],
      'rules': {
        'eslint-js/no-restricted-syntax': ['error', ...forbiddenSyntax, ...typeDeclarationSyntax],
      },
    },
    {
      'files': ['**/*.svelte'],
      'rules': {
        'standards/svelte-explicit-guards': 'error',
      },
    },
  ],
});
