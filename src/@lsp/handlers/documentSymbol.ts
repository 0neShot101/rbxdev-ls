/**
 * Document Symbol Handler
 * Provides outline view of functions, variables, and types in a file
 */

import { SymbolKind } from 'vscode-languageserver';

import type { DocumentManager } from '../documents';
import type { Chunk, FunctionExpression, Statement } from '@parser/ast';
import type { Connection, DocumentSymbol, DocumentSymbolParams } from 'vscode-languageserver';

/**
 * Converts an AST range (1-indexed) to an LSP range (0-indexed).
 * @param range - The AST range with start and end positions containing line and column
 * @returns An LSP-compatible range object with zero-indexed line and character values
 */
const convertRange = (range: { start: { line: number; column: number }; end: { line: number; column: number } }) => ({
  'start': { 'line': range.start.line - 1, 'character': range.start.column - 1 },
  'end': { 'line': range.end.line - 1, 'character': range.end.column - 1 },
});

const posBefore = (a: { line: number; character: number }, b: { line: number; character: number }): boolean =>
  a.line < b.line || (a.line === b.line && a.character < b.character);

const posAfter = (a: { line: number; character: number }, b: { line: number; character: number }): boolean =>
  a.line > b.line || (a.line === b.line && a.character > b.character);

const ensureContained = (
  selection: ReturnType<typeof convertRange>,
  full: ReturnType<typeof convertRange>,
): ReturnType<typeof convertRange> => {
  if (posBefore(selection.start, full.start) || posAfter(selection.end, full.end)) return full;
  return selection;
};

/**
 * Extracts document symbols from a function body, including parameters
 * and nested declarations.
 * @param func - The function expression AST node to extract symbols from
 * @returns An array of DocumentSymbol objects representing the function's internal symbols
 */
const collectFunctionSymbols = (func: FunctionExpression): DocumentSymbol[] => {
  const symbols: DocumentSymbol[] = [];

  // Add parameters as symbols
  for (const param of func.params) {
    if (param.name !== undefined) {
      const paramFull = convertRange(param.range);
      symbols.push({
        'name': param.name.name,
        'kind': SymbolKind.Variable,
        'range': paramFull,
        'selectionRange': ensureContained(convertRange(param.name.range), paramFull),
      });
    }
  }

  // Collect symbols from function body
  for (const stmt of func.body) {
    const stmtSymbols = collectStatementSymbols(stmt);
    symbols.push(...stmtSymbols);
  }

  return symbols;
};

/**
 * Extracts document symbols from a statement, handling various statement types
 * including local declarations, functions, type aliases, and control flow statements.
 * @param stmt - The statement AST node to extract symbols from
 * @returns An array of DocumentSymbol objects representing symbols declared in the statement
 */
const collectStatementSymbols = (stmt: Statement): DocumentSymbol[] => {
  const symbols: DocumentSymbol[] = [];

  switch (stmt.kind) {
    case 'LocalDeclaration': {
      for (let i = 0; i < stmt.names.length; i++) {
        const name = stmt.names[i];
        if (name === undefined) continue;

        // Check if the value is a function to determine kind
        const value = stmt.values[i];
        const isFunction = value?.kind === 'FunctionExpression';

        const declFull = convertRange(stmt.range);
        const symbol: DocumentSymbol = {
          'name': name.name,
          'kind': isFunction ? SymbolKind.Function : SymbolKind.Variable,
          'range': declFull,
          'selectionRange': ensureContained(convertRange(name.range), declFull),
        };

        // If it's a function, add nested symbols
        if (isFunction && value !== undefined) {
          symbol.children = collectFunctionSymbols(value as FunctionExpression);
        }

        symbols.push(symbol);
      }
      break;
    }

    case 'LocalFunction': {
      const funcFull = convertRange(stmt.range);
      const symbol: DocumentSymbol = {
        'name': stmt.name.name,
        'kind': SymbolKind.Function,
        'range': funcFull,
        'selectionRange': ensureContained(convertRange(stmt.name.range), funcFull),
        'children': collectFunctionSymbols(stmt.func),
      };
      symbols.push(symbol);
      break;
    }

    case 'FunctionDeclaration': {
      // Build full function name (e.g., "Module.foo" or "Module:method")
      let fullName = stmt.name.base.name;
      for (const part of stmt.name.path) {
        fullName += '.' + part.name;
      }
      if (stmt.name.method !== undefined) {
        fullName += ':' + stmt.name.method.name;
      }

      const funcDeclFull = convertRange(stmt.range);
      const symbol: DocumentSymbol = {
        'name': fullName,
        'kind': stmt.name.method !== undefined ? SymbolKind.Method : SymbolKind.Function,
        'range': funcDeclFull,
        'selectionRange': ensureContained(convertRange(stmt.name.base.range), funcDeclFull),
        'children': collectFunctionSymbols(stmt.func),
      };
      symbols.push(symbol);
      break;
    }

    case 'TypeAlias': {
      const typeFull = convertRange(stmt.range);
      const symbol: DocumentSymbol = {
        'name': stmt.name.name,
        'kind': SymbolKind.TypeParameter,
        'range': typeFull,
        'selectionRange': ensureContained(convertRange(stmt.name.range), typeFull),
      };
      symbols.push(symbol);
      break;
    }

    case 'ExportStatement': {
      // Export wraps a TypeAlias
      const innerSymbols = collectStatementSymbols(stmt.declaration);
      for (const innerSymbol of innerSymbols) {
        innerSymbol.name = `export ${innerSymbol.name}`;
      }
      symbols.push(...innerSymbols);
      break;
    }

    case 'IfStatement': {
      // Collect symbols from if body and branches
      for (const s of stmt.thenBody) {
        symbols.push(...collectStatementSymbols(s));
      }
      for (const clause of stmt.elseifClauses) {
        for (const s of clause.body) {
          symbols.push(...collectStatementSymbols(s));
        }
      }
      if (stmt.elseBody !== undefined) {
        for (const s of stmt.elseBody) {
          symbols.push(...collectStatementSymbols(s));
        }
      }
      break;
    }

    case 'WhileStatement':
    case 'RepeatStatement':
    case 'DoStatement': {
      for (const s of stmt.body) {
        symbols.push(...collectStatementSymbols(s));
      }
      break;
    }

    case 'ForNumeric': {
      // Add loop variable
      symbols.push({
        'name': stmt.variable.name,
        'kind': SymbolKind.Variable,
        'range': convertRange(stmt.variable.range),
        'selectionRange': convertRange(stmt.variable.range),
      });
      for (const s of stmt.body) {
        symbols.push(...collectStatementSymbols(s));
      }
      break;
    }

    case 'ForGeneric': {
      // Add loop variables
      for (const v of stmt.variables) {
        symbols.push({
          'name': v.name,
          'kind': SymbolKind.Variable,
          'range': convertRange(v.range),
          'selectionRange': convertRange(v.range),
        });
      }
      for (const s of stmt.body) {
        symbols.push(...collectStatementSymbols(s));
      }
      break;
    }
  }

  return symbols;
};

/**
 * Collects all top-level document symbols from a chunk for the outline view.
 * Only includes declarations, functions, type aliases, and exports.
 * @param chunk - The root AST node of the parsed document
 * @returns An array of DocumentSymbol objects representing top-level symbols
 */
const collectDocumentSymbols = (chunk: Chunk): DocumentSymbol[] => {
  const symbols: DocumentSymbol[] = [];

  for (const stmt of chunk.body) {
    // Only include top-level declarations in the main outline
    switch (stmt.kind) {
      case 'LocalDeclaration':
      case 'LocalFunction':
      case 'FunctionDeclaration':
      case 'TypeAlias':
      case 'ExportStatement':
        symbols.push(...collectStatementSymbols(stmt));
        break;
    }
  }

  return symbols;
};

/**
 * Registers the document symbol handler with the LSP connection.
 * Provides the outline view showing functions, variables, types, and
 * other declarations in the document.
 * @param connection - The LSP connection to register the handler on
 * @param documentManager - The document manager for accessing parsed documents
 * @returns void
 */
export const setupDocumentSymbolHandler = (connection: Connection, documentManager: DocumentManager): void => {
  connection.onDocumentSymbol((params: DocumentSymbolParams): DocumentSymbol[] => {
    const document = documentManager.getDocument(params.textDocument.uri);
    if (document === undefined || document.ast === undefined) return [];

    return collectDocumentSymbols(document.ast);
  });
};
