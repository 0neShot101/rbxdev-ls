/**
 * Find References Handler
 * Finds all usages of a symbol in the current file
 */

import { walk } from '@parser/visitor';

import type { DocumentManager } from '@lsp/documents';
import type { Chunk, Identifier } from '@parser/ast';
import type { Connection, Location, Position, ReferenceParams } from 'vscode-languageserver';

/**
 * Represents a location of a symbol reference in the document.
 * Uses zero-based line and character positions.
 */
interface ReferenceLocation {
  /** The zero-based line number where the reference occurs */
  readonly line: number;
  /** The zero-based character position where the reference starts */
  readonly character: number;
  /** The zero-based character position where the reference ends */
  readonly endCharacter: number;
}

/**
 * Collects all references to identifiers throughout the AST.
 * Traverses the entire syntax tree and records every occurrence of each identifier.
 * @param chunk - The root AST node representing the parsed Luau file
 * @returns A map where keys are identifier names and values are arrays of their locations
 */
const collectReferences = (chunk: Chunk): Map<string, ReferenceLocation[]> => {
  const references = new Map<string, ReferenceLocation[]>();

  /**
   * Adds a reference location for the given identifier to the references map.
   * @param ident - The identifier AST node to record
   */
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
    'visitIdentifier': node => {
      addReference(node);
    },
    'visitLocalDeclaration': node => {
      for (const name of node.names) {
        addReference(name);
      }
    },
    'visitLocalFunction': node => {
      addReference(node.name);
    },
    'visitFunctionDeclaration': node => {
      addReference(node.name.base);
      for (const part of node.name.path) {
        addReference(part);
      }
      if (node.name.method !== undefined) {
        addReference(node.name.method);
      }
    },
    'visitTypeAlias': node => {
      addReference(node.name);
    },
    'visitForNumeric': node => {
      addReference(node.variable);
    },
    'visitForGeneric': node => {
      for (const v of node.variables) {
        addReference(v);
      }
    },
    'visitMemberExpression': node => {
      addReference(node.property);
    },
    'visitMethodCallExpression': node => {
      addReference(node.method);
    },
  });

  return references;
};

/**
 * Extracts the word/identifier at the given cursor position in the document.
 * Expands from the cursor position in both directions to find word boundaries.
 * @param content - The full text content of the document
 * @param position - The cursor position with line and character offsets
 * @returns The word at the position, or undefined if no word is found
 */
const getWordAtPosition = (content: string, position: Position): string | undefined => {
  const lines = content.split('\n');
  const line = lines[position.line];
  if (line === undefined) return undefined;

  let start = position.character;
  let end = position.character;

  while (start > 0 && /\w/.test(line[start - 1] ?? '')) {
    start--;
  }
  while (end < line.length && /\w/.test(line[end] ?? '')) {
    end++;
  }

  if (start === end) return undefined;
  return line.slice(start, end);
};

/**
 * Registers the find references handler with the LSP connection.
 * Handles textDocument/references requests to find all usages of a symbol.
 * @param connection - The LSP connection to register the handler on
 * @param documentManager - The document manager for accessing parsed documents
 * @returns void
 */
export const setupReferencesHandler = (connection: Connection, documentManager: DocumentManager): void => {
  /**
   * Handles the references request by finding all occurrences of the symbol at the cursor.
   * @param params - The reference request parameters containing document URI and position
   * @returns An array of locations where the symbol is referenced
   */
  connection.onReferences((params: ReferenceParams): Location[] => {
    const document = documentManager.getDocument(params.textDocument.uri);
    if (document === undefined || document.ast === undefined) return [];

    // Get the word at the cursor position
    const word = getWordAtPosition(document.content, params.position);
    if (word === undefined) return [];

    // Collect all references
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
