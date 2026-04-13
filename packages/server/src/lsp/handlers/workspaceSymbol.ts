import * as url from 'url';

import { SymbolKind } from 'vscode-languageserver';

import type { Chunk, Statement } from '@typings/ast';
import type { DocumentManager } from '@typings/lsp';
import type { ModuleExport } from '@typings/workspace';
import type { Connection, SymbolInformation, WorkspaceSymbolParams } from 'vscode-languageserver';

const EXPORT_KIND_MAP: ReadonlyMap<string, SymbolKind> = new Map([
  ['function', SymbolKind.Function],
  ['table', SymbolKind.Object],
  ['value', SymbolKind.Variable],
  ['type', SymbolKind.TypeParameter],
]);

const convertRange = (range: { start: { line: number; column: number }; end: { line: number; column: number } }) => ({
  'start': { 'line': range.start.line - 1, 'character': range.start.column - 1 },
  'end': { 'line': range.end.line - 1, 'character': range.end.column - 1 },
});

const zeroRange = () => ({
  'start': { 'line': 0, 'character': 0 },
  'end': { 'line': 0, 'character': 0 },
});

const exportToSymbol = (exp: ModuleExport): SymbolInformation => ({
  'name': exp.name,
  'kind': EXPORT_KIND_MAP.get(exp.kind) ?? SymbolKind.Variable,
  'location': {
    'uri': url.pathToFileURL(exp.filePath).toString(),
    'range': zeroRange(),
  },
  'containerName': exp.modulePath,
});

const collectStatementSymbols = (
  stmt: Statement,
  uri: string,
  containerName: string | undefined,
  symbols: SymbolInformation[],
): void => {
  switch (stmt.kind) {
    case 'LocalDeclaration':
      for (let i = 0; i < stmt.names.length; i++) {
        const name = stmt.names[i];
        if (name === undefined) continue;

        const value = stmt.values[i];
        const isFunction = value?.kind === 'FunctionExpression';

        const sym: SymbolInformation = {
          'name': name.name,
          'kind': isFunction ? SymbolKind.Function : SymbolKind.Variable,
          'location': { uri, 'range': convertRange(name.range) },
        };
        if (containerName !== undefined) sym.containerName = containerName;
        symbols.push(sym);
      }
      break;

    case 'LocalFunction': {
      const sym: SymbolInformation = {
        'name': stmt.name.name,
        'kind': SymbolKind.Function,
        'location': { uri, 'range': convertRange(stmt.name.range) },
      };
      if (containerName !== undefined) sym.containerName = containerName;
      symbols.push(sym);
      break;
    }

    case 'FunctionDeclaration': {
      let fullName = stmt.name.base.name;
      for (const part of stmt.name.path) fullName += '.' + part.name;
      if (stmt.name.method !== undefined) fullName += ':' + stmt.name.method.name;

      const sym: SymbolInformation = {
        'name': fullName,
        'kind': stmt.name.method !== undefined ? SymbolKind.Method : SymbolKind.Function,
        'location': { uri, 'range': convertRange(stmt.name.base.range) },
      };
      if (containerName !== undefined) sym.containerName = containerName;
      symbols.push(sym);
      break;
    }

    case 'TypeAlias': {
      const sym: SymbolInformation = {
        'name': stmt.name.name,
        'kind': SymbolKind.TypeParameter,
        'location': { uri, 'range': convertRange(stmt.name.range) },
      };
      if (containerName !== undefined) sym.containerName = containerName;
      symbols.push(sym);
      break;
    }

    case 'ExportStatement':
      collectStatementSymbols(stmt.declaration, uri, containerName, symbols);
      break;

    case 'IfStatement':
      for (const s of stmt.thenBody) collectStatementSymbols(s, uri, containerName, symbols);
      for (const clause of stmt.elseifClauses) {
        for (const s of clause.body) collectStatementSymbols(s, uri, containerName, symbols);
      }
      if (stmt.elseBody !== undefined) {
        for (const s of stmt.elseBody) collectStatementSymbols(s, uri, containerName, symbols);
      }
      break;

    case 'WhileStatement':
    case 'RepeatStatement':
    case 'DoStatement':
      for (const s of stmt.body) collectStatementSymbols(s, uri, containerName, symbols);
      break;

    case 'ForNumeric':
      for (const s of stmt.body) collectStatementSymbols(s, uri, containerName, symbols);
      break;

    case 'ForGeneric':
      for (const s of stmt.body) collectStatementSymbols(s, uri, containerName, symbols);
      break;
  }
};

/**
 * Collects top-level symbols from the AST for workspace-wide symbol search.
 * @param chunk - The parsed AST chunk to scan.
 * @param uri - The document URI for location references.
 * @returns An array of LSP SymbolInformation objects.
 */
export const collectWorkspaceSymbols = (chunk: Chunk, uri: string): SymbolInformation[] => {
  const symbols: SymbolInformation[] = [];
  for (const stmt of chunk.body) collectStatementSymbols(stmt, uri, undefined, symbols);
  return symbols;
};

/** Provides workspace-wide symbol search across all indexed modules and open documents. */
export const setupWorkspaceSymbolHandler = (connection: Connection, documentManager: DocumentManager): void => {
  connection.onWorkspaceSymbol((params: WorkspaceSymbolParams): SymbolInformation[] => {
    const query = params.query.toLowerCase();
    const results: SymbolInformation[] = [];
    const seen = new Set<string>();

    for (const [, doc] of documentManager.documents) {
      if (doc.ast === undefined) continue;
      seen.add(doc.uri);

      const symbols = collectWorkspaceSymbols(doc.ast, doc.uri);
      for (const symbol of symbols) {
        if (query.length === 0 || symbol.name.toLowerCase().includes(query)) results.push(symbol);
      }
    }

    const moduleIndex = documentManager.getModuleIndex();
    for (const [, moduleInfo] of moduleIndex) {
      const fileUri = url.pathToFileURL(moduleInfo.filePath).toString();
      if (seen.has(fileUri)) continue;

      for (const exp of moduleInfo.exports) {
        if (query.length === 0 || exp.name.toLowerCase().includes(query)) results.push(exportToSymbol(exp));
      }
    }

    return results;
  });
};
