import { SymbolKind } from 'vscode-languageserver';

import type { DocumentManager } from '@typings/lsp';
import type { Chunk, FunctionExpression, Statement } from '@typings/ast';
import type { Connection, DocumentSymbol, DocumentSymbolParams } from 'vscode-languageserver';

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

const pushSymbol = (symbols: DocumentSymbol[], symbol: DocumentSymbol): void => {
  if (symbol.name === '') return;
  symbols.push(symbol);
};

const collectFunctionSymbols = (func: FunctionExpression): DocumentSymbol[] => {
  const symbols: DocumentSymbol[] = [];

  for (const param of func.params) {
    if (param.name !== undefined) {
      const paramFull = convertRange(param.range);
      pushSymbol(symbols, {
        'name': param.name.name,
        'kind': SymbolKind.Variable,
        'range': paramFull,
        'selectionRange': ensureContained(convertRange(param.name.range), paramFull),
      });
    }
  }

  for (const stmt of func.body) {
    const stmtSymbols = collectStatementSymbols(stmt);
    symbols.push(...stmtSymbols);
  }

  return symbols;
};

const collectStatementSymbols = (stmt: Statement): DocumentSymbol[] => {
  const symbols: DocumentSymbol[] = [];

  switch (stmt.kind) {
    case 'LocalDeclaration': {
      for (let i = 0; i < stmt.names.length; i++) {
        const name = stmt.names[i];
        if (name === undefined) continue;

        const value = stmt.values[i];
        const isFunction = value?.kind === 'FunctionExpression';

        const declFull = convertRange(stmt.range);
        const symbol: DocumentSymbol = {
          'name': name.name,
          'kind': isFunction ? SymbolKind.Function : SymbolKind.Variable,
          'range': declFull,
          'selectionRange': ensureContained(convertRange(name.range), declFull),
        };

        if (isFunction && value !== undefined) {
          symbol.children = collectFunctionSymbols(value as FunctionExpression);
        }

        pushSymbol(symbols, symbol);
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
      pushSymbol(symbols, symbol);
      break;
    }

    case 'FunctionDeclaration': {
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
      pushSymbol(symbols, symbol);
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
      pushSymbol(symbols, symbol);
      break;
    }

    case 'ExportStatement': {
      const innerSymbols = collectStatementSymbols(stmt.declaration);
      for (const innerSymbol of innerSymbols) {
        innerSymbol.name = `export ${innerSymbol.name}`;
      }
      symbols.push(...innerSymbols);
      break;
    }

    case 'IfStatement': {
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
      pushSymbol(symbols, {
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
      for (const v of stmt.variables) {
        pushSymbol(symbols, {
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
 * Collects document symbols (functions, variables, types) from the AST for the outline view.
 * @param chunk - The parsed AST chunk to scan.
 * @returns An array of LSP DocumentSymbol objects representing the document structure.
 */
export const collectDocumentSymbols = (chunk: Chunk): DocumentSymbol[] => {
  const symbols: DocumentSymbol[] = [];

  for (const stmt of chunk.body) {
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

/** Provides the outline view showing functions, variables, types, and other declarations. */
export const setupDocumentSymbolHandler = (connection: Connection, documentManager: DocumentManager): void => {
  connection.onDocumentSymbol((params: DocumentSymbolParams): DocumentSymbol[] => {
    const document = documentManager.getDocument(params.textDocument.uri);
    if (document === undefined || document.ast === undefined) return [];

    return collectDocumentSymbols(document.ast);
  });
};
