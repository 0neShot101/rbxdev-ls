/**
 * LSP Server Capabilities
 *
 * Defines the capabilities that this language server advertises to clients.
 * These capabilities determine which LSP features are available, such as
 * completion, hover, diagnostics, semantic tokens, and more.
 */

import {
  CodeActionKind,
  SemanticTokenModifiers,
  SemanticTokenTypes,
  TextDocumentSyncKind,
  type CompletionOptions,
  type ServerCapabilities,
  type SignatureHelpOptions,
} from 'vscode-languageserver';

/**
 * Configuration options for the completion provider.
 *
 * Specifies that resolve is not supported and defines trigger characters
 * that will automatically invoke completion suggestions.
 */
const completionOptions: CompletionOptions = {
  'resolveProvider': false,
  'triggerCharacters': ['.', ':', '"', "'", '[', '('],
};

/**
 * Configuration options for the signature help provider.
 *
 * Defines characters that trigger signature help display and characters
 * that re-trigger it when navigating between function parameters.
 */
const signatureHelpOptions: SignatureHelpOptions = {
  'triggerCharacters': ['(', ','],
  'retriggerCharacters': [','],
};

/**
 * Semantic token types supported by this language server.
 *
 * These types are used to classify different code elements for
 * syntax highlighting purposes, including namespaces, types, classes,
 * enums, functions, variables, and more.
 */
const tokenTypes = [
  SemanticTokenTypes.namespace,
  SemanticTokenTypes.type,
  SemanticTokenTypes.class,
  SemanticTokenTypes.enum,
  SemanticTokenTypes.enumMember,
  SemanticTokenTypes.function,
  SemanticTokenTypes.method,
  SemanticTokenTypes.parameter,
  SemanticTokenTypes.variable,
  SemanticTokenTypes.property,
  SemanticTokenTypes.keyword,
  SemanticTokenTypes.string,
  SemanticTokenTypes.number,
  SemanticTokenTypes.operator,
  SemanticTokenTypes.comment,
];

/**
 * Semantic token modifiers supported by this language server.
 *
 * These modifiers provide additional context about tokens, such as
 * whether they are declarations, readonly, deprecated, or part of
 * the default library.
 */
const tokenModifiers = [
  SemanticTokenModifiers.declaration,
  SemanticTokenModifiers.definition,
  SemanticTokenModifiers.readonly,
  SemanticTokenModifiers.deprecated,
  SemanticTokenModifiers.modification,
  SemanticTokenModifiers.documentation,
  SemanticTokenModifiers.defaultLibrary,
];

/**
 * The complete set of server capabilities advertised to LSP clients.
 *
 * Includes support for:
 * - Incremental text document synchronization
 * - Code completion with custom trigger characters
 * - Hover information
 * - Signature help for function calls
 * - Color provider for color literals
 * - Quick fix code actions
 * - Document symbols for outline view
 * - Go to definition
 * - Find references
 * - Rename with prepare support
 * - Inlay hints
 * - Document formatting
 * - Semantic tokens for enhanced syntax highlighting
 */
export const serverCapabilities: ServerCapabilities = {
  'textDocumentSync': TextDocumentSyncKind.Incremental,
  'completionProvider': completionOptions,
  'hoverProvider': true,
  'signatureHelpProvider': signatureHelpOptions,
  'colorProvider': true,
  'codeActionProvider': {
    'codeActionKinds': [CodeActionKind.QuickFix],
  },
  'documentSymbolProvider': true,
  'definitionProvider': true,
  'referencesProvider': true,
  'renameProvider': {
    'prepareProvider': true,
  },
  'inlayHintProvider': true,
  'documentFormattingProvider': true,
  'semanticTokensProvider': {
    'legend': {
      'tokenTypes': tokenTypes,
      'tokenModifiers': tokenModifiers,
    },
    'full': true,
  },
};
