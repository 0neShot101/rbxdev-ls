import { walk } from '@parser/visitor';

import type { Chunk, Identifier } from '@typings/ast';
import type { ReferenceLocation } from '@typings/handlers';
import type { DocumentManager } from '@typings/lsp';
import type {
  Connection,
  Position,
  PrepareRenameParams,
  Range,
  RenameParams,
  TextEdit,
  WorkspaceEdit,
} from 'vscode-languageserver';

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
 * Collects all identifier references for rename operations, including declarations and usages.
 * @param chunk - The parsed AST chunk to scan.
 * @returns A map from identifier name to its reference locations.
 */
export const collectRenameReferences = (chunk: Chunk): Map<string, ReferenceLocation[]> => {
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
    'visitFunctionDeclaration': node => addReference(node.name.base),
    'visitTypeAlias': node => addReference(node.name),
    'visitForNumeric': node => addReference(node.variable),
    'visitForGeneric': node => {
      for (const v of node.variables) addReference(v);
    },
  });

  return references;
};

const getWordAtPosition = (
  content: string,
  position: Position,
): { word: string; start: number; end: number } | undefined => {
  const lines = content.split('\n');
  const line = lines[position.line];
  if (line === undefined) return undefined;

  let start = position.character;
  let end = position.character;

  while (start > 0 && /\w/.test(line[start - 1] ?? '')) start--;
  while (end < line.length && /\w/.test(line[end] ?? '')) end++;

  if (start === end) return undefined;
  return { 'word': line.slice(start, end), start, end };
};

/**
 * Validates whether a string is a legal Luau identifier (not a keyword and valid characters).
 * @param name - The proposed identifier name.
 * @returns True if the name is a valid Luau identifier.
 */
export const isValidIdentifier = (name: string): boolean => {
  if (name.length === 0) return false;
  if (/^[a-zA-Z_]/.test(name) === false) return false;
  if (/^[a-zA-Z_]\w*$/.test(name) === false) return false;

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

/** Handles prepareRename and rename requests for safe symbol renaming. */
export const setupRenameHandler = (connection: Connection, documentManager: DocumentManager): void => {
  connection.onPrepareRename((params: PrepareRenameParams): Range | null => {
    const document = documentManager.getDocument(params.textDocument.uri);
    if (document === undefined || document.ast === undefined) return null;

    const wordInfo = getWordAtPosition(document.content, params.position);
    if (wordInfo === undefined) return null;

    if (BUILTIN_GLOBALS.has(wordInfo.word)) return null;

    const references = collectRenameReferences(document.ast);
    if (references.has(wordInfo.word) === false) return null;

    return {
      'start': { 'line': params.position.line, 'character': wordInfo.start },
      'end': { 'line': params.position.line, 'character': wordInfo.end },
    };
  });

  connection.onRenameRequest((params: RenameParams): WorkspaceEdit | null => {
    const document = documentManager.getDocument(params.textDocument.uri);
    if (document === undefined || document.ast === undefined) return null;

    const wordInfo = getWordAtPosition(document.content, params.position);
    if (wordInfo === undefined) return null;

    if (isValidIdentifier(params.newName) === false) return null;

    if (BUILTIN_GLOBALS.has(wordInfo.word)) return null;

    const references = collectRenameReferences(document.ast);
    const locations = references.get(wordInfo.word);

    if (locations === undefined || locations.length === 0) return null;

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
