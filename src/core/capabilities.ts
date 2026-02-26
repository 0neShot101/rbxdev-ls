import {
  CodeActionKind,
  SemanticTokenModifiers,
  SemanticTokenTypes,
  TextDocumentSyncKind,
  type CompletionOptions,
  type ServerCapabilities,
  type SignatureHelpOptions,
} from 'vscode-languageserver';

const completionOptions: CompletionOptions = {
  'resolveProvider': false,
  'triggerCharacters': ['.', ':', '"', "'", '[', '('],
};

const signatureHelpOptions: SignatureHelpOptions = {
  'triggerCharacters': ['(', ','],
  'retriggerCharacters': [','],
};

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

const tokenModifiers = [
  SemanticTokenModifiers.declaration,
  SemanticTokenModifiers.definition,
  SemanticTokenModifiers.readonly,
  SemanticTokenModifiers.deprecated,
  SemanticTokenModifiers.modification,
  SemanticTokenModifiers.documentation,
  SemanticTokenModifiers.defaultLibrary,
];

/** The complete set of server capabilities advertised to LSP clients. */
export const serverCapabilities: ServerCapabilities = {
  'textDocumentSync': TextDocumentSyncKind.Incremental,
  'completionProvider': { ...completionOptions, 'resolveProvider': true },
  'hoverProvider': true,
  'signatureHelpProvider': signatureHelpOptions,
  'colorProvider': true,
  'codeActionProvider': {
    'codeActionKinds': [
      CodeActionKind.QuickFix,
      CodeActionKind.Refactor,
      CodeActionKind.RefactorExtract,
      CodeActionKind.RefactorRewrite,
      CodeActionKind.Source,
    ],
  },
  'documentSymbolProvider': true,
  'definitionProvider': true,
  'referencesProvider': true,
  'renameProvider': {
    'prepareProvider': true,
  },
  'inlayHintProvider': true,
  'documentFormattingProvider': true,
  'workspaceSymbolProvider': true,
  'foldingRangeProvider': true,
  'callHierarchyProvider': true,
  'documentHighlightProvider': true,
  'documentLinkProvider': { 'resolveProvider': false },
  'selectionRangeProvider': true,
  'linkedEditingRangeProvider': true,
  'typeHierarchyProvider': true,
  'codeLensProvider': { 'resolveProvider': true },
  'typeDefinitionProvider': true,
  'implementationProvider': true,
  'documentRangeFormattingProvider': true,
  'documentOnTypeFormattingProvider': {
    'firstTriggerCharacter': '\n',
  },
  'semanticTokensProvider': {
    'legend': {
      'tokenTypes': tokenTypes,
      'tokenModifiers': tokenModifiers,
    },
    'full': true,
    'range': true,
  },
};
