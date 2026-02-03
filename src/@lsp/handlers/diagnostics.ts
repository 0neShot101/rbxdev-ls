/**
 * Diagnostics Handler
 * Converts internal diagnostics to LSP diagnostics
 */

import { DiagnosticSeverity, DiagnosticTag } from 'vscode-languageserver';

import type { LiveGameModel } from '@executor/gameTree';
import type { DocumentManager, ParsedDocument } from '@lsp/documents';
import type { TypeDiagnostic } from '@typings/checker';
import type { Connection, Diagnostic as LspDiagnostic, TextDocuments } from 'vscode-languageserver';
import type { TextDocument } from 'vscode-languageserver-textdocument';

const severityMap: Record<TypeDiagnostic['severity'], DiagnosticSeverity> = {
  'error': DiagnosticSeverity.Error,
  'warning': DiagnosticSeverity.Warning,
  'info': DiagnosticSeverity.Information,
  'hint': DiagnosticSeverity.Hint,
};

/**
 * Converts internal diagnostic tags to LSP diagnostic tags.
 * @param tags - The internal diagnostic tags array containing 'deprecated' or 'unnecessary' values
 * @returns An array of LSP DiagnosticTag values, or undefined if no valid tags exist
 */
const convertTags = (tags: TypeDiagnostic['tags']): DiagnosticTag[] | undefined => {
  if (tags === undefined || tags.length === 0) return undefined;
  const lspTags: DiagnosticTag[] = [];
  for (const tag of tags) {
    if (tag === 'deprecated') lspTags.push(DiagnosticTag.Deprecated);
    if (tag === 'unnecessary') lspTags.push(DiagnosticTag.Unnecessary);
  }
  return lspTags.length > 0 ? lspTags : undefined;
};

/**
 * Recursively searches for a child with the given name in the game tree.
 * @param node - The node to search from, containing a name and optional children array
 * @param name - The name of the child to find
 * @returns True if a child with the given name exists anywhere in the subtree, false otherwise
 */
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

/**
 * Checks if a property name exists anywhere in the live game tree.
 * @param propertyName - The property name to search for
 * @param liveGameModel - The live game model containing the tree of game instances
 * @returns True if the property name exists as a child name in any service, false otherwise
 */
const existsInLiveGameTree = (propertyName: string, liveGameModel: LiveGameModel): boolean => {
  if (liveGameModel.isConnected === false) return false;
  if (liveGameModel.services.size === 0) return false;

  for (const [, service] of liveGameModel.services) {
    // Check direct children
    if (service.children !== undefined) {
      for (const child of service.children) {
        if (child.name === propertyName) return true;
      }
    }
    // Also check recursively
    if (findChildInTree(service, propertyName)) return true;
  }

  return false;
};

/**
 * Converts an internal TypeDiagnostic to an LSP-compatible Diagnostic object.
 * Adjusts line and column numbers from 1-based to 0-based indexing.
 * @param diag - The internal diagnostic to convert
 * @returns An LSP Diagnostic object with properly formatted range, severity, code, source, message, and tags
 */
const convertDiagnostic = (diag: TypeDiagnostic): LspDiagnostic => {
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

/**
 * Publishes diagnostics for a parsed document to the LSP client.
 * Filters out "property not found" errors for properties that exist in the live game tree.
 * @param connection - The LSP connection to send diagnostics through
 * @param parsed - The parsed document containing parse errors and type errors
 * @param liveGameModel - Optional live game model to check for suppressing false positive property errors
 * @returns void
 */
export const publishDiagnostics = (
  connection: Connection,
  parsed: ParsedDocument,
  liveGameModel?: LiveGameModel,
): void => {
  const allDiagnostics = [...parsed.parseErrors, ...parsed.typeErrors];

  connection.console.log(
    `[diag v5] Publishing ${allDiagnostics.length} diagnostics, liveGameModel connected: ${liveGameModel?.isConnected}, services: ${liveGameModel?.services.size}`,
  );

  // Filter out "property not found" errors for properties that exist in the live game tree
  const filteredDiagnostics: TypeDiagnostic[] = [];
  for (let i = 0; i < allDiagnostics.length; i++) {
    const diag = allDiagnostics[i];
    if (diag === undefined) continue;

    connection.console.log(`[diag v5] #${i}: ${diag.message}`);

    // Check if this is a "property not found" error
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

    // If we have a live game model and the property exists in it, suppress the error
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

/**
 * Clears all diagnostics for a document by sending an empty diagnostics array.
 * @param connection - The LSP connection to send the clear command through
 * @param uri - The document URI to clear diagnostics for
 * @returns void
 */
export const clearDiagnostics = (connection: Connection, uri: string): void => {
  connection.sendDiagnostics({
    uri,
    'diagnostics': [],
  });
};

// Debounce timers per document
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const DEBOUNCE_DELAY = 150; // ms - wait for user to stop typing

/**
 * Sets up the diagnostics handler for document events.
 * Configures handlers for document open, content change, and close events with debouncing.
 * @param connection - The LSP connection to communicate through
 * @param documents - The TextDocuments manager tracking open documents
 * @param documentManager - The document manager for parsing and type checking
 * @param liveGameModel - Optional live game model for suppressing false positive errors
 * @returns void
 */
export const setupDiagnosticsHandler = (
  connection: Connection,
  documents: TextDocuments<TextDocument>,
  documentManager: DocumentManager,
  liveGameModel?: LiveGameModel,
): void => {
  // Parse document when first opened (async to not block editor)
  documents.onDidOpen(event => {
    setImmediate(() => {
      const parsed = documentManager.parseDocument(event.document);
      publishDiagnostics(connection, parsed, liveGameModel);
    });
  });

  documents.onDidChangeContent(change => {
    const uri = change.document.uri;

    // Clear existing timer for this document
    const existingTimer = debounceTimers.get(uri);
    if (existingTimer !== undefined) {
      clearTimeout(existingTimer);
    }

    // Set new debounced timer
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
    // Clear any pending timer
    const timer = debounceTimers.get(event.document.uri);
    if (timer !== undefined) {
      clearTimeout(timer);
      debounceTimers.delete(event.document.uri);
    }

    clearDiagnostics(connection, event.document.uri);
    documentManager.removeDocument(event.document.uri);
  });
};
