import { walk } from '@parser/visitor';

import type { Chunk, Statement } from '@typings/ast';
import type { DocumentManager } from '@typings/lsp';
import type { Connection, ImplementationParams, Location, Position, Range } from 'vscode-languageserver';

const getWordAtPosition = (content: string, position: Position): string | undefined => {
  const lines = content.split('\n');
  const line = lines[position.line];
  if (line === undefined) return undefined;

  let start = position.character;
  let end = position.character;

  while (start > 0 && /\w/.test(line[start - 1] ?? '')) start--;
  while (end < line.length && /\w/.test(line[end] ?? '')) end++;

  if (start === end) return undefined;
  return line.slice(start, end);
};

const convertRange = (range: {
  start: { line: number; column: number };
  end: { line: number; column: number };
}): Range => ({
  'start': { 'line': range.start.line - 1, 'character': range.start.column - 1 },
  'end': { 'line': range.end.line - 1, 'character': range.end.column - 1 },
});

/**
 * Checks whether a given name is declared as a type alias in the AST.
 * @param chunk - The parsed AST chunk to search.
 * @param name - The identifier name to check.
 * @returns True if the name is a type alias declaration.
 */
export const isTypeAlias = (chunk: Chunk, name: string): boolean => {
  const checkStatements = (statements: ReadonlyArray<Statement>): boolean => {
    for (const stmt of statements) {
      if (stmt.kind === 'TypeAlias' && stmt.name.name === name) return true;
      if (
        stmt.kind === 'ExportStatement' &&
        stmt.declaration.kind === 'TypeAlias' &&
        stmt.declaration.name.name === name
      )
        return true;
    }
    return false;
  };

  return checkStatements(chunk.body);
};

/** Finds concrete usages of type aliases in variable declarations and function parameters. */
export const setupImplementationHandler = (connection: Connection, documentManager: DocumentManager): void => {
  connection.onImplementation((params: ImplementationParams): Location[] => {
    const document = documentManager.getDocument(params.textDocument.uri);
    if (document === undefined || document.ast === undefined) return [];

    const word = getWordAtPosition(document.content, params.position);
    if (word === undefined) return [];

    if (isTypeAlias(document.ast, word) === false) return [];

    const locations: Location[] = [];

    walk(document.ast, {
      'visitLocalDeclaration': node => {
        for (let i = 0; i < node.names.length; i++) {
          const typeAnnotation = node.types[i];
          if (typeAnnotation === undefined) continue;
          if (typeAnnotation.kind === 'TypeReference' && typeAnnotation.name === word)
            locations.push({
              'uri': params.textDocument.uri,
              'range': convertRange(node.names[i]!.range),
            });
        }
      },

      'visitLocalFunction': node => {
        for (const param of node.func.params)
          if (param.type !== undefined && param.type.kind === 'TypeReference' && param.type.name === word)
            if (param.name !== undefined)
              locations.push({
                'uri': params.textDocument.uri,
                'range': convertRange(param.name.range),
              });

        if (node.func.returnType !== undefined)
          if (node.func.returnType.kind === 'TypeReference' && node.func.returnType.name === word)
            locations.push({
              'uri': params.textDocument.uri,
              'range': convertRange(node.name.range),
            });
      },

      'visitFunctionDeclaration': node => {
        for (const param of node.func.params)
          if (param.type !== undefined && param.type.kind === 'TypeReference' && param.type.name === word)
            if (param.name !== undefined)
              locations.push({
                'uri': params.textDocument.uri,
                'range': convertRange(param.name.range),
              });

        if (node.func.returnType !== undefined)
          if (node.func.returnType.kind === 'TypeReference' && node.func.returnType.name === word)
            locations.push({
              'uri': params.textDocument.uri,
              'range': convertRange(node.name.base.range),
            });
      },
    });

    return locations;
  });
};
