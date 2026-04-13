import { walkExpression, walkStatement } from '@parser/visitor';

import type { Chunk, Expression, Identifier, Statement } from '@typings/ast';
import type { ReferenceLocation, ScopeEntry } from '@typings/handlers';
import type { DocumentManager } from '@typings/lsp';
import type { Connection, LinkedEditingRangeParams, LinkedEditingRanges, Position } from 'vscode-languageserver';

const toRef = (ident: Identifier): ReferenceLocation => ({
  'line': ident.range.start.line - 1,
  'character': ident.range.start.column - 1,
  'endCharacter': ident.range.end.column - 1,
});

/**
 * Collects all scoped identifier references for linked editing (simultaneous rename).
 * @param chunk - The parsed AST chunk to scan.
 * @returns An array of scope entries mapping identifiers to their co-occurrence ranges.
 */
export const collectScopedReferences = (chunk: Chunk): ScopeEntry[] => {
  const entries: ScopeEntry[] = [];
  const scopeStack: Map<string, ScopeEntry>[] = [new Map()];

  const currentScope = (): Map<string, ScopeEntry> => scopeStack[scopeStack.length - 1]!;

  const pushScope = (): void => {
    scopeStack.push(new Map());
  };

  const popScope = (): void => {
    scopeStack.pop();
  };

  const declare = (ident: Identifier): void => {
    const entry: ScopeEntry = {
      'declarationLine': ident.range.start.line - 1,
      'declarationColumn': ident.range.start.column - 1,
      'references': [toRef(ident)],
    };
    currentScope().set(ident.name, entry);
    entries.push(entry);
  };

  const resolve = (name: string): ScopeEntry | undefined => {
    for (let i = scopeStack.length - 1; i >= 0; i--) {
      const entry = scopeStack[i]!.get(name);
      if (entry !== undefined) return entry;
    }
    return undefined;
  };

  const resolveIdent = (ident: Identifier): void => {
    const entry = resolve(ident.name);
    if (entry !== undefined) entry.references.push(toRef(ident));
  };

  const visitExpr = (expr: Expression): void =>
    walkExpression(expr, {
      'visitIdentifier': (node: Identifier) => resolveIdent(node),
    });

  const walkBody = (stmts: ReadonlyArray<Statement>): void => {
    for (const stmt of stmts) {
      switch (stmt.kind) {
        case 'LocalDeclaration':
          stmt.values.forEach(visitExpr);
          stmt.names.forEach(declare);
          break;

        case 'LocalFunction':
          declare(stmt.name);
          pushScope();
          stmt.func.params.forEach(p => {
            if (p.name !== undefined) declare(p.name);
          });
          walkBody(stmt.func.body);
          popScope();
          break;

        case 'FunctionDeclaration': {
          const existing = resolve(stmt.name.base.name);
          if (existing !== undefined) existing.references.push(toRef(stmt.name.base));
          pushScope();
          stmt.func.params.forEach(p => {
            if (p.name !== undefined) declare(p.name);
          });
          walkBody(stmt.func.body);
          popScope();
          break;
        }

        case 'ForNumeric':
          pushScope();
          declare(stmt.variable);
          walkBody(stmt.body);
          popScope();
          break;

        case 'ForGeneric':
          pushScope();
          stmt.variables.forEach(declare);
          walkBody(stmt.body);
          popScope();
          break;

        case 'IfStatement':
          pushScope();
          walkBody(stmt.thenBody);
          popScope();
          for (const clause of stmt.elseifClauses) {
            pushScope();
            walkBody(clause.body);
            popScope();
          }
          if (stmt.elseBody !== undefined) {
            pushScope();
            walkBody(stmt.elseBody);
            popScope();
          }
          break;

        case 'WhileStatement':
        case 'RepeatStatement':
        case 'DoStatement':
          pushScope();
          walkBody(stmt.body);
          popScope();
          break;

        default:
          walkStatement(stmt, {
            'visitIdentifier': (node: Identifier) => {
              resolveIdent(node);
            },
          });
          break;
      }
    }
  };

  walkBody(chunk.body);
  return entries;
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

/** Provides linked editing ranges for simultaneous identifier renaming within the same scope. */
export const setupLinkedEditingRangeHandler = (connection: Connection, documentManager: DocumentManager): void => {
  connection.languages.onLinkedEditingRange((params: LinkedEditingRangeParams): LinkedEditingRanges | null => {
    const document = documentManager.getDocument(params.textDocument.uri);
    if (document === undefined || document.ast === undefined) return null;

    const word = getWordAtPosition(document.content, params.position);
    if (word === undefined) return null;

    const entries = collectScopedReferences(document.ast);
    const { line, character } = params.position;

    for (const entry of entries) {
      const match = entry.references.find(
        ref => ref.line === line && character >= ref.character && character <= ref.endCharacter,
      );
      if (match !== undefined) {
        return {
          'ranges': entry.references.map(loc => ({
            'start': { 'line': loc.line, 'character': loc.character },
            'end': { 'line': loc.line, 'character': loc.endCharacter },
          })),
          'wordPattern': '[a-zA-Z_]\\w*',
        };
      }
    }

    return null;
  });
};
