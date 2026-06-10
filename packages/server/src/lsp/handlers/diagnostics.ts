import { DiagnosticSeverity, DiagnosticTag } from 'vscode-languageserver';

import type { LiveGameModel } from '@typings/bridge';
import type { TypeDiagnostic } from '@typings/checker';
import type { DocumentManager, ParsedDocument } from '@typings/lsp';
import type { Connection, Diagnostic as LspDiagnostic, TextDocuments } from 'vscode-languageserver';
import type { TextDocument } from 'vscode-languageserver-textdocument';

const severityMap: Record<TypeDiagnostic['severity'], DiagnosticSeverity> = {
  'error': DiagnosticSeverity.Error,
  'warning': DiagnosticSeverity.Warning,
  'info': DiagnosticSeverity.Information,
  'hint': DiagnosticSeverity.Hint,
};

const convertTags = (tags: TypeDiagnostic['tags']): DiagnosticTag[] | undefined => {
  if (tags === undefined || tags.length === 0) return undefined;
  const lspTags: DiagnosticTag[] = [];
  for (const tag of tags) {
    if (tag === 'deprecated') lspTags.push(DiagnosticTag.Deprecated);
    if (tag === 'unnecessary') lspTags.push(DiagnosticTag.Unnecessary);
  }
  return lspTags.length > 0 ? lspTags : undefined;
};

const findChildInTree = (
  node: { name: string; children?: ReadonlyArray<{ name: string; children?: ReadonlyArray<unknown> }> },
  name: string,
): boolean => {
  if (node.children === undefined) return false;
  for (const child of node.children) {
    if (child.name === name) return true;
    const typedChild = child as {
      name: string;
      children?: ReadonlyArray<{ name: string; children?: ReadonlyArray<unknown> }>;
    };
    if (findChildInTree(typedChild, name)) return true;
  }
  return false;
};

const existsInLiveGameTree = (propertyName: string, liveGameModel: LiveGameModel): boolean => {
  if (liveGameModel.isConnected === false) return false;
  if (liveGameModel.services.size === 0) return false;

  for (const [, service] of liveGameModel.services) {
    if (service.children !== undefined)
      for (const child of service.children) if (child.name === propertyName) return true;
    if (findChildInTree(service, propertyName)) return true;
  }

  return false;
};

/**
 * Converts an internal type diagnostic to an LSP diagnostic with severity and range mapping.
 * @param diag - The internal type diagnostic to convert.
 * @returns An LSP-compatible diagnostic object.
 */
export const convertDiagnostic = (diag: TypeDiagnostic): LspDiagnostic => {
  const tags = convertTags(diag.tags);

  return {
    'range': {
      'start': {
        'line': diag.range.start.line - 1,
        'character': diag.range.start.column - 1,
      },
      'end': {
        'line': diag.range.end.line - 1,
        'character': diag.range.end.column - 1,
      },
    },
    'severity': severityMap[diag.severity],
    'code': diag.code,
    'source': 'rbxdev-ls',
    'message': diag.message,
    ...(tags !== undefined ? { 'tags': tags } : {}),
  };
};

/** Publishes diagnostics for a parsed document to the LSP client. */
export const publishDiagnostics = (
  connection: Connection,
  parsed: ParsedDocument,
  liveGameModel?: LiveGameModel,
): void => {
  const allDiagnostics = [...parsed.parseErrors, ...parsed.typeErrors];

  connection.console.log(
    `[diag v5] Publishing ${allDiagnostics.length} diagnostics, liveGameModel connected: ${liveGameModel?.isConnected}, services: ${liveGameModel?.services.size}`,
  );

  const filteredDiagnostics: TypeDiagnostic[] = [];
  for (let i = 0; i < allDiagnostics.length; i++) {
    const diag = allDiagnostics[i];
    if (diag === undefined) continue;

    connection.console.log(`[diag v5] #${i}: ${diag.message}`);

    const propertyMatch = diag.message.match(/property '(\w+)' not found/i);
    if (propertyMatch === null) {
      filteredDiagnostics.push(diag);
      continue;
    }

    const propertyName = propertyMatch[1];
    if (propertyName === undefined) {
      filteredDiagnostics.push(diag);
      continue;
    }

    connection.console.log(`[diag v5] Checking '${propertyName}' in live game tree`);

    if (liveGameModel !== undefined && existsInLiveGameTree(propertyName, liveGameModel)) {
      connection.console.log(`[diag v5] SUPPRESSING '${propertyName}'`);
      continue;
    }

    connection.console.log(`[diag v5] KEEPING '${propertyName}'`);
    filteredDiagnostics.push(diag);
  }

  connection.console.log(`[diag v5] Result: ${filteredDiagnostics.length} diagnostics after filter`);

  const lspDiagnostics = filteredDiagnostics.map(convertDiagnostic);

  connection.sendDiagnostics({
    'uri': parsed.uri,
    'diagnostics': lspDiagnostics,
  });
};

/** Clears all diagnostics for a document. */
export const clearDiagnostics = (connection: Connection, uri: string): void => {
  connection.sendDiagnostics({
    uri,
    'diagnostics': [],
  });
};

const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const DEBOUNCE_DELAY = 150;

/** Sets up the diagnostics handler for document events. */
export const setupDiagnosticsHandler = (
  connection: Connection,
  documents: TextDocuments<TextDocument>,
  documentManager: DocumentManager,
  liveGameModel?: LiveGameModel,
): void => {
  documents.onDidOpen(event => {
    setImmediate(() => {
      const parsed = documentManager.parseDocument(event.document);
      publishDiagnostics(connection, parsed, liveGameModel);
    });
  });

  documents.onDidChangeContent(change => {
    const uri = change.document.uri;

    const existingTimer = debounceTimers.get(uri);
    if (existingTimer !== undefined) clearTimeout(existingTimer);

    const timer = setTimeout(() => {
      debounceTimers.delete(uri);
      const doc = documents.get(uri);
      if (doc !== undefined) {
        const parsed = documentManager.parseDocument(doc);
        publishDiagnostics(connection, parsed, liveGameModel);
      }
    }, DEBOUNCE_DELAY);

    debounceTimers.set(uri, timer);
  });

  documents.onDidClose(event => {
    const timer = debounceTimers.get(event.document.uri);
    if (timer !== undefined) {
      clearTimeout(timer);
      debounceTimers.delete(event.document.uri);
    }

    clearDiagnostics(connection, event.document.uri);
    documentManager.removeDocument(event.document.uri);
  });
};
