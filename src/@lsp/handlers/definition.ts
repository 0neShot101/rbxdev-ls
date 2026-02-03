/**
 * Go to Definition Handler
 * Allows jumping to where a variable/function is declared
 */

import type { DocumentManager } from '@lsp/documents';
import type { Chunk, Statement } from '@parser/ast';
import type { Connection, DefinitionParams, Location, Position } from 'vscode-languageserver';

/**
 * Represents the location of a symbol declaration in the document.
 * Uses zero-based line and character positions.
 */
interface SymbolLocation {
  /** The name of the declared symbol */
  readonly name: string;
  /** The zero-based line number where the declaration starts */
  readonly line: number;
  /** The zero-based character position where the declaration starts */
  readonly character: number;
  /** The zero-based line number where the declaration ends */
  readonly endLine: number;
  /** The zero-based character position where the declaration ends */
  readonly endCharacter: number;
}

/**
 * Collects all symbol declarations from the AST.
 * Traverses the syntax tree recursively to find local variables, functions,
 * type aliases, loop variables, and function parameters.
 * @param chunk - The root AST node representing the parsed Luau file
 * @returns A map where keys are symbol names and values are arrays of their declaration locations
 */
const collectDeclarations = (chunk: Chunk): Map<string, SymbolLocation[]> => {
  const declarations = new Map<string, SymbolLocation[]>();

  /**
   * Adds a declaration location for the given symbol name to the declarations map.
   * @param name - The name of the symbol being declared
   * @param node - The AST node containing the range information
   */
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

  /**
   * Recursively processes statements to find all declarations.
   * Handles various statement types including local declarations, functions,
   * type aliases, loops, and control flow statements.
   * @param statements - The array of statements to process
   */
  const processStatements = (statements: ReadonlyArray<Statement>) => {
    for (const stmt of statements) {
      switch (stmt.kind) {
        case 'LocalDeclaration':
          for (const name of stmt.names) {
            addDeclaration(name.name, name);
          }
          // Process function bodies in values
          for (const value of stmt.values) {
            if (value.kind === 'FunctionExpression') {
              for (const param of value.params) {
                if (param.name !== undefined) {
                  addDeclaration(param.name.name, param.name);
                }
              }
              processStatements(value.body);
            }
          }
          break;

        case 'LocalFunction':
          addDeclaration(stmt.name.name, stmt.name);
          // Process parameters
          for (const param of stmt.func.params) {
            if (param.name !== undefined) {
              addDeclaration(param.name.name, param.name);
            }
          }
          processStatements(stmt.func.body);
          break;

        case 'FunctionDeclaration':
          // Only add the base name for simple functions
          if (stmt.name.path.length === 0 && stmt.name.method === undefined) {
            addDeclaration(stmt.name.base.name, stmt.name.base);
          }
          // Process parameters
          for (const param of stmt.func.params) {
            if (param.name !== undefined) {
              addDeclaration(param.name.name, param.name);
            }
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
          if (stmt.elseBody !== undefined) {
            processStatements(stmt.elseBody);
          }
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

  // Find word boundaries
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
 * Finds the most relevant declaration for a name at a given position.
 * Uses a simple scoping heuristic by preferring declarations that appear
 * before the usage location. For forward references, returns the first declaration.
 * @param declarations - The map of all declarations in the document
 * @param name - The symbol name to find the declaration for
 * @param usageLine - The zero-based line number where the symbol is used
 * @returns The best matching declaration location, or undefined if none found
 */
const findBestDeclaration = (
  declarations: Map<string, SymbolLocation[]>,
  name: string,
  usageLine: number,
): SymbolLocation | undefined => {
  const locations = declarations.get(name);
  if (locations === undefined || locations.length === 0) return undefined;

  // Find the closest declaration that appears before or at the usage line
  let best: SymbolLocation | undefined;
  for (const loc of locations) {
    if (loc.line <= usageLine) {
      if (best === undefined || loc.line > best.line) {
        best = loc;
      }
    }
  }

  // If no declaration before usage, return the first one (for forward references)
  return best ?? locations[0];
};

/**
 * Registers the go-to-definition handler with the LSP connection.
 * Handles textDocument/definition requests to navigate to symbol declarations.
 * @param connection - The LSP connection to register the handler on
 * @param documentManager - The document manager for accessing parsed documents
 * @returns void
 */
export const setupDefinitionHandler = (connection: Connection, documentManager: DocumentManager): void => {
  /**
   * Handles the definition request by finding the declaration of the symbol at the cursor.
   * @param params - The definition request parameters containing document URI and position
   * @returns The location of the declaration, or null if not found
   */
  connection.onDefinition((params: DefinitionParams): Location | null => {
    const document = documentManager.getDocument(params.textDocument.uri);
    if (document === undefined || document.ast === undefined) return null;

    // Get the word at the cursor position
    const word = getWordAtPosition(document.content, params.position);
    if (word === undefined) return null;

    // Collect all declarations
    const declarations = collectDeclarations(document.ast);

    // Find the best declaration for this word
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
