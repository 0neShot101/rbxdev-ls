import { typeToString } from '@typings/types';
import { walk } from '@parser/visitor';

import type { Chunk, Statement } from '@typings/ast';
import type { TypeDeclarationLocation } from '@typings/handlers';
import type { DocumentManager } from '@typings/lsp';
import type { Connection, Location, Position, TypeDefinitionParams } from 'vscode-languageserver';

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

/**
 * Collects all type alias declarations in the AST.
 * @param chunk - The parsed AST chunk to scan.
 * @returns A map from type name to its declaration location.
 */
export const collectTypeDeclarations = (chunk: Chunk): Map<string, TypeDeclarationLocation> => {
  const declarations = new Map<string, TypeDeclarationLocation>();

  const processStatements = (statements: ReadonlyArray<Statement>) => {
    for (const stmt of statements) {
      switch (stmt.kind) {
        case 'TypeAlias':
          declarations.set(stmt.name.name, {
            'name': stmt.name.name,
            'line': stmt.name.range.start.line - 1,
            'character': stmt.name.range.start.column - 1,
            'endLine': stmt.name.range.end.line - 1,
            'endCharacter': stmt.name.range.end.column - 1,
          });
          break;

        case 'ExportStatement':
          if (stmt.declaration.kind === 'TypeAlias')
            declarations.set(stmt.declaration.name.name, {
              'name': stmt.declaration.name.name,
              'line': stmt.declaration.name.range.start.line - 1,
              'character': stmt.declaration.name.range.start.column - 1,
              'endLine': stmt.declaration.name.range.end.line - 1,
              'endCharacter': stmt.declaration.name.range.end.column - 1,
            });
          break;

        case 'IfStatement':
          processStatements(stmt.thenBody);
          for (const clause of stmt.elseifClauses) processStatements(clause.body);
          if (stmt.elseBody !== undefined) processStatements(stmt.elseBody);
          break;

        case 'WhileStatement':
        case 'RepeatStatement':
        case 'DoStatement':
          processStatements(stmt.body);
          break;

        case 'ForNumeric':
        case 'ForGeneric':
          processStatements(stmt.body);
          break;

        case 'LocalFunction':
          processStatements(stmt.func.body);
          break;

        case 'FunctionDeclaration':
          processStatements(stmt.func.body);
          break;
      }
    }
  };

  processStatements(chunk.body);
  return declarations;
};

/**
 * Extracts the name from a type definition node if it has one.
 * @param typeDef - The type definition node to extract from.
 * @returns The type name, or undefined if not available.
 */
export const getTypeName = (typeDef: { kind: string; name?: string }): string | undefined => {
  if (typeDef.kind === 'Class') return (typeDef as { name: string }).name;
  if (typeDef.kind === 'Table') return undefined;
  if (typeDef.kind === 'Function') return undefined;
  if (typeDef.kind === 'TypeReference') return (typeDef as { name: string }).name;
  return undefined;
};

/** Navigates to the type definition of the symbol at the cursor position. */
export const setupTypeDefinitionHandler = (connection: Connection, documentManager: DocumentManager): void => {
  connection.onTypeDefinition((params: TypeDefinitionParams): Location | null => {
    const document = documentManager.getDocument(params.textDocument.uri);
    if (document === undefined || document.ast === undefined) return null;

    const word = getWordAtPosition(document.content, params.position);
    if (word === undefined) return null;

    const typeDeclarations = collectTypeDeclarations(document.ast);

    const directTypeDecl = typeDeclarations.get(word);
    if (directTypeDecl !== undefined)
      return {
        'uri': params.textDocument.uri,
        'range': {
          'start': { 'line': directTypeDecl.line, 'character': directTypeDecl.character },
          'end': { 'line': directTypeDecl.endLine, 'character': directTypeDecl.endCharacter },
        },
      };

    if (document.typeCheckResult !== undefined) {
      const symbolType = document.typeCheckResult.allSymbols.get(word);
      if (symbolType !== undefined) {
        const typeName = getTypeName(symbolType);
        if (typeName !== undefined) {
          const typeDecl = typeDeclarations.get(typeName);
          if (typeDecl !== undefined)
            return {
              'uri': params.textDocument.uri,
              'range': {
                'start': { 'line': typeDecl.line, 'character': typeDecl.character },
                'end': { 'line': typeDecl.endLine, 'character': typeDecl.endCharacter },
              },
            };
        }

        const typeStr = typeToString(symbolType);
        const typeRefDecl = typeDeclarations.get(typeStr);
        if (typeRefDecl !== undefined)
          return {
            'uri': params.textDocument.uri,
            'range': {
              'start': { 'line': typeRefDecl.line, 'character': typeRefDecl.character },
              'end': { 'line': typeRefDecl.endLine, 'character': typeRefDecl.endCharacter },
            },
          };
      }
    }

    let foundLocation: Location | null = null;
    walk(document.ast, {
      'visitTypeReference': node => {
        if (node.name === word) {
          const typeDecl = typeDeclarations.get(node.name);
          if (typeDecl !== undefined)
            foundLocation = {
              'uri': params.textDocument.uri,
              'range': {
                'start': { 'line': typeDecl.line, 'character': typeDecl.character },
                'end': { 'line': typeDecl.endLine, 'character': typeDecl.endCharacter },
              },
            };
        }
      },
    });

    return foundLocation;
  });
};
