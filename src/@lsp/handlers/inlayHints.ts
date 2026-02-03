/**
 * Inlay Hints Handler
 * Shows inline type annotations for variables and parameters
 */

import { typeToString } from '@typings/types';
import { InlayHintKind } from 'vscode-languageserver';

import type { DocumentManager, ParsedDocument } from '@lsp/documents';
import type { Statement } from '@parser/ast';
import type { Connection, InlayHint, InlayHintParams } from 'vscode-languageserver';

/**
 * Collects inlay hints from a parsed document.
 * Generates type hints for variables, parameters, and loop variables that lack explicit type annotations.
 * @param document - The parsed document containing the AST and type check results
 * @returns An array of InlayHint objects to display inline type annotations
 */
const collectInlayHints = (document: ParsedDocument): InlayHint[] => {
  const hints: InlayHint[] = [];

  if (document.ast === undefined || document.typeCheckResult === undefined) {
    return hints;
  }

  // Use allSymbols map which contains all symbols regardless of scope
  const allSymbols = document.typeCheckResult.allSymbols;

  /**
   * Recursively processes statements to find variable declarations without type annotations.
   * @param statements - The array of statements to process
   * @returns void
   */
  const processStatements = (statements: ReadonlyArray<Statement>) => {
    for (const stmt of statements) {
      switch (stmt.kind) {
        case 'LocalDeclaration': {
          // For each variable, check if it has an explicit type annotation
          for (let i = 0; i < stmt.names.length; i++) {
            const name = stmt.names[i];
            const explicitType = stmt.types[i];

            if (name === undefined) continue;

            // Only add hint if no explicit type annotation
            if (explicitType === undefined) {
              // Look up the inferred type from allSymbols (works for all scopes)
              const symbolType = allSymbols.get(name.name);
              if (symbolType !== undefined && symbolType.kind !== 'Any' && symbolType.kind !== 'Unknown') {
                const typeStr = typeToString(symbolType);

                // Skip if the type is too complex or not useful
                if (typeStr.length > 50) continue;
                if (typeStr === 'nil') continue;
                if (typeStr.includes('not found')) continue;

                hints.push({
                  'position': {
                    'line': name.range.end.line - 1,
                    'character': name.range.end.column - 1,
                  },
                  'label': `: ${typeStr}`,
                  'kind': InlayHintKind.Type,
                  'paddingLeft': false,
                  'paddingRight': false,
                });
              }
            }
          }

          // Process function bodies in values
          for (const value of stmt.values) {
            if (value.kind === 'FunctionExpression') {
              processStatements(value.body);
            }
          }
          break;
        }

        case 'LocalFunction': {
          // Add parameter type hints if not explicitly typed
          for (const param of stmt.func.params) {
            if (param.name !== undefined && param.type === undefined) {
              // Look up parameter type from allSymbols
              const symbolType = allSymbols.get(param.name.name);
              if (symbolType !== undefined && symbolType.kind !== 'Any' && symbolType.kind !== 'Unknown') {
                const typeStr = typeToString(symbolType);
                if (typeStr.length <= 30 && typeStr !== 'any') {
                  hints.push({
                    'position': {
                      'line': param.name.range.end.line - 1,
                      'character': param.name.range.end.column - 1,
                    },
                    'label': `: ${typeStr}`,
                    'kind': InlayHintKind.Type,
                    'paddingLeft': false,
                    'paddingRight': false,
                  });
                }
              }
            }
          }
          processStatements(stmt.func.body);
          break;
        }

        case 'FunctionDeclaration': {
          // Add parameter type hints if not explicitly typed
          for (const param of stmt.func.params) {
            if (param.name !== undefined && param.type === undefined) {
              const symbolType = allSymbols.get(param.name.name);
              if (symbolType !== undefined && symbolType.kind !== 'Any' && symbolType.kind !== 'Unknown') {
                const typeStr = typeToString(symbolType);
                if (typeStr.length <= 30 && typeStr !== 'any') {
                  hints.push({
                    'position': {
                      'line': param.name.range.end.line - 1,
                      'character': param.name.range.end.column - 1,
                    },
                    'label': `: ${typeStr}`,
                    'kind': InlayHintKind.Type,
                    'paddingLeft': false,
                    'paddingRight': false,
                  });
                }
              }
            }
          }
          processStatements(stmt.func.body);
          break;
        }

        case 'ForNumeric': {
          // Add type hint for loop variable (always number)
          hints.push({
            'position': {
              'line': stmt.variable.range.end.line - 1,
              'character': stmt.variable.range.end.column - 1,
            },
            'label': `: number`,
            'kind': InlayHintKind.Type,
            'paddingLeft': false,
            'paddingRight': false,
          });
          processStatements(stmt.body);
          break;
        }

        case 'ForGeneric': {
          processStatements(stmt.body);
          break;
        }

        case 'IfStatement': {
          processStatements(stmt.thenBody);
          for (const clause of stmt.elseifClauses) {
            processStatements(clause.body);
          }
          if (stmt.elseBody !== undefined) {
            processStatements(stmt.elseBody);
          }
          break;
        }

        case 'WhileStatement':
        case 'RepeatStatement':
        case 'DoStatement': {
          processStatements(stmt.body);
          break;
        }
      }
    }
  };

  processStatements(document.ast.body);
  return hints;
};

/**
 * Sets up the inlay hints handler for the LSP connection.
 * Registers a handler that provides inline type hints for variables and parameters.
 * @param connection - The LSP connection to register the handler on
 * @param documentManager - The document manager for accessing parsed documents
 * @returns void
 */
export const setupInlayHintsHandler = (connection: Connection, documentManager: DocumentManager): void => {
  connection.languages.inlayHint.on((params: InlayHintParams): InlayHint[] => {
    const document = documentManager.getDocument(params.textDocument.uri);
    if (document === undefined) return [];

    return collectInlayHints(document);
  });
};
