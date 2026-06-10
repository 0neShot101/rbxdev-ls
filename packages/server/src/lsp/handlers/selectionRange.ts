import type { Chunk, Expression, Statement, TypeAnnotation } from '@typings/ast';
import type { AstRange } from '@typings/handlers';
import type { DocumentManager } from '@typings/lsp';
import type { Connection, SelectionRange, SelectionRangeParams } from 'vscode-languageserver';

const containsPosition = (
  line: number,
  character: number,
  range: { start: { line: number; column: number }; end: { line: number; column: number } },
): boolean => {
  const startLine = range.start.line - 1;
  const endLine = range.end.line - 1;
  const startChar = range.start.column - 1;
  const endChar = range.end.column - 1;

  if (line < startLine || line > endLine) return false;
  if (line === startLine && character < startChar) return false;
  if (line === endLine && character > endChar) return false;
  return true;
};

const toAstRange = (range: {
  start: { line: number; column: number };
  end: { line: number; column: number };
}): AstRange => ({
  'startLine': range.start.line - 1,
  'startCharacter': range.start.column - 1,
  'endLine': range.end.line - 1,
  'endCharacter': range.end.column - 1,
});

/**
 * Collects all AST node ranges that contain the given position, ordered from innermost to outermost.
 * @param chunk - The parsed AST chunk to scan.
 * @param line - The zero-based line number.
 * @param character - The zero-based character offset.
 * @returns An array of AST ranges containing the position.
 */
export const collectContainingRanges = (chunk: Chunk, line: number, character: number): AstRange[] => {
  const ranges: AstRange[] = [];

  const checkNode = (range: { start: { line: number; column: number }; end: { line: number; column: number } }) => {
    if (containsPosition(line, character, range)) ranges.push(toAstRange(range));
  };

  const walkExpr = (expr: Expression): void => {
    if (containsPosition(line, character, expr.range) === false) return;
    checkNode(expr.range);

    switch (expr.kind) {
      case 'FunctionExpression':
        for (const param of expr.params) checkNode(param.range);
        walkBody(expr.body);
        break;

      case 'TableExpression':
        for (const field of expr.fields) {
          checkNode(field.range);
          if (field.kind === 'TableFieldKey') {
            walkExpr(field.key);
            walkExpr(field.value);
          } else if (field.kind === 'TableFieldIndex') {
            walkExpr(field.index);
            walkExpr(field.value);
          } else if (field.kind === 'TableFieldValue') walkExpr(field.value);
        }
        break;

      case 'CallExpression':
        walkExpr(expr.callee);
        for (const arg of expr.args) walkExpr(arg);
        break;

      case 'MethodCallExpression':
        walkExpr(expr.object);
        for (const arg of expr.args) walkExpr(arg);
        break;

      case 'BinaryExpression':
        walkExpr(expr.left);
        walkExpr(expr.right);
        break;

      case 'UnaryExpression':
        walkExpr(expr.operand);
        break;

      case 'IfExpression':
        walkExpr(expr.condition);
        walkExpr(expr.thenExpr);
        walkExpr(expr.elseExpr);
        break;

      case 'ParenthesizedExpression':
        walkExpr(expr.expression);
        break;

      case 'IndexExpression':
        walkExpr(expr.object);
        walkExpr(expr.index);
        break;

      case 'MemberExpression':
        walkExpr(expr.object);
        break;

      case 'TypeCastExpression':
        walkExpr(expr.expression);
        walkType(expr.type);
        break;

      case 'InterpolatedString':
        for (const part of expr.parts) if (part.kind === 'InterpolatedExpression') walkExpr(part.expression);
        break;
    }
  };

  const walkType = (type: TypeAnnotation): void => {
    if (containsPosition(line, character, type.range) === false) return;
    checkNode(type.range);

    switch (type.kind) {
      case 'FunctionType':
        for (const param of type.params) if (param.type !== undefined) walkType(param.type);
        if (type.returnType !== undefined) walkType(type.returnType);
        break;

      case 'TableType':
        for (const prop of type.properties) walkType(prop.type);
        if (type.indexer !== undefined) {
          walkType(type.indexer.keyType);
          walkType(type.indexer.valueType);
        }
        break;

      case 'UnionType':
      case 'IntersectionType':
        for (const member of type.types) walkType(member);
        break;

      case 'OptionalType':
      case 'VariadicType':
      case 'ParenthesizedType':
        walkType(type.type);
        break;

      case 'TypeofType':
        walkExpr(type.expression);
        break;

      case 'TypeReference':
        if (type.typeArgs !== undefined) for (const arg of type.typeArgs) walkType(arg);
        break;
    }
  };

  const walkStmt = (stmt: Statement): void => {
    if (containsPosition(line, character, stmt.range) === false) return;
    checkNode(stmt.range);

    switch (stmt.kind) {
      case 'LocalDeclaration':
        for (const name of stmt.names) checkNode(name.range);
        for (const value of stmt.values) walkExpr(value);
        break;

      case 'LocalFunction':
        checkNode(stmt.name.range);
        for (const param of stmt.func.params) checkNode(param.range);
        walkBody(stmt.func.body);
        break;

      case 'FunctionDeclaration':
        checkNode(stmt.name.base.range);
        for (const param of stmt.func.params) checkNode(param.range);
        walkBody(stmt.func.body);
        break;

      case 'Assignment':
        for (const target of stmt.targets) walkExpr(target);
        for (const value of stmt.values) walkExpr(value);
        break;

      case 'CompoundAssignment':
        walkExpr(stmt.target);
        walkExpr(stmt.value);
        break;

      case 'IfStatement':
        walkExpr(stmt.condition);
        walkBody(stmt.thenBody);
        for (const clause of stmt.elseifClauses) {
          walkExpr(clause.condition);
          walkBody(clause.body);
        }
        if (stmt.elseBody !== undefined) walkBody(stmt.elseBody);
        break;

      case 'WhileStatement':
        walkExpr(stmt.condition);
        walkBody(stmt.body);
        break;

      case 'RepeatStatement':
        walkBody(stmt.body);
        walkExpr(stmt.condition);
        break;

      case 'ForNumeric':
        checkNode(stmt.variable.range);
        walkExpr(stmt.start);
        walkExpr(stmt.end);
        if (stmt.step !== undefined) walkExpr(stmt.step);
        walkBody(stmt.body);
        break;

      case 'ForGeneric':
        for (const v of stmt.variables) checkNode(v.range);
        for (const iter of stmt.iterators) walkExpr(iter);
        walkBody(stmt.body);
        break;

      case 'DoStatement':
        walkBody(stmt.body);
        break;

      case 'ReturnStatement':
        for (const value of stmt.values) walkExpr(value);
        break;

      case 'CallStatement':
        walkExpr(stmt.expression);
        break;

      case 'TypeAlias':
        checkNode(stmt.name.range);
        walkType(stmt.type);
        break;

      case 'ExportStatement':
        walkStmt(stmt.declaration);
        break;
    }
  };

  const walkBody = (stmts: ReadonlyArray<Statement>): void => {
    for (const stmt of stmts) walkStmt(stmt);
  };

  checkNode(chunk.range);
  walkBody(chunk.body);

  return ranges;
};

const rangesEqual = (a: AstRange, b: AstRange): boolean =>
  a.startLine === b.startLine &&
  a.startCharacter === b.startCharacter &&
  a.endLine === b.endLine &&
  a.endCharacter === b.endCharacter;

const rangeSize = (r: AstRange): number => (r.endLine - r.startLine) * 100000 + (r.endCharacter - r.startCharacter);

/** Provides smart selection ranges for expand/shrink selection based on AST structure. */
export const setupSelectionRangeHandler = (connection: Connection, documentManager: DocumentManager): void => {
  connection.onSelectionRanges((params: SelectionRangeParams): SelectionRange[] => {
    const document = documentManager.getDocument(params.textDocument.uri);
    if (document === undefined || document.ast === undefined) return [];

    return params.positions.map(position => {
      const ranges = collectContainingRanges(document.ast!, position.line, position.character);

      ranges.sort((a, b) => rangeSize(b) - rangeSize(a));

      const deduped: AstRange[] = [];
      for (const r of ranges)
        if (deduped.length === 0 || rangesEqual(r, deduped[deduped.length - 1]!) === false) deduped.push(r);

      let current: SelectionRange | undefined;
      for (const r of deduped) {
        const range = {
          'start': { 'line': r.startLine, 'character': r.startCharacter },
          'end': { 'line': r.endLine, 'character': r.endCharacter },
        };

        if (current === undefined) current = { range };
        else current = { range, 'parent': current };
      }

      if (current === undefined)
        return {
          'range': {
            'start': { 'line': position.line, 'character': position.character },
            'end': { 'line': position.line, 'character': position.character },
          },
        };

      return current;
    });
  });
};
