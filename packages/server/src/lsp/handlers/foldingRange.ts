import { FoldingRangeKind } from 'vscode-languageserver';

import type { Chunk, Expression, Statement } from '@typings/ast';
import type { DocumentManager } from '@typings/lsp';
import type { Connection, FoldingRange, FoldingRangeParams } from 'vscode-languageserver';

const addRange = (ranges: FoldingRange[], startLine: number, endLine: number, kind?: FoldingRangeKind): void => {
  const start = startLine - 1;
  const end = endLine - 1;
  if (end <= start) return;
  if (kind !== undefined) ranges.push({ 'startLine': start, 'endLine': end, 'kind': kind });
  else ranges.push({ 'startLine': start, 'endLine': end });
};

const collectExpressionFolds = (expr: Expression, ranges: FoldingRange[]): void => {
  switch (expr.kind) {
    case 'FunctionExpression':
      addRange(ranges, expr.range.start.line, expr.range.end.line);
      for (const stmt of expr.body) collectStatementFolds(stmt, ranges);
      break;

    case 'TableExpression':
      addRange(ranges, expr.range.start.line, expr.range.end.line);
      for (const field of expr.fields)
        if (field.kind === 'TableFieldValue' || field.kind === 'TableFieldKey' || field.kind === 'TableFieldIndex')
          collectExpressionFolds(field.value, ranges);
      break;

    case 'CallExpression':
      collectExpressionFolds(expr.callee, ranges);
      for (const arg of expr.args) collectExpressionFolds(arg, ranges);
      break;

    case 'MethodCallExpression':
      collectExpressionFolds(expr.object, ranges);
      for (const arg of expr.args) collectExpressionFolds(arg, ranges);
      break;

    case 'BinaryExpression':
      collectExpressionFolds(expr.left, ranges);
      collectExpressionFolds(expr.right, ranges);
      break;

    case 'UnaryExpression':
      collectExpressionFolds(expr.operand, ranges);
      break;

    case 'IfExpression':
      collectExpressionFolds(expr.condition, ranges);
      collectExpressionFolds(expr.thenExpr, ranges);
      collectExpressionFolds(expr.elseExpr, ranges);
      break;

    case 'ParenthesizedExpression':
      collectExpressionFolds(expr.expression, ranges);
      break;

    case 'IndexExpression':
      collectExpressionFolds(expr.object, ranges);
      collectExpressionFolds(expr.index, ranges);
      break;

    case 'MemberExpression':
      collectExpressionFolds(expr.object, ranges);
      break;

    case 'TypeCastExpression':
      collectExpressionFolds(expr.expression, ranges);
      break;

    case 'InterpolatedString':
      for (const part of expr.parts)
        if (part.kind === 'InterpolatedExpression') collectExpressionFolds(part.expression, ranges);
      break;
  }
};

const collectBodyFolds = (body: ReadonlyArray<Statement>, ranges: FoldingRange[]): void => {
  for (const stmt of body) collectStatementFolds(stmt, ranges);
};

const collectStatementFolds = (stmt: Statement, ranges: FoldingRange[]): void => {
  switch (stmt.kind) {
    case 'FunctionDeclaration':
      addRange(ranges, stmt.range.start.line, stmt.range.end.line);
      collectBodyFolds(stmt.func.body, ranges);
      break;

    case 'LocalFunction':
      addRange(ranges, stmt.range.start.line, stmt.range.end.line);
      collectBodyFolds(stmt.func.body, ranges);
      break;

    case 'IfStatement':
      addRange(ranges, stmt.range.start.line, stmt.range.end.line);
      collectBodyFolds(stmt.thenBody, ranges);
      for (const clause of stmt.elseifClauses) collectBodyFolds(clause.body, ranges);
      if (stmt.elseBody !== undefined) collectBodyFolds(stmt.elseBody, ranges);
      break;

    case 'WhileStatement':
      addRange(ranges, stmt.range.start.line, stmt.range.end.line);
      collectBodyFolds(stmt.body, ranges);
      break;

    case 'RepeatStatement':
      addRange(ranges, stmt.range.start.line, stmt.range.end.line);
      collectBodyFolds(stmt.body, ranges);
      break;

    case 'ForNumeric':
      addRange(ranges, stmt.range.start.line, stmt.range.end.line);
      collectBodyFolds(stmt.body, ranges);
      break;

    case 'ForGeneric':
      addRange(ranges, stmt.range.start.line, stmt.range.end.line);
      collectBodyFolds(stmt.body, ranges);
      break;

    case 'DoStatement':
      addRange(ranges, stmt.range.start.line, stmt.range.end.line);
      collectBodyFolds(stmt.body, ranges);
      break;

    case 'LocalDeclaration':
      for (const value of stmt.values) collectExpressionFolds(value, ranges);
      break;

    case 'Assignment':
      for (const value of stmt.values) collectExpressionFolds(value, ranges);
      break;

    case 'ReturnStatement':
      for (const value of stmt.values) collectExpressionFolds(value, ranges);
      break;

    case 'CallStatement':
      collectExpressionFolds(stmt.expression, ranges);
      break;

    case 'ExportStatement':
      collectStatementFolds(stmt.declaration, ranges);
      break;
  }
};

/**
 * Collects foldable regions from the AST (functions, loops, tables, comments).
 * @param chunk - The parsed AST chunk to scan.
 * @returns An array of folding ranges for the document.
 */
export const collectFoldingRanges = (chunk: Chunk): FoldingRange[] => {
  const ranges: FoldingRange[] = [];

  for (const comment of chunk.comments)
    addRange(ranges, comment.range.start.line, comment.range.end.line, FoldingRangeKind.Comment);

  collectBodyFolds(chunk.body, ranges);
  return ranges;
};

/** Provides folding ranges for code blocks, tables, and multiline comments. */
export const setupFoldingRangeHandler = (connection: Connection, documentManager: DocumentManager): void => {
  connection.onFoldingRanges((params: FoldingRangeParams): FoldingRange[] => {
    const document = documentManager.getDocument(params.textDocument.uri);
    if (document === undefined || document.ast === undefined) return [];

    return collectFoldingRanges(document.ast);
  });
};
