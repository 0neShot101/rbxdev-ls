import type { BaseNode, Expression, Literal, Statement, TypeAnnotation } from '@typings/ast';

const STATEMENT_KINDS: ReadonlySet<string> = new Set([
  'LocalDeclaration',
  'LocalFunction',
  'FunctionDeclaration',
  'Assignment',
  'CompoundAssignment',
  'IfStatement',
  'WhileStatement',
  'RepeatStatement',
  'ForNumeric',
  'ForGeneric',
  'DoStatement',
  'ReturnStatement',
  'BreakStatement',
  'ContinueStatement',
  'TypeAlias',
  'ExportStatement',
  'CallStatement',
  'ErrorStatement',
]);

const EXPRESSION_KINDS: ReadonlySet<string> = new Set([
  'Identifier',
  'NilLiteral',
  'BooleanLiteral',
  'NumberLiteral',
  'StringLiteral',
  'VarargExpression',
  'FunctionExpression',
  'TableExpression',
  'BinaryExpression',
  'UnaryExpression',
  'CallExpression',
  'MethodCallExpression',
  'IndexExpression',
  'MemberExpression',
  'IfExpression',
  'TypeCastExpression',
  'InterpolatedString',
  'ParenthesizedExpression',
  'ErrorExpression',
]);

const TYPE_ANNOTATION_KINDS: ReadonlySet<string> = new Set([
  'TypeReference',
  'TypeLiteral',
  'FunctionType',
  'TableType',
  'UnionType',
  'IntersectionType',
  'OptionalType',
  'TypeofType',
  'VariadicType',
  'ParenthesizedType',
  'ErrorType',
]);

const LITERAL_NODE_KINDS: ReadonlySet<string> = new Set([
  'NilLiteral',
  'BooleanLiteral',
  'NumberLiteral',
  'StringLiteral',
]);

/** Type guard to check if a node is a Statement. */
export const isStatement = (node: BaseNode): node is Statement => STATEMENT_KINDS.has((node as Statement).kind);

/** Type guard to check if a node is an Expression. */
export const isExpression = (node: BaseNode): node is Expression => EXPRESSION_KINDS.has((node as Expression).kind);

/** Type guard to check if a node is a TypeAnnotation. */
export const isTypeAnnotation = (node: BaseNode): node is TypeAnnotation =>
  TYPE_ANNOTATION_KINDS.has((node as TypeAnnotation).kind);

/** Type guard to check if a node is a Literal. */
export const isLiteral = (node: BaseNode): node is Literal => LITERAL_NODE_KINDS.has((node as Literal).kind);
