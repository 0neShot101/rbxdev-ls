import { walk } from '@parser/visitor';

import type { Chunk, FunctionExpression, Identifier, Statement } from '@typings/ast';
import type { CodeLensFunctionInfo, ReferenceLocation } from '@typings/handlers';
import type { DocumentManager } from '@typings/lsp';
import type { CodeLens, CodeLensParams, Connection, Range } from 'vscode-languageserver';

const convertRange = (range: {
  start: { line: number; column: number };
  end: { line: number; column: number };
}): Range => ({
  'start': { 'line': range.start.line - 1, 'character': range.start.column - 1 },
  'end': { 'line': range.end.line - 1, 'character': range.end.column - 1 },
});

/**
 * Collects function declarations from top-level statements for code lens display.
 * @param statements - The top-level statements to scan.
 * @returns An array of function info objects with name and selection range.
 */
export const collectCodeLensFunctions = (statements: ReadonlyArray<Statement>): CodeLensFunctionInfo[] => {
  const functions: CodeLensFunctionInfo[] = [];

  const addFunc = (name: string, nameNode: Identifier): void => {
    functions.push({ name, 'selectionRange': convertRange(nameNode.range) });
  };

  const walkStatements = (stmts: ReadonlyArray<Statement>): void => {
    for (const stmt of stmts) {
      switch (stmt.kind) {
        case 'LocalFunction':
          addFunc(stmt.name.name, stmt.name);
          walkStatements(stmt.func.body);
          break;

        case 'FunctionDeclaration': {
          let fullName = stmt.name.base.name;
          for (const part of stmt.name.path) fullName += '.' + part.name;
          if (stmt.name.method !== undefined) fullName += ':' + stmt.name.method.name;
          addFunc(fullName, stmt.name.base);
          walkStatements(stmt.func.body);
          break;
        }

        case 'LocalDeclaration':
          for (let i = 0; i < stmt.names.length; i++) {
            const name = stmt.names[i];
            const value = stmt.values[i];
            if (name === undefined || value === undefined || value.kind !== 'FunctionExpression') continue;
            addFunc(name.name, name);
            walkStatements((value as FunctionExpression).body);
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
 * Collects all identifier references in the AST grouped by name.
 * @param chunk - The parsed AST chunk to scan.
 * @returns A map from identifier name to its reference locations.
 */
export const collectCodeLensReferences = (chunk: Chunk): Map<string, ReferenceLocation[]> => {
  const references = new Map<string, ReferenceLocation[]>();

  const addReference = (ident: Identifier) => {
    const locations = references.get(ident.name) ?? [];
    locations.push({
      'line': ident.range.start.line - 1,
      'character': ident.range.start.column - 1,
      'endCharacter': ident.range.end.column - 1,
    });
    references.set(ident.name, locations);
  };

  walk(chunk, {
    'visitIdentifier': node => addReference(node),
    'visitLocalDeclaration': node => {
      for (const name of node.names) addReference(name);
    },
    'visitLocalFunction': node => addReference(node.name),
    'visitFunctionDeclaration': node => {
      addReference(node.name.base);
      for (const part of node.name.path) addReference(part);
      if (node.name.method !== undefined) addReference(node.name.method);
    },
    'visitTypeAlias': node => addReference(node.name),
    'visitForNumeric': node => addReference(node.variable),
    'visitForGeneric': node => {
      for (const v of node.variables) addReference(v);
    },
    'visitMemberExpression': node => addReference(node.property),
    'visitMethodCallExpression': node => addReference(node.method),
  });

  return references;
};

/** Shows reference counts above function declarations as code lenses. */
export const setupCodeLensHandler = (connection: Connection, documentManager: DocumentManager): void => {
  connection.onCodeLens((params: CodeLensParams): CodeLens[] => {
    const document = documentManager.getDocument(params.textDocument.uri);
    if (document === undefined || document.ast === undefined) return [];

    const functions = collectCodeLensFunctions(document.ast.body);

    return functions.map(func => ({
      'range': func.selectionRange,
      'data': { 'name': func.name, 'uri': params.textDocument.uri },
    }));
  });

  connection.onCodeLensResolve((codeLens: CodeLens): CodeLens => {
    const data = codeLens.data as { name: string; uri: string } | undefined;
    if (data === undefined) return codeLens;

    const document = documentManager.getDocument(data.uri);
    if (document === undefined || document.ast === undefined) return codeLens;

    const references = collectCodeLensReferences(document.ast);
    const baseName = data.name.includes(':')
      ? data.name.split(':').pop()!
      : data.name.includes('.')
        ? data.name.split('.').pop()!
        : data.name;

    const locations = references.get(baseName);
    const count = locations !== undefined ? Math.max(0, locations.length - 1) : 0;

    codeLens.command = {
      'title': count === 1 ? '1 reference' : `${count} references`,
      'command': '',
    };

    return codeLens;
  });
};
