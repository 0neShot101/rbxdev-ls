import type {
  Assignment,
  BaseNode,
  BinaryExpression,
  BooleanLiteral,
  BreakStatement,
  CallExpression,
  CallStatement,
  Chunk,
  Comment,
  CompoundAssignment,
  ContinueStatement,
  DoStatement,
  ErrorExpression,
  ErrorStatement,
  ErrorType,
  ExportStatement,
  Expression,
  ForGeneric,
  ForNumeric,
  FunctionDeclaration,
  FunctionExpression,
  FunctionType,
  Identifier,
  IfExpression,
  IfStatement,
  IndexExpression,
  InterpolatedString,
  IntersectionType,
  LocalDeclaration,
  LocalFunction,
  MemberExpression,
  MethodCallExpression,
  NilLiteral,
  NumberLiteral,
  OptionalType,
  ParenthesizedExpression,
  ParenthesizedType,
  RepeatStatement,
  ReturnStatement,
  Statement,
  StringLiteral,
  TableExpression,
  TableType,
  TypeAlias,
  TypeAnnotation,
  TypeCastExpression,
  TypeLiteral,
  TypeofType,
  TypeReference,
  UnaryExpression,
  UnionType,
  VarargExpression,
  VariadicType,
  WhileStatement,
} from '@typings/ast';
import type { Visitor } from '@typings/parser';

/** Visits a single AST node by dispatching to the appropriate visitor method based on node kind. */
export const visit = <T>(node: BaseNode, visitor: Visitor<T>): T | undefined => {
  const nodeWithKind = node as unknown as { kind: string };

  switch (nodeWithKind.kind) {
    case 'Chunk':
      return visitor.visitChunk?.(node as Chunk);
    case 'Comment':
      return visitor.visitComment?.(node as Comment);

    case 'LocalDeclaration':
      return visitor.visitLocalDeclaration?.(node as LocalDeclaration);
    case 'LocalFunction':
      return visitor.visitLocalFunction?.(node as LocalFunction);
    case 'FunctionDeclaration':
      return visitor.visitFunctionDeclaration?.(node as FunctionDeclaration);
    case 'Assignment':
      return visitor.visitAssignment?.(node as Assignment);
    case 'CompoundAssignment':
      return visitor.visitCompoundAssignment?.(node as CompoundAssignment);
    case 'IfStatement':
      return visitor.visitIfStatement?.(node as IfStatement);
    case 'WhileStatement':
      return visitor.visitWhileStatement?.(node as WhileStatement);
    case 'RepeatStatement':
      return visitor.visitRepeatStatement?.(node as RepeatStatement);
    case 'ForNumeric':
      return visitor.visitForNumeric?.(node as ForNumeric);
    case 'ForGeneric':
      return visitor.visitForGeneric?.(node as ForGeneric);
    case 'DoStatement':
      return visitor.visitDoStatement?.(node as DoStatement);
    case 'ReturnStatement':
      return visitor.visitReturnStatement?.(node as ReturnStatement);
    case 'BreakStatement':
      return visitor.visitBreakStatement?.(node as BreakStatement);
    case 'ContinueStatement':
      return visitor.visitContinueStatement?.(node as ContinueStatement);
    case 'TypeAlias':
      return visitor.visitTypeAlias?.(node as TypeAlias);
    case 'ExportStatement':
      return visitor.visitExportStatement?.(node as ExportStatement);
    case 'CallStatement':
      return visitor.visitCallStatement?.(node as CallStatement);
    case 'ErrorStatement':
      return visitor.visitErrorStatement?.(node as ErrorStatement);

    case 'Identifier':
      return visitor.visitIdentifier?.(node as Identifier);
    case 'NilLiteral':
      return visitor.visitNilLiteral?.(node as NilLiteral);
    case 'BooleanLiteral':
      return visitor.visitBooleanLiteral?.(node as BooleanLiteral);
    case 'NumberLiteral':
      return visitor.visitNumberLiteral?.(node as NumberLiteral);
    case 'StringLiteral':
      return visitor.visitStringLiteral?.(node as StringLiteral);
    case 'VarargExpression':
      return visitor.visitVarargExpression?.(node as VarargExpression);
    case 'FunctionExpression':
      return visitor.visitFunctionExpression?.(node as FunctionExpression);
    case 'TableExpression':
      return visitor.visitTableExpression?.(node as TableExpression);
    case 'BinaryExpression':
      return visitor.visitBinaryExpression?.(node as BinaryExpression);
    case 'UnaryExpression':
      return visitor.visitUnaryExpression?.(node as UnaryExpression);
    case 'CallExpression':
      return visitor.visitCallExpression?.(node as CallExpression);
    case 'MethodCallExpression':
      return visitor.visitMethodCallExpression?.(node as MethodCallExpression);
    case 'IndexExpression':
      return visitor.visitIndexExpression?.(node as IndexExpression);
    case 'MemberExpression':
      return visitor.visitMemberExpression?.(node as MemberExpression);
    case 'IfExpression':
      return visitor.visitIfExpression?.(node as IfExpression);
    case 'TypeCastExpression':
      return visitor.visitTypeCastExpression?.(node as TypeCastExpression);
    case 'InterpolatedString':
      return visitor.visitInterpolatedString?.(node as InterpolatedString);
    case 'ParenthesizedExpression':
      return visitor.visitParenthesizedExpression?.(node as ParenthesizedExpression);
    case 'ErrorExpression':
      return visitor.visitErrorExpression?.(node as ErrorExpression);

    case 'TypeReference':
      return visitor.visitTypeReference?.(node as TypeReference);
    case 'TypeLiteral':
      return visitor.visitTypeLiteral?.(node as TypeLiteral);
    case 'FunctionType':
      return visitor.visitFunctionType?.(node as FunctionType);
    case 'TableType':
      return visitor.visitTableType?.(node as TableType);
    case 'UnionType':
      return visitor.visitUnionType?.(node as UnionType);
    case 'IntersectionType':
      return visitor.visitIntersectionType?.(node as IntersectionType);
    case 'OptionalType':
      return visitor.visitOptionalType?.(node as OptionalType);
    case 'TypeofType':
      return visitor.visitTypeofType?.(node as TypeofType);
    case 'VariadicType':
      return visitor.visitVariadicType?.(node as VariadicType);
    case 'ParenthesizedType':
      return visitor.visitParenthesizedType?.(node as ParenthesizedType);
    case 'ErrorType':
      return visitor.visitErrorType?.(node as ErrorType);

    default:
      return undefined;
  }
};

/** Recursively walks a statement and all its child nodes, invoking visitor methods along the way. */
export const walkStatement = (stmt: Statement, visitor: Visitor): void => {
  visit(stmt, visitor);

  switch (stmt.kind) {
    case 'LocalDeclaration':
      for (const name of stmt.names) visit(name, visitor);
      for (const type of stmt.types) if (type !== undefined) walkType(type, visitor);
      for (const value of stmt.values) walkExpression(value, visitor);
      break;

    case 'LocalFunction':
      visit(stmt.name, visitor);
      walkExpression(stmt.func, visitor);
      break;

    case 'FunctionDeclaration':
      visit(stmt.name.base, visitor);
      for (const p of stmt.name.path) visit(p, visitor);
      if (stmt.name.method !== undefined) visit(stmt.name.method, visitor);
      walkExpression(stmt.func, visitor);
      break;

    case 'Assignment':
      for (const target of stmt.targets) walkExpression(target, visitor);
      for (const value of stmt.values) walkExpression(value, visitor);
      break;

    case 'CompoundAssignment':
      walkExpression(stmt.target, visitor);
      walkExpression(stmt.value, visitor);
      break;

    case 'IfStatement':
      walkExpression(stmt.condition, visitor);
      for (const s of stmt.thenBody) walkStatement(s, visitor);
      for (const clause of stmt.elseifClauses) {
        walkExpression(clause.condition, visitor);
        for (const s of clause.body) walkStatement(s, visitor);
      }
      if (stmt.elseBody !== undefined) {
        for (const s of stmt.elseBody) walkStatement(s, visitor);
      }
      break;

    case 'WhileStatement':
      walkExpression(stmt.condition, visitor);
      for (const s of stmt.body) walkStatement(s, visitor);
      break;

    case 'RepeatStatement':
      for (const s of stmt.body) walkStatement(s, visitor);
      walkExpression(stmt.condition, visitor);
      break;

    case 'ForNumeric':
      visit(stmt.variable, visitor);
      walkExpression(stmt.start, visitor);
      walkExpression(stmt.end, visitor);
      if (stmt.step !== undefined) walkExpression(stmt.step, visitor);
      for (const s of stmt.body) walkStatement(s, visitor);
      break;

    case 'ForGeneric':
      for (const v of stmt.variables) visit(v, visitor);
      for (const iter of stmt.iterators) walkExpression(iter, visitor);
      for (const s of stmt.body) walkStatement(s, visitor);
      break;

    case 'DoStatement':
      for (const s of stmt.body) walkStatement(s, visitor);
      break;

    case 'ReturnStatement':
      for (const value of stmt.values) walkExpression(value, visitor);
      break;

    case 'TypeAlias':
      visit(stmt.name, visitor);
      walkType(stmt.type, visitor);
      break;

    case 'ExportStatement':
      walkStatement(stmt.declaration, visitor);
      break;

    case 'CallStatement':
      walkExpression(stmt.expression, visitor);
      break;
  }
};

/** Recursively walks an expression and all its child nodes, invoking visitor methods along the way. */
export const walkExpression = (expr: Expression, visitor: Visitor): void => {
  visit(expr, visitor);

  switch (expr.kind) {
    case 'FunctionExpression':
      for (const param of expr.params) {
        if (param.name !== undefined) visit(param.name, visitor);
        if (param.type !== undefined) walkType(param.type, visitor);
      }
      if (expr.returnType !== undefined) walkType(expr.returnType, visitor);
      for (const s of expr.body) walkStatement(s, visitor);
      break;

    case 'TableExpression':
      for (const field of expr.fields) {
        switch (field.kind) {
          case 'TableFieldKey':
            visit(field.key, visitor);
            walkExpression(field.value, visitor);
            break;
          case 'TableFieldIndex':
            walkExpression(field.index, visitor);
            walkExpression(field.value, visitor);
            break;
          case 'TableFieldValue':
            walkExpression(field.value, visitor);
            break;
        }
      }
      break;

    case 'BinaryExpression':
      walkExpression(expr.left, visitor);
      walkExpression(expr.right, visitor);
      break;

    case 'UnaryExpression':
      walkExpression(expr.operand, visitor);
      break;

    case 'CallExpression':
      walkExpression(expr.callee, visitor);
      for (const arg of expr.args) walkExpression(arg, visitor);
      break;

    case 'MethodCallExpression':
      walkExpression(expr.object, visitor);
      visit(expr.method, visitor);
      for (const arg of expr.args) walkExpression(arg, visitor);
      break;

    case 'IndexExpression':
      walkExpression(expr.object, visitor);
      walkExpression(expr.index, visitor);
      break;

    case 'MemberExpression':
      walkExpression(expr.object, visitor);
      visit(expr.property, visitor);
      break;

    case 'IfExpression':
      walkExpression(expr.condition, visitor);
      walkExpression(expr.thenExpr, visitor);
      for (const clause of expr.elseifExprs) {
        walkExpression(clause.condition, visitor);
        walkExpression(clause.thenExpr, visitor);
      }
      walkExpression(expr.elseExpr, visitor);
      break;

    case 'TypeCastExpression':
      walkExpression(expr.expression, visitor);
      walkType(expr.type, visitor);
      break;

    case 'InterpolatedString':
      for (const part of expr.parts) {
        if (part.kind === 'InterpolatedExpression') {
          walkExpression(part.expression, visitor);
        }
      }
      break;

    case 'ParenthesizedExpression':
      walkExpression(expr.expression, visitor);
      break;
  }
};

/** Recursively walks a type annotation and all its child types, invoking visitor methods along the way. */
export const walkType = (type: TypeAnnotation, visitor: Visitor): void => {
  visit(type, visitor);

  switch (type.kind) {
    case 'FunctionType':
      if (type.thisType !== undefined) walkType(type.thisType, visitor);
      for (const param of type.params) walkType(param.type, visitor);
      walkType(type.returnType, visitor);
      break;

    case 'TableType':
      for (const prop of type.properties) walkType(prop.type, visitor);
      if (type.indexer !== undefined) {
        walkType(type.indexer.keyType, visitor);
        walkType(type.indexer.valueType, visitor);
      }
      break;

    case 'UnionType':
    case 'IntersectionType':
      for (const t of type.types) walkType(t, visitor);
      break;

    case 'OptionalType':
    case 'VariadicType':
    case 'ParenthesizedType':
      walkType(type.type, visitor);
      break;

    case 'TypeofType':
      walkExpression(type.expression, visitor);
      break;

    case 'TypeReference':
      if (type.typeArgs !== undefined) {
        for (const arg of type.typeArgs) walkType(arg, visitor);
      }
      break;
  }
};

/** Walks the entire AST starting from the chunk root, visiting all nodes including comments. */
export const walk = (chunk: Chunk, visitor: Visitor): void => {
  visit(chunk, visitor);

  for (const comment of chunk.comments) {
    visit(comment, visitor);
  }

  for (const stmt of chunk.body) {
    walkStatement(stmt, visitor);
  }
};
