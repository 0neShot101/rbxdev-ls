import { describe, expect, test } from 'bun:test';
import { serverCapabilities } from '@core/capabilities';

describe('Server Capabilities', () => {
  test.each([
    'hoverProvider',
    'definitionProvider',
    'referencesProvider',
    'documentFormattingProvider',
    'documentSymbolProvider',
    'inlayHintProvider',
    'typeDefinitionProvider',
    'implementationProvider',
    'callHierarchyProvider',
    'typeHierarchyProvider',
    'workspaceSymbolProvider',
    'selectionRangeProvider',
    'colorProvider',
    'documentHighlightProvider',
    'linkedEditingRangeProvider',
    'foldingRangeProvider',
    'documentRangeFormattingProvider',
  ] as const)('enables %s', capability => expect(serverCapabilities[capability]).toBeTruthy());

  test('completionProvider resolves items and triggers on member and string characters', () =>
    expect(serverCapabilities).toMatchObject({
      'completionProvider': {
        'resolveProvider': true,
        'triggerCharacters': expect.arrayContaining(['.', ':', '"', "'"]),
      },
    }));

  test('renameProvider supports prepare', () =>
    expect(serverCapabilities).toMatchObject({ 'renameProvider': { 'prepareProvider': true } }));

  test('signatureHelpProvider triggers on call punctuation', () =>
    expect(serverCapabilities).toMatchObject({
      'signatureHelpProvider': { 'triggerCharacters': expect.arrayContaining(['(', ',']) },
    }));

  test('codeActionProvider advertises expected kinds', () =>
    expect(serverCapabilities).toMatchObject({
      'codeActionProvider': {
        'codeActionKinds': expect.arrayContaining([
          'quickfix',
          'refactor',
          'refactor.extract',
          'refactor.rewrite',
          'source',
        ]),
      },
    }));

  test('codeLensProvider resolves lenses', () =>
    expect(serverCapabilities).toMatchObject({ 'codeLensProvider': { 'resolveProvider': true } }));

  test('documentLinkProvider is defined', () => expect(serverCapabilities.documentLinkProvider).toBeDefined());

  test('documentOnTypeFormattingProvider triggers on newline', () =>
    expect(serverCapabilities).toMatchObject({
      'documentOnTypeFormattingProvider': { 'firstTriggerCharacter': '\n' },
    }));

  test('semanticTokensProvider supports full and range requests with a nonempty legend', () => {
    expect(serverCapabilities).toMatchObject({ 'semanticTokensProvider': { 'full': true, 'range': true } });
    expect(serverCapabilities.semanticTokensProvider?.legend.tokenTypes.length).toBeGreaterThan(0);
    expect(serverCapabilities.semanticTokensProvider?.legend.tokenModifiers.length).toBeGreaterThan(0);
  });

  test('textDocumentSync is incremental', () => expect(serverCapabilities.textDocumentSync).toBe(2));
});
