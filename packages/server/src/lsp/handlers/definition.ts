import type { Chunk, Statement } from '@typings/ast';
import type { SymbolLocation } from '@typings/handlers';
import type { DocumentManager } from '@typings/lsp';
import type { Connection, DefinitionParams, Location, Position } from 'vscode-languageserver';

/**
 * Collects all variable and function declarations in the AST grouped by name.
 * @param chunk - The parsed AST chunk to scan.
 * @returns A map from identifier name to its declaration locations.
 */
export const collectDeclarations = (chunk: Chunk): Map<string, SymbolLocation[]> => {
  const declarations = new Map<string, SymbolLocation[]>();

  const addDeclaration = (
    name: string,
    node: { range: { start: { line: number; column: number }; end: { line: number; column: number } } },
  ) => {
    const locations = declarations.get(name) ?? [];
    locations.push({
      name,
      'line': node.range.start.line - 1,
      'character': node.range.start.column - 1,
      'endLine': node.range.end.line - 1,
      'endCharacter': node.range.end.column - 1,
    });
    declarations.set(name, locations);
  };

  const processStatements = (statements: ReadonlyArray<Statement>) => {
    for (const stmt of statements) {
      switch (stmt.kind) {
        case 'LocalDeclaration':
          for (const name of stmt.names) {
            addDeclaration(name.name, name);
          }
          for (const value of stmt.values) {
            if (value.kind === 'FunctionExpression') {
              for (const param of value.params) {
                if (param.name !== undefined) addDeclaration(param.name.name, param.name);
              }
              processStatements(value.body);
            }
          }
          break;

        case 'LocalFunction':
          addDeclaration(stmt.name.name, stmt.name);
          for (const param of stmt.func.params) {
            if (param.name !== undefined) addDeclaration(param.name.name, param.name);
          }
          processStatements(stmt.func.body);
          break;

        case 'FunctionDeclaration':
          if (stmt.name.path.length === 0 && stmt.name.method === undefined) {
            addDeclaration(stmt.name.base.name, stmt.name.base);
          }
          for (const param of stmt.func.params) {
            if (param.name !== undefined) addDeclaration(param.name.name, param.name);
          }
          processStatements(stmt.func.body);
          break;

        case 'TypeAlias':
          addDeclaration(stmt.name.name, stmt.name);
          break;

        case 'ForNumeric':
          addDeclaration(stmt.variable.name, stmt.variable);
          processStatements(stmt.body);
          break;

        case 'ForGeneric':
          for (const v of stmt.variables) {
            addDeclaration(v.name, v);
          }
          processStatements(stmt.body);
          break;

        case 'IfStatement':
          processStatements(stmt.thenBody);
          for (const clause of stmt.elseifClauses) {
            processStatements(clause.body);
          }
          if (stmt.elseBody !== undefined) processStatements(stmt.elseBody);
          break;

        case 'WhileStatement':
        case 'RepeatStatement':
        case 'DoStatement':
          processStatements(stmt.body);
          break;

        case 'ExportStatement':
          if (stmt.declaration.kind === 'TypeAlias') {
            addDeclaration(stmt.declaration.name.name, stmt.declaration.name);
          }
          break;
      }
    }
  };

  processStatements(chunk.body);
  return declarations;
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

/**
 * Finds the most relevant declaration for a symbol at a given usage line.
 * @param declarations - The map of declarations collected from the AST.
 * @param name - The symbol name to look up.
 * @param usageLine - The line number where the symbol is used.
 * @returns The best matching declaration, or undefined if none found.
 */
export const findBestDeclaration = (
  declarations: Map<string, SymbolLocation[]>,
  name: string,
  usageLine: number,
): SymbolLocation | undefined => {
  const locations = declarations.get(name);
  if (locations === undefined || locations.length === 0) return undefined;

  let best: SymbolLocation | undefined;
  for (const loc of locations) {
    if (loc.line <= usageLine) {
      if (best === undefined || loc.line > best.line) best = loc;
    }
  }

  return best ?? locations[0];
};

/** Registers the go-to-definition handler with the LSP connection. */
export const setupDefinitionHandler = (connection: Connection, documentManager: DocumentManager): void => {
  connection.onDefinition((params: DefinitionParams): Location | null => {
    const document = documentManager.getDocument(params.textDocument.uri);
    if (document === undefined || document.ast === undefined) return null;

    const word = getWordAtPosition(document.content, params.position);
    if (word === undefined) return null;

    const declarations = collectDeclarations(document.ast);

    const declaration = findBestDeclaration(declarations, word, params.position.line);
    if (declaration === undefined) return null;

    return {
      'uri': params.textDocument.uri,
      'range': {
        'start': { 'line': declaration.line, 'character': declaration.character },
        'end': { 'line': declaration.endLine, 'character': declaration.endCharacter },
      },
    };
  });
};
