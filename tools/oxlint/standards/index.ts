import { defineRule, eslintCompatPlugin } from '@oxlint/plugins';

import type { ESTree } from '@oxlint/plugins';
import type { DocumentedDeclaration, ImportGroup, ImportGroupsOptions, RuleOption } from '@standards/types/rules';

/** Position of each import group; a lower group may not follow a higher one. */
const importGroupRank: Readonly<Record<ImportGroup, number>> = {
  'external': 0,
  'internal': 1,
  'type': 2,
};

/** Whether a configured option value is a list of strings. */
const isStringList = (value: RuleOption | undefined): value is string[] =>
  Array.isArray(value) && value.every((item): item is string => typeof item === 'string');

/** Whether a configured option value is a JSON object. */
const isJsonObject = (value: RuleOption | undefined): value is { readonly [key: string]: RuleOption } =>
  typeof value === 'object' && value !== null && Array.isArray(value) === false;

/** Decode the first rule option into import-group options, defaulting to no internal prefixes. */
const decodeImportGroupsOptions = (value: RuleOption | undefined): ImportGroupsOptions => {
  if (isJsonObject(value) === false) return { 'internalPrefixes': [] };
  const prefixes = value['internalPrefixes'];
  return { 'internalPrefixes': isStringList(prefixes) ? prefixes : [] };
};

/** Classify an import declaration into its ordering group. */
const classifyImport = (node: ESTree.ImportDeclaration, options: ImportGroupsOptions): ImportGroup => {
  if (node.importKind === 'type') return 'type';
  const source = node.source.value;
  return options.internalPrefixes.some(prefix => source.startsWith(prefix)) ? 'internal' : 'external';
};

/** Whether a comment is a JSDoc block with content beyond its delimiters. */
const isNonEmptyJsDoc = (comment: ESTree.Comment): boolean =>
  comment.type === 'Block' && comment.value.startsWith('*') && comment.value.replace(/[\s*]/g, '').length > 0;

/** Whether an exported declaration is one whose contract must be documented. */
const requiresDocumentation = (declaration: ESTree.Declaration): declaration is DocumentedDeclaration => {
  if (declaration.type === 'VariableDeclaration')
    return declaration.declarations.some(
      declarator =>
        declarator.init !== null &&
        (declarator.init.type === 'ArrowFunctionExpression' || declarator.init.type === 'FunctionExpression'),
    );
  return (
    declaration.type === 'FunctionDeclaration' ||
    declaration.type === 'TSDeclareFunction' ||
    declaration.type === 'ClassDeclaration' ||
    declaration.type === 'TSInterfaceDeclaration' ||
    declaration.type === 'TSTypeAliasDeclaration'
  );
};

/** Reject `//` line comments; triple-slash directives remain allowed. */
const noLineCommentsRule = defineRule({
  'meta': {
    'type': 'suggestion',
    'docs': { 'description': 'Disallow `//` line comments; use JSDoc blocks for documentation.' },
    'messages': { 'lineComment': 'Line comments are not allowed; document with a `/** ... */` block or remove it.' },
    'schema': [],
  },
  'create': context => ({
    'Program': () =>
      context.sourceCode
        .getAllComments()
        .filter(comment => comment.type === 'Line' && comment.value.startsWith('/') === false)
        .forEach(comment => context.report({ 'loc': comment.loc, 'messageId': 'lineComment' })),
  }),
});

/** Require a nonempty JSDoc block before exported functions, classes, interfaces, types and arrow bindings. */
const requireExportJsDocRule = defineRule({
  'meta': {
    'type': 'suggestion',
    'docs': { 'description': 'Require a nonempty JSDoc block on exported declarations.' },
    'messages': { 'missingJsDoc': 'Exported declaration requires a preceding nonempty `/** ... */` JSDoc block.' },
    'schema': [],
  },
  'create': context => ({
    'ExportNamedDeclaration': node => {
      if (node.declaration === null || requiresDocumentation(node.declaration) === false) return;
      const preceding = context.sourceCode.getCommentsBefore(node).at(-1);
      if (preceding === undefined || isNonEmptyJsDoc(preceding) === false)
        context.report({ node, 'messageId': 'missingJsDoc' });
    },
  }),
});

/** Enforce import groups: external and builtin values, then internal aliases, then type-only imports. */
const importGroupsRule = defineRule({
  'meta': {
    'type': 'suggestion',
    'docs': { 'description': 'Order imports as external/builtin, internal aliases, then type-only imports.' },
    'messages': {
      'misordered': 'Import group `{{group}}` must precede `{{previous}}` (order: external, internal, type).',
    },
    'schema': [
      {
        'type': 'object',
        'properties': { 'internalPrefixes': { 'type': 'array', 'items': { 'type': 'string' } } },
        'additionalProperties': false,
      },
    ],
  },
  'create': context => {
    const options = decodeImportGroupsOptions(context.options[0]);
    return {
      'Program': program =>
        void program.body
          .filter((statement): statement is ESTree.ImportDeclaration => statement.type === 'ImportDeclaration')
          .reduce<ImportGroup>((previous, node) => {
            const group = classifyImport(node, options);
            if (importGroupRank[group] >= importGroupRank[previous]) return group;
            context.report({ node, 'messageId': 'misordered', 'data': { group, previous } });
            return previous;
          }, 'external'),
    };
  },
});

/** Boolean naming prefixes from Variables-Skill; such bindings are trusted as booleans without type information. */
const booleanName = /^(is|has|can|should|was)[A-Z]/;

/** Collect identifier and member guards in a test expression whose names do not mark them as booleans. */
const collectImplicitGuards = (expression: ESTree.Expression): ReadonlyArray<ESTree.Expression> => {
  if (expression.type === 'LogicalExpression' && expression.operator !== '??')
    return [...collectImplicitGuards(expression.left), ...collectImplicitGuards(expression.right)];
  if (expression.type === 'UnaryExpression' && expression.operator === '!')
    return collectImplicitGuards(expression.argument);
  if (expression.type === 'Identifier') return booleanName.test(expression.name) ? [] : [expression];
  if (expression.type === 'MemberExpression' && expression.property.type === 'Identifier')
    return booleanName.test(expression.property.name) ? [] : [expression];
  return [];
};

/** Require explicit comparisons in `.svelte` script guards, where type-aware strict-boolean-expressions cannot run. */
const svelteExplicitGuardsRule = defineRule({
  'meta': {
    'type': 'problem',
    'docs': { 'description': 'Require explicit comparisons instead of truthiness tests of non-boolean bindings.' },
    'messages': {
      'implicitGuard':
        'Compare explicitly (for example `!== undefined`, `!== null`, `.length > 0`); only `is/has/can/should/was` booleans may be tested directly.',
    },
    'schema': [],
  },
  'create': context => {
    const report = (test: ESTree.Expression | null): void => {
      if (test !== null)
        collectImplicitGuards(test).forEach(node => context.report({ node, 'messageId': 'implicitGuard' }));
    };
    return {
      'IfStatement': node => report(node.test),
      'ConditionalExpression': node => report(node.test),
      'WhileStatement': node => report(node.test),
      'DoWhileStatement': node => report(node.test),
      'ForStatement': node => report(node.test),
    };
  },
});

/** Project-specific rules from `.agents/rules` that generic Oxlint and anti-slop rules do not cover. */
const standardsPlugin = eslintCompatPlugin({
  'meta': { 'name': 'standards' },
  'rules': {
    'import-groups': importGroupsRule,
    'no-line-comments': noLineCommentsRule,
    'require-export-jsdoc': requireExportJsDocRule,
    'svelte-explicit-guards': svelteExplicitGuardsRule,
  },
});

export default standardsPlugin;
