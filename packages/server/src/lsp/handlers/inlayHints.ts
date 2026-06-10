import { typeToString } from '@typings/types';
import { InlayHintKind } from 'vscode-languageserver';

import type { Statement } from '@typings/ast';
import type { DocumentManager, ParsedDocument } from '@typings/lsp';
import type { Connection, InlayHint, InlayHintParams } from 'vscode-languageserver';

/**
 * Collects inlay type hints for variables and parameters from a parsed document.
 * @param document - The parsed document to extract hints from.
 * @returns An array of LSP InlayHint objects.
 */
export const collectInlayHints = (document: ParsedDocument): InlayHint[] => {
  const hints: InlayHint[] = [];

  if (document.ast === undefined || document.typeCheckResult === undefined) return hints;

  const allSymbols = document.typeCheckResult.allSymbols;

  const processStatements = (statements: ReadonlyArray<Statement>) => {
    for (const stmt of statements) {
      switch (stmt.kind) {
        case 'LocalDeclaration': {
          for (let i = 0; i < stmt.names.length; i++) {
            const name = stmt.names[i];
            const explicitType = stmt.types[i];

            if (name === undefined) continue;

            if (explicitType === undefined) {
              const symbolType = allSymbols.get(name.name);
              if (symbolType !== undefined && symbolType.kind !== 'Any' && symbolType.kind !== 'Unknown') {
                const typeStr = typeToString(symbolType);

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

          for (const value of stmt.values) if (value.kind === 'FunctionExpression') processStatements(value.body);
          break;
        }

        case 'LocalFunction': {
          for (const param of stmt.func.params)
            if (param.name !== undefined && param.type === undefined) {
              const symbolType = allSymbols.get(param.name.name);
              if (symbolType !== undefined && symbolType.kind !== 'Any' && symbolType.kind !== 'Unknown') {
                const typeStr = typeToString(symbolType);
                if (typeStr.length <= 30 && typeStr !== 'any')
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
          processStatements(stmt.func.body);
          break;
        }

        case 'FunctionDeclaration': {
          for (const param of stmt.func.params)
            if (param.name !== undefined && param.type === undefined) {
              const symbolType = allSymbols.get(param.name.name);
              if (symbolType !== undefined && symbolType.kind !== 'Any' && symbolType.kind !== 'Unknown') {
                const typeStr = typeToString(symbolType);
                if (typeStr.length <= 30 && typeStr !== 'any')
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
          processStatements(stmt.func.body);
          break;
        }

        case 'ForNumeric': {
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
          for (const clause of stmt.elseifClauses) processStatements(clause.body);
          if (stmt.elseBody !== undefined) processStatements(stmt.elseBody);
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

/** Provides inline type hints for variables and parameters. */
export const setupInlayHintsHandler = (connection: Connection, documentManager: DocumentManager): void => {
  connection.languages.inlayHint.on((params: InlayHintParams): InlayHint[] => {
    const document = documentManager.getDocument(params.textDocument.uri);
    if (document === undefined) return [];

    return collectInlayHints(document);
  });
};
