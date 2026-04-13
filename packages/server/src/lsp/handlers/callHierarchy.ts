import { walk } from '@parser/visitor';
import { positionInRange } from '@utils/position';
import { SymbolKind } from 'vscode-languageserver';

import type {
  CallExpression,
  Chunk,
  Expression,
  FunctionExpression,
  Identifier,
  MethodCallExpression,
  Statement,
} from '@typings/ast';
import type { CallHierarchyFunctionInfo, CallSite } from '@typings/handlers';
import type { DocumentManager } from '@typings/lsp';
import type {
  CallHierarchyIncomingCall,
  CallHierarchyIncomingCallsParams,
  CallHierarchyItem,
  CallHierarchyOutgoingCall,
  CallHierarchyOutgoingCallsParams,
  CallHierarchyPrepareParams,
  Connection,
  Range,
} from 'vscode-languageserver';

const convertRange = (range: {
  start: { line: number; column: number };
  end: { line: number; column: number };
}): Range => ({
  'start': { 'line': range.start.line - 1, 'character': range.start.column - 1 },
  'end': { 'line': range.end.line - 1, 'character': range.end.column - 1 },
});

const getCalleeName = (expr: Expression): string | undefined => {
  if (expr.kind === 'Identifier') return expr.name;
  if (expr.kind === 'MemberExpression') return expr.property.name;
  return undefined;
};

/**
 * Collects all named function declarations from the top-level statements for call hierarchy.
 * @param statements - The top-level statements to scan.
 * @returns An array of function info objects with name, range, and parameter details.
 */
export const collectCallHierarchyFunctions = (statements: ReadonlyArray<Statement>): CallHierarchyFunctionInfo[] => {
  const functions: CallHierarchyFunctionInfo[] = [];

  const addFunc = (
    name: string,
    kind: SymbolKind,
    stmt: Statement,
    nameNode: Identifier,
    func: FunctionExpression,
  ): void => {
    functions.push({
      name,
      kind,
      'range': convertRange(stmt.range),
      'selectionRange': convertRange(nameNode.range),
      'bodyStatements': func.body,
    });
  };

  const walkStatements = (stmts: ReadonlyArray<Statement>): void => {
    for (const stmt of stmts) {
      switch (stmt.kind) {
        case 'LocalFunction':
          addFunc(stmt.name.name, SymbolKind.Function, stmt, stmt.name, stmt.func);
          break;

        case 'FunctionDeclaration': {
          let fullName = stmt.name.base.name;
          for (const part of stmt.name.path) fullName += '.' + part.name;
          if (stmt.name.method !== undefined) fullName += ':' + stmt.name.method.name;
          const kind = stmt.name.method !== undefined ? SymbolKind.Method : SymbolKind.Function;
          addFunc(fullName, kind, stmt, stmt.name.base, stmt.func);
          break;
        }

        case 'LocalDeclaration':
          for (let i = 0; i < stmt.names.length; i++) {
            const name = stmt.names[i];
            const value = stmt.values[i];
            if (name === undefined || value === undefined || value.kind !== 'FunctionExpression') continue;
            addFunc(name.name, SymbolKind.Function, stmt, name, value);
          }
          break;

        case 'IfStatement':
          walkStatements(stmt.thenBody);
          for (const clause of stmt.elseifClauses) walkStatements(clause.body);
          if (stmt.elseBody !== undefined) walkStatements(stmt.elseBody);
          break;

        case 'WhileStatement':
        case 'RepeatStatement':
        case 'DoStatement':
          walkStatements(stmt.body);
          break;

        case 'ForNumeric':
        case 'ForGeneric':
          walkStatements(stmt.body);
          break;

        case 'ExportStatement':
          walkStatements([stmt.declaration]);
          break;
      }
    }
  };

  walkStatements(statements);
  return functions;
};

/**
 * Collects all function call sites in the AST, tagged with the containing function name.
 * @param chunk - The parsed AST chunk to scan.
 * @returns An array of call sites with caller and callee information.
 */
export const collectCallSites = (
  chunk: Chunk,
): Array<CallSite & { readonly containingFunction: string | undefined }> => {
  const functions = collectCallHierarchyFunctions(chunk.body);
  const sites: Array<CallSite & { readonly containingFunction: string | undefined }> = [];

  const findContainingFunction = (line: number): string | undefined => {
    for (const func of functions) {
      if (line >= func.range.start.line && line <= func.range.end.line) return func.name;
    }
    return undefined;
  };

  walk(chunk, {
    'visitCallExpression': (node: CallExpression) => {
      const name = getCalleeName(node.callee);
      if (name === undefined) return;

      const range = convertRange(node.range);
      const containing = findContainingFunction(range.start.line);
      sites.push({ name, range, 'containingFunction': containing });
    },
    'visitMethodCallExpression': (node: MethodCallExpression) => {
      const range = convertRange(node.range);
      const containing = findContainingFunction(range.start.line);
      sites.push({ 'name': node.method.name, range, 'containingFunction': containing });
    },
  });

  return sites;
};

const functionToItem = (func: CallHierarchyFunctionInfo, uri: string): CallHierarchyItem => ({
  'name': func.name,
  'kind': func.kind,
  uri,
  'range': func.range,
  'selectionRange': func.selectionRange,
  'data': { 'name': func.name, uri },
});

/** Provides call hierarchy support for navigating function call relationships. */
export const setupCallHierarchyHandler = (connection: Connection, documentManager: DocumentManager): void => {
  connection.languages.callHierarchy.onPrepare((params: CallHierarchyPrepareParams): CallHierarchyItem[] | null => {
    const document = documentManager.getDocument(params.textDocument.uri);
    if (document === undefined || document.ast === undefined) return null;

    const functions = collectCallHierarchyFunctions(document.ast.body);
    const pos = { 'line': params.position.line, 'character': params.position.character };

    for (const func of functions) {
      if (positionInRange(pos, func.range)) return [functionToItem(func, params.textDocument.uri)];
    }

    return null;
  });

  connection.languages.callHierarchy.onIncomingCalls(
    (params: CallHierarchyIncomingCallsParams): CallHierarchyIncomingCall[] => {
      const data = params.item.data as { name: string; uri: string } | undefined;
      if (data === undefined) return [];

      const document = documentManager.getDocument(data.uri);
      if (document === undefined || document.ast === undefined) return [];

      const targetName = data.name;
      const functions = collectCallHierarchyFunctions(document.ast.body);
      const sites = collectCallSites(document.ast);

      const grouped = new Map<string, Range[]>();
      for (const site of sites) {
        if (site.name !== targetName) continue;
        const container = site.containingFunction ?? '<module>';
        const ranges = grouped.get(container) ?? [];
        ranges.push(site.range);
        grouped.set(container, ranges);
      }

      const results: CallHierarchyIncomingCall[] = [];
      for (const [containerName, ranges] of grouped) {
        const callerFunc = functions.find(f => f.name === containerName);
        if (callerFunc !== undefined) {
          results.push({
            'from': functionToItem(callerFunc, data.uri),
            'fromRanges': ranges,
          });
        } else if (containerName === '<module>') {
          results.push({
            'from': {
              'name': '<module>',
              'kind': SymbolKind.Module,
              'uri': data.uri,
              'range': { 'start': { 'line': 0, 'character': 0 }, 'end': { 'line': 0, 'character': 0 } },
              'selectionRange': { 'start': { 'line': 0, 'character': 0 }, 'end': { 'line': 0, 'character': 0 } },
            },
            'fromRanges': ranges,
          });
        }
      }

      return results;
    },
  );

  connection.languages.callHierarchy.onOutgoingCalls(
    (params: CallHierarchyOutgoingCallsParams): CallHierarchyOutgoingCall[] => {
      const data = params.item.data as { name: string; uri: string } | undefined;
      if (data === undefined) return [];

      const document = documentManager.getDocument(data.uri);
      if (document === undefined || document.ast === undefined) return [];

      const functions = collectCallHierarchyFunctions(document.ast.body);
      const targetFunc = functions.find(f => f.name === data.name);
      if (targetFunc === undefined) return [];

      const callSites = new Map<string, Range[]>();

      const collectFromBody = (stmts: ReadonlyArray<Statement>): void => {
        const fakeChunk: Chunk = {
          'kind': 'Chunk',
          'body': stmts as Statement[],
          'comments': [],
          'range': {
            'start': { 'line': targetFunc.range.start.line, 'column': targetFunc.range.start.character, 'offset': 0 },
            'end': { 'line': targetFunc.range.end.line, 'column': targetFunc.range.end.character, 'offset': 0 },
          },
        };

        walk(fakeChunk, {
          'visitCallExpression': (node: CallExpression) => {
            const name = getCalleeName(node.callee);
            if (name === undefined) return;
            const ranges = callSites.get(name) ?? [];
            ranges.push(convertRange(node.range));
            callSites.set(name, ranges);
          },
          'visitMethodCallExpression': (node: MethodCallExpression) => {
            const ranges = callSites.get(node.method.name) ?? [];
            ranges.push(convertRange(node.range));
            callSites.set(node.method.name, ranges);
          },
        });
      };

      collectFromBody(targetFunc.bodyStatements);

      const results: CallHierarchyOutgoingCall[] = [];
      for (const [calledName, ranges] of callSites) {
        const calledFunc = functions.find(f => f.name === calledName);
        if (calledFunc !== undefined) {
          results.push({
            'to': functionToItem(calledFunc, data.uri),
            'fromRanges': ranges,
          });
        } else {
          results.push({
            'to': {
              'name': calledName,
              'kind': SymbolKind.Function,
              'uri': data.uri,
              'range': { 'start': { 'line': 0, 'character': 0 }, 'end': { 'line': 0, 'character': 0 } },
              'selectionRange': { 'start': { 'line': 0, 'character': 0 }, 'end': { 'line': 0, 'character': 0 } },
            },
            'fromRanges': ranges,
          });
        }
      }

      return results;
    },
  );
};
