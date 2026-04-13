import { walk } from '@parser/visitor';

import type { Chunk, Identifier } from '@typings/ast';
import type { ReferenceLocation } from '@typings/handlers';
import type { DocumentManager } from '@typings/lsp';
import type { Connection, Location, Position, ReferenceParams } from 'vscode-languageserver';

/**
 * Collects all identifier references in the AST grouped by name.
 * @param chunk - The parsed AST chunk to scan.
 * @returns A map from identifier name to its reference locations.
 */
export const collectReferences = (chunk: Chunk): Map<string, ReferenceLocation[]> => {
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

/**
 * Extracts the identifier word at a given LSP position in the document text.
 * @param content - The full document text.
 * @param position - The LSP position (line and character).
 * @returns The word at the position, or undefined if none found.
 */
export const getWordAtPosition = (content: string, position: Position): string | undefined => {
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

/** Registers the find references handler with the LSP connection. */
export const setupReferencesHandler = (connection: Connection, documentManager: DocumentManager): void => {
  connection.onReferences((params: ReferenceParams): Location[] => {
    const document = documentManager.getDocument(params.textDocument.uri);
    if (document === undefined || document.ast === undefined) return [];

    const word = getWordAtPosition(document.content, params.position);
    if (word === undefined) return [];

    const references = collectReferences(document.ast);
    const locations = references.get(word);

    if (locations === undefined) return [];

    return locations.map(loc => ({
      'uri': params.textDocument.uri,
      'range': {
        'start': { 'line': loc.line, 'character': loc.character },
        'end': { 'line': loc.line, 'character': loc.endCharacter },
      },
    }));
  });
};
