import type { ESTree, Options } from '@oxlint/plugins';

/** Ordered import groups: value imports from packages, value imports from project aliases, then type-only imports. */
export type ImportGroup = 'external' | 'internal' | 'type';

/** Options accepted by the `standards/import-groups` rule. */
export interface ImportGroupsOptions {
  /** Specifier prefixes that identify project-internal alias imports. */
  readonly internalPrefixes: ReadonlyArray<string>;
}

/** Exported declarations that must carry a preceding JSDoc block. */
export type DocumentedDeclaration =
  | ESTree.Class
  | ESTree.Function
  | ESTree.TSInterfaceDeclaration
  | ESTree.TSTypeAliasDeclaration
  | ESTree.VariableDeclaration;

/** One JSON value supplied as a rule option. */
export type RuleOption = Options[number];
