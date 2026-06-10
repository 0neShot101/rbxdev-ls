import { walk } from '@parser/visitor';
import { DocumentHighlightKind } from 'vscode-languageserver';

import type { Chunk, Identifier } from '@typings/ast';
import type { HighlightLocation } from '@typings/handlers';
import type { DocumentManager } from '@typings/lsp';
import type { Connection, DocumentHighlight, DocumentHighlightParams, Position } from 'vscode-languageserver';

/**
 * Collects all identifier occurrences in the AST with read/write classification.
 * @param chunk - The parsed AST chunk to scan.
 * @returns A map from identifier name to its highlight locations.
 */
export const collectHighlights = (chunk: Chunk): Map<string, HighlightLocation[]> => {
  const highlights = new Map<string, HighlightLocation[]>();
  const writePositions = new Set<string>();

  const addHighlight = (ident: Identifier, kind: DocumentHighlightKind) => {
    const key = `${ident.range.start.line}:${ident.range.start.column}`;
    if (writePositions.has(key)) return;
    if (kind === DocumentHighlightKind.Write) writePositions.add(key);

    const locations = highlights.get(ident.name) ?? [];
    locations.push({
      'line': ident.range.start.line - 1,
      'character': ident.range.start.column - 1,
      'endCharacter': ident.range.end.column - 1,
      'kind': kind,
    });
    highlights.set(ident.name, locations);
  };

  walk(chunk, {
    'visitLocalDeclaration': node => {
      for (const name of node.names) addHighlight(name, DocumentHighlightKind.Write);
    },
    'visitAssignment': node => {
      for (const target of node.targets)
        if (target.kind === 'Identifier') addHighlight(target, DocumentHighlightKind.Write);
    },
    'visitCompoundAssignment': node => {
      if (node.target.kind === 'Identifier') addHighlight(node.target, DocumentHighlightKind.Write);
    },
    'visitLocalFunction': node => addHighlight(node.name, DocumentHighlightKind.Write),
    'visitFunctionDeclaration': node => {
      addHighlight(node.name.base, DocumentHighlightKind.Write);
      for (const part of node.name.path) addHighlight(part, DocumentHighlightKind.Write);
      if (node.name.method !== undefined) addHighlight(node.name.method, DocumentHighlightKind.Write);
    },
    'visitTypeAlias': node => addHighlight(node.name, DocumentHighlightKind.Write),
    'visitForNumeric': node => addHighlight(node.variable, DocumentHighlightKind.Write),
    'visitForGeneric': node => {
      for (const v of node.variables) addHighlight(v, DocumentHighlightKind.Write);
    },
    'visitIdentifier': node => addHighlight(node, DocumentHighlightKind.Text),
    'visitMemberExpression': node => addHighlight(node.property, DocumentHighlightKind.Text),
    'visitMethodCallExpression': node => addHighlight(node.method, DocumentHighlightKind.Text),
  });

  return highlights;
};

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

/** Highlights all occurrences of the symbol under cursor with read/write distinction. */
export const setupDocumentHighlightHandler = (connection: Connection, documentManager: DocumentManager): void => {
  connection.onDocumentHighlight((params: DocumentHighlightParams): DocumentHighlight[] => {
    const document = documentManager.getDocument(params.textDocument.uri);
    if (document === undefined || document.ast === undefined) return [];

    const word = getWordAtPosition(document.content, params.position);
    if (word === undefined) return [];

    const highlights = collectHighlights(document.ast);
    const locations = highlights.get(word);
    if (locations === undefined) return [];

    return locations.map(loc => ({
      'range': {
        'start': { 'line': loc.line, 'character': loc.character },
        'end': { 'line': loc.line, 'character': loc.endCharacter },
      },
      'kind': loc.kind,
    }));
  });
};
