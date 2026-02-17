import { serverCapabilities } from '@core/capabilities';
import { describe, expect, test } from 'bun:test';

describe('Server Capabilities', () => {
  describe('Core Providers', () => {
    test('has completionProvider', () => {
      expect(serverCapabilities.completionProvider).toBeDefined();
    });

    test('completionProvider has resolveProvider', () => {
      expect(serverCapabilities.completionProvider).toBeDefined();
      expect(
        typeof serverCapabilities.completionProvider === 'object' &&
          serverCapabilities.completionProvider !== null &&
          'resolveProvider' in serverCapabilities.completionProvider &&
          serverCapabilities.completionProvider.resolveProvider,
      ).toBe(true);
    });

    test('completionProvider has trigger characters', () => {
      expect(serverCapabilities.completionProvider).toBeDefined();
      const provider = serverCapabilities.completionProvider as { triggerCharacters?: string[] };
      expect(provider.triggerCharacters).toBeDefined();
      expect(provider.triggerCharacters).toContain('.');
      expect(provider.triggerCharacters).toContain(':');
      expect(provider.triggerCharacters).toContain('"');
      expect(provider.triggerCharacters).toContain("'");
    });

    test('has hoverProvider', () => {
      expect(serverCapabilities.hoverProvider).toBeTruthy();
    });

    test('has definitionProvider', () => {
      expect(serverCapabilities.definitionProvider).toBeTruthy();
    });

    test('has referencesProvider', () => {
      expect(serverCapabilities.referencesProvider).toBeTruthy();
    });

    test('has renameProvider with prepareProvider', () => {
      expect(serverCapabilities.renameProvider).toBeDefined();
      expect(
        typeof serverCapabilities.renameProvider === 'object' &&
          serverCapabilities.renameProvider !== null &&
          'prepareProvider' in serverCapabilities.renameProvider &&
          serverCapabilities.renameProvider.prepareProvider,
      ).toBe(true);
    });

    test('has documentFormattingProvider', () => {
      expect(serverCapabilities.documentFormattingProvider).toBeTruthy();
    });

    test('has documentSymbolProvider', () => {
      expect(serverCapabilities.documentSymbolProvider).toBeTruthy();
    });
  });

  describe('Signature & Completion Helpers', () => {
    test('has signatureHelpProvider', () => {
      expect(serverCapabilities.signatureHelpProvider).toBeDefined();
    });

    test('signatureHelpProvider has trigger characters', () => {
      const provider = serverCapabilities.signatureHelpProvider as { triggerCharacters?: string[] };
      expect(provider.triggerCharacters).toBeDefined();
      expect(provider.triggerCharacters).toContain('(');
      expect(provider.triggerCharacters).toContain(',');
    });

    test('has inlayHintProvider', () => {
      expect(serverCapabilities.inlayHintProvider).toBeTruthy();
    });
  });

  describe('Navigation Providers', () => {
    test('has typeDefinitionProvider', () => {
      expect(serverCapabilities.typeDefinitionProvider).toBeTruthy();
    });

    test('has implementationProvider', () => {
      expect(serverCapabilities.implementationProvider).toBeTruthy();
    });

    test('has callHierarchyProvider', () => {
      expect(serverCapabilities.callHierarchyProvider).toBeTruthy();
    });

    test('has typeHierarchyProvider', () => {
      expect(serverCapabilities.typeHierarchyProvider).toBeTruthy();
    });

    test('has workspaceSymbolProvider', () => {
      expect(serverCapabilities.workspaceSymbolProvider).toBeTruthy();
    });

    test('has selectionRangeProvider', () => {
      expect(serverCapabilities.selectionRangeProvider).toBeTruthy();
    });
  });

  describe('Code Intelligence Providers', () => {
    test('has codeActionProvider with expected kinds', () => {
      expect(serverCapabilities.codeActionProvider).toBeDefined();
      const provider = serverCapabilities.codeActionProvider as { codeActionKinds?: string[] };
      expect(provider.codeActionKinds).toBeDefined();
      expect(provider.codeActionKinds).toContain('quickfix');
      expect(provider.codeActionKinds).toContain('refactor');
      expect(provider.codeActionKinds).toContain('refactor.extract');
      expect(provider.codeActionKinds).toContain('refactor.rewrite');
      expect(provider.codeActionKinds).toContain('source');
    });

    test('has codeLensProvider with resolveProvider', () => {
      expect(serverCapabilities.codeLensProvider).toBeDefined();
      const provider = serverCapabilities.codeLensProvider as { resolveProvider?: boolean };
      expect(provider.resolveProvider).toBe(true);
    });

    test('has colorProvider', () => {
      expect(serverCapabilities.colorProvider).toBeTruthy();
    });

    test('has documentHighlightProvider', () => {
      expect(serverCapabilities.documentHighlightProvider).toBeTruthy();
    });

    test('has linkedEditingRangeProvider', () => {
      expect(serverCapabilities.linkedEditingRangeProvider).toBeTruthy();
    });

    test('has documentLinkProvider', () => {
      expect(serverCapabilities.documentLinkProvider).toBeDefined();
    });

    test('has foldingRangeProvider', () => {
      expect(serverCapabilities.foldingRangeProvider).toBeTruthy();
    });
  });

  describe('Formatting Providers', () => {
    test('has documentRangeFormattingProvider', () => {
      expect(serverCapabilities.documentRangeFormattingProvider).toBeTruthy();
    });

    test('has documentOnTypeFormattingProvider', () => {
      expect(serverCapabilities.documentOnTypeFormattingProvider).toBeDefined();
      const provider = serverCapabilities.documentOnTypeFormattingProvider as {
        firstTriggerCharacter?: string;
      };
      expect(provider.firstTriggerCharacter).toBe('\n');
    });
  });

  describe('Semantic Tokens', () => {
    test('has semanticTokensProvider', () => {
      expect(serverCapabilities.semanticTokensProvider).toBeDefined();
    });

    test('semanticTokensProvider supports full tokens', () => {
      const provider = serverCapabilities.semanticTokensProvider as { full?: boolean };
      expect(provider.full).toBe(true);
    });

    test('semanticTokensProvider supports range queries', () => {
      const provider = serverCapabilities.semanticTokensProvider as { range?: boolean };
      expect(provider.range).toBe(true);
    });

    test('semanticTokensProvider has legend with token types and modifiers', () => {
      const provider = serverCapabilities.semanticTokensProvider as {
        legend?: { tokenTypes?: string[]; tokenModifiers?: string[] };
      };
      expect(provider.legend).toBeDefined();
      expect(provider.legend?.tokenTypes?.length).toBeGreaterThan(0);
      expect(provider.legend?.tokenModifiers?.length).toBeGreaterThan(0);
    });
  });

  describe('Text Sync', () => {
    test('has textDocumentSync set to incremental', () => {
      expect(serverCapabilities.textDocumentSync).toBe(2);
    });
  });
});
