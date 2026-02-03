/**
 * Rename Symbol Handler
 * Safely renames a symbol across all usages in the file
 */

import { walk } from '@parser/visitor';

import type { DocumentManager } from '@lsp/documents';
import type { Chunk, Identifier } from '@parser/ast';
import type {
  Connection,
  Position,
  PrepareRenameParams,
  Range,
  RenameParams,
  TextEdit,
  WorkspaceEdit,
} from 'vscode-languageserver';

// Built-in globals that cannot be renamed
const BUILTIN_GLOBALS = new Set([
  'print',
  'warn',
  'error',
  'assert',
  'type',
  'typeof',
  'tostring',
  'tonumber',
  'select',
  'next',
  'pairs',
  'ipairs',
  'rawget',
  'rawset',
  'rawequal',
  'rawlen',
  'setmetatable',
  'getmetatable',
  'pcall',
  'xpcall',
  'require',
  'loadstring',
  'newproxy',
  'unpack',
  'gcinfo',
  'collectgarbage',
  'game',
  'workspace',
  'script',
  'plugin',
  'shared',
  '_G',
  'Enum',
  'Instance',
  'Vector3',
  'Vector2',
  'CFrame',
  'Color3',
  'UDim',
  'UDim2',
  'Rect',
  'Ray',
  'BrickColor',
  'TweenInfo',
  'NumberRange',
  'NumberSequence',
  'ColorSequence',
  'Region3',
  'Axes',
  'Faces',
  'PhysicalProperties',
  'Random',
  'DateTime',
  'task',
  'debug',
  'math',
  'string',
  'table',
  'coroutine',
  'bit32',
  'utf8',
  'buffer',
  'os',
  'tick',
  'time',
  'elapsedTime',
  'wait',
  'delay',
  'spawn',
  'true',
  'false',
  'nil',
  'self',
]);

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
 * Collects all references to identifiers throughout the AST for rename operations.
 * Only includes identifiers that can be safely renamed (excludes property accesses).
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
      // Don't rename path parts or methods - they're property accesses
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
  });

  return references;
};

/**
 * Extracts the word/identifier at the given cursor position in the document.
 * Also returns the start and end character positions of the word.
 * @param content - The full text content of the document
 * @param position - The cursor position with line and character offsets
 * @returns An object containing the word and its start/end positions, or undefined if no word found
 */
const getWordAtPosition = (
  content: string,
  position: Position,
): { word: string; start: number; end: number } | undefined => {
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
  return { 'word': line.slice(start, end), start, end };
};

/**
 * Validates whether a string is a valid Luau identifier.
 * Checks that it starts with a letter or underscore, contains only alphanumeric
 * characters and underscores, and is not a reserved keyword.
 * @param name - The string to validate as an identifier
 * @returns True if the name is a valid Luau identifier, false otherwise
 */
const isValidIdentifier = (name: string): boolean => {
  if (name.length === 0) return false;
  if (!/^[a-zA-Z_]/.test(name)) return false;
  if (!/^[a-zA-Z_]\w*$/.test(name)) return false;

  // Check for reserved keywords
  const keywords = new Set([
    'and',
    'break',
    'do',
    'else',
    'elseif',
    'end',
    'false',
    'for',
    'function',
    'if',
    'in',
    'local',
    'nil',
    'not',
    'or',
    'repeat',
    'return',
    'then',
    'true',
    'until',
    'while',
    'continue',
    'export',
    'type',
  ]);

  return keywords.has(name) === false;
};

/**
 * Registers the rename handlers with the LSP connection.
 * Handles both prepareRename and rename requests for safe symbol renaming.
 * @param connection - The LSP connection to register the handlers on
 * @param documentManager - The document manager for accessing parsed documents
 * @returns void
 */
export const setupRenameHandler = (connection: Connection, documentManager: DocumentManager): void => {
  /**
   * Handles the prepare rename request by validating if the symbol can be renamed.
   * Returns the range of the symbol if it can be renamed, or null if it cannot.
   * @param params - The prepare rename parameters containing document URI and position
   * @returns The range of the renameable symbol, or null if rename is not allowed
   */
  connection.onPrepareRename((params: PrepareRenameParams): Range | null => {
    const document = documentManager.getDocument(params.textDocument.uri);
    if (document === undefined || document.ast === undefined) return null;

    const wordInfo = getWordAtPosition(document.content, params.position);
    if (wordInfo === undefined) return null;

    // Check if it's a built-in that can't be renamed
    if (BUILTIN_GLOBALS.has(wordInfo.word)) return null;

    // Check if this identifier exists in our references
    const references = collectReferences(document.ast);
    if (references.has(wordInfo.word) === false) return null;

    return {
      'start': { 'line': params.position.line, 'character': wordInfo.start },
      'end': { 'line': params.position.line, 'character': wordInfo.end },
    };
  });

  /**
   * Handles the rename request by computing text edits for all references to the symbol.
   * Validates the new name and checks that the symbol is not a built-in global.
   * @param params - The rename parameters containing document URI, position, and new name
   * @returns A workspace edit with all necessary text changes, or null if rename failed
   */
  connection.onRenameRequest((params: RenameParams): WorkspaceEdit | null => {
    const document = documentManager.getDocument(params.textDocument.uri);
    if (document === undefined || document.ast === undefined) return null;

    const wordInfo = getWordAtPosition(document.content, params.position);
    if (wordInfo === undefined) return null;

    // Validate new name
    if (isValidIdentifier(params.newName) === false) return null;

    // Check if it's a built-in that can't be renamed
    if (BUILTIN_GLOBALS.has(wordInfo.word)) return null;

    // Collect all references
    const references = collectReferences(document.ast);
    const locations = references.get(wordInfo.word);

    if (locations === undefined || locations.length === 0) return null;

    // Create text edits for all references
    const edits: TextEdit[] = locations.map(loc => ({
      'range': {
        'start': { 'line': loc.line, 'character': loc.character },
        'end': { 'line': loc.line, 'character': loc.endCharacter },
      },
      'newText': params.newName,
    }));

    return {
      'changes': {
        [params.textDocument.uri]: edits,
      },
    };
  });
};
