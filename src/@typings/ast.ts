import type { DocComment, TokenPosition } from './parser';

export interface NodeRange {
  readonly start: TokenPosition;
  readonly end: TokenPosition;
}

export interface BaseNode {
  readonly range: NodeRange;
}

export interface DocumentedNode extends BaseNode {
  readonly docComment: DocComment | undefined;
}

export interface Chunk extends BaseNode {
  readonly kind: 'Chunk';
  readonly body: ReadonlyArray<Statement>;
  readonly comments: ReadonlyArray<Comment>;
}

export interface Comment extends BaseNode {
  readonly kind: 'Comment';
  readonly value: string;
  readonly isBlock: boolean;
}

export type Statement =
  | LocalDeclaration
  | LocalFunction
  | FunctionDeclaration
  | Assignment
  | CompoundAssignment
  | IfStatement
  | WhileStatement
  | RepeatStatement
  | ForNumeric
  | ForGeneric
  | DoStatement
  | ReturnStatement
  | BreakStatement
  | ContinueStatement
  | TypeAlias
  | ExportStatement
  | CallStatement
  | ErrorStatement;

export interface LocalDeclaration extends DocumentedNode {
  readonly kind: 'LocalDeclaration';
  readonly names: ReadonlyArray<Identifier>;
  readonly types: ReadonlyArray<TypeAnnotation | undefined>;
  readonly values: ReadonlyArray<Expression>;
}

export interface LocalFunction extends DocumentedNode {
  readonly kind: 'LocalFunction';
  readonly name: Identifier;
  readonly func: FunctionExpression;
}

export interface FunctionDeclaration extends DocumentedNode {
  readonly kind: 'FunctionDeclaration';
  readonly name: FunctionName;
  readonly func: FunctionExpression;
  readonly isLocal: boolean;
}

export interface FunctionName extends BaseNode {
  readonly kind: 'FunctionName';
  readonly base: Identifier;
  readonly path: ReadonlyArray<Identifier>;
  readonly method: Identifier | undefined;
}

export interface Assignment extends BaseNode {
  readonly kind: 'Assignment';
  readonly targets: ReadonlyArray<AssignmentTarget>;
  readonly values: ReadonlyArray<Expression>;
}

export interface CompoundAssignment extends BaseNode {
  readonly kind: 'CompoundAssignment';
  readonly target: AssignmentTarget;
  readonly operator: CompoundOperator;
  readonly value: Expression;
}

export type CompoundOperator = '+=' | '-=' | '*=' | '/=' | '//=' | '%=' | '^=' | '..=';

export type AssignmentTarget = Identifier | IndexExpression | MemberExpression;

export interface IfStatement extends BaseNode {
  readonly kind: 'IfStatement';
  readonly condition: Expression;
  readonly thenBody: ReadonlyArray<Statement>;
  readonly elseifClauses: ReadonlyArray<ElseifClause>;
  readonly elseBody: ReadonlyArray<Statement> | undefined;
}

export interface ElseifClause extends BaseNode {
  readonly kind: 'ElseifClause';
  readonly condition: Expression;
  readonly body: ReadonlyArray<Statement>;
}

export interface WhileStatement extends BaseNode {
  readonly kind: 'WhileStatement';
  readonly condition: Expression;
  readonly body: ReadonlyArray<Statement>;
}

export interface RepeatStatement extends BaseNode {
  readonly kind: 'RepeatStatement';
  readonly body: ReadonlyArray<Statement>;
  readonly condition: Expression;
}

export interface ForNumeric extends BaseNode {
  readonly kind: 'ForNumeric';
  readonly variable: Identifier;
  readonly start: Expression;
  readonly end: Expression;
  readonly step: Expression | undefined;
  readonly body: ReadonlyArray<Statement>;
}

export interface ForGeneric extends BaseNode {
  readonly kind: 'ForGeneric';
  readonly variables: ReadonlyArray<Identifier>;
  readonly iterators: ReadonlyArray<Expression>;
  readonly body: ReadonlyArray<Statement>;
}

export interface DoStatement extends BaseNode {
  readonly kind: 'DoStatement';
  readonly body: ReadonlyArray<Statement>;
}

export interface ReturnStatement extends BaseNode {
  readonly kind: 'ReturnStatement';
  readonly values: ReadonlyArray<Expression>;
}

export interface BreakStatement extends BaseNode {
  readonly kind: 'BreakStatement';
}

export interface ContinueStatement extends BaseNode {
  readonly kind: 'ContinueStatement';
}

export interface TypeAlias extends DocumentedNode {
  readonly kind: 'TypeAlias';
  readonly name: Identifier;
  readonly typeParams: ReadonlyArray<TypeParameter> | undefined;
  readonly type: TypeAnnotation;
}

export interface ExportStatement extends BaseNode {
  readonly kind: 'ExportStatement';
  readonly declaration: TypeAlias;
}

export interface CallStatement extends BaseNode {
  readonly kind: 'CallStatement';
  readonly expression: CallExpression | MethodCallExpression;
}

export interface ErrorStatement extends BaseNode {
  readonly kind: 'ErrorStatement';
  readonly message: string;
}

export type Expression =
  | Identifier
  | Literal
  | VarargExpression
  | FunctionExpression
  | TableExpression
  | BinaryExpression
  | UnaryExpression
  | CallExpression
  | MethodCallExpression
  | IndexExpression
  | MemberExpression
  | IfExpression
  | TypeCastExpression
  | InterpolatedString
  | ParenthesizedExpression
  | ErrorExpression;

export interface Identifier extends BaseNode {
  readonly kind: 'Identifier';
  readonly name: string;
}

export type Literal = NilLiteral | BooleanLiteral | NumberLiteral | StringLiteral;

export interface NilLiteral extends BaseNode {
  readonly kind: 'NilLiteral';
}

export interface BooleanLiteral extends BaseNode {
  readonly kind: 'BooleanLiteral';
  readonly value: boolean;
}

export interface NumberLiteral extends BaseNode {
  readonly kind: 'NumberLiteral';
  readonly value: number;
  readonly raw: string;
}

export interface StringLiteral extends BaseNode {
  readonly kind: 'StringLiteral';
  readonly value: string;
  readonly raw: string;
}

export interface VarargExpression extends BaseNode {
  readonly kind: 'VarargExpression';
}

export interface FunctionExpression extends BaseNode {
  readonly kind: 'FunctionExpression';
  readonly typeParams: ReadonlyArray<TypeParameter> | undefined;
  readonly params: ReadonlyArray<Parameter>;
  readonly returnType: TypeAnnotation | undefined;
  readonly body: ReadonlyArray<Statement>;
  readonly isVariadic: boolean;
}

export interface Parameter extends BaseNode {
  readonly kind: 'Parameter';
  readonly name: Identifier | undefined;
  readonly type: TypeAnnotation | undefined;
  readonly isVariadic: boolean;
}

export interface TableExpression extends BaseNode {
  readonly kind: 'TableExpression';
  readonly fields: ReadonlyArray<TableField>;
}

export type TableField = TableFieldKey | TableFieldIndex | TableFieldValue;

export interface TableFieldKey extends BaseNode {
  readonly kind: 'TableFieldKey';
  readonly key: Identifier;
  readonly value: Expression;
}

export interface TableFieldIndex extends BaseNode {
  readonly kind: 'TableFieldIndex';
  readonly index: Expression;
  readonly value: Expression;
}

export interface TableFieldValue extends BaseNode {
  readonly kind: 'TableFieldValue';
  readonly value: Expression;
}

export interface BinaryExpression extends BaseNode {
  readonly kind: 'BinaryExpression';
  readonly operator: BinaryOperator;
  readonly left: Expression;
  readonly right: Expression;
}

export type BinaryOperator =
  | '+'
  | '-'
  | '*'
  | '/'
  | '//'
  | '%'
  | '^'
  | '..'
  | '=='
  | '~='
  | '<'
  | '<='
  | '>'
  | '>='
  | 'and'
  | 'or';

export interface UnaryExpression extends BaseNode {
  readonly kind: 'UnaryExpression';
  readonly operator: UnaryOperator;
  readonly operand: Expression;
}

export type UnaryOperator = '-' | 'not' | '#';

export interface CallExpression extends BaseNode {
  readonly kind: 'CallExpression';
  readonly callee: Expression;
  readonly args: ReadonlyArray<Expression>;
}

export interface MethodCallExpression extends BaseNode {
  readonly kind: 'MethodCallExpression';
  readonly object: Expression;
  readonly method: Identifier;
  readonly args: ReadonlyArray<Expression>;
}

export interface IndexExpression extends BaseNode {
  readonly kind: 'IndexExpression';
  readonly object: Expression;
  readonly index: Expression;
}

export interface MemberExpression extends BaseNode {
  readonly kind: 'MemberExpression';
  readonly object: Expression;
  readonly property: Identifier;
}

export interface IfExpression extends BaseNode {
  readonly kind: 'IfExpression';
  readonly condition: Expression;
  readonly thenExpr: Expression;
  readonly elseifExprs: ReadonlyArray<ElseifExpressionClause>;
  readonly elseExpr: Expression;
}

export interface ElseifExpressionClause extends BaseNode {
  readonly kind: 'ElseifExpressionClause';
  readonly condition: Expression;
  readonly thenExpr: Expression;
}

export interface TypeCastExpression extends BaseNode {
  readonly kind: 'TypeCastExpression';
  readonly expression: Expression;
  readonly type: TypeAnnotation;
}

export interface InterpolatedString extends BaseNode {
  readonly kind: 'InterpolatedString';
  readonly parts: ReadonlyArray<InterpolatedStringPart>;
}

export type InterpolatedStringPart = StringLiteral | InterpolatedExpression;

export interface InterpolatedExpression extends BaseNode {
  readonly kind: 'InterpolatedExpression';
  readonly expression: Expression;
}

export interface ParenthesizedExpression extends BaseNode {
  readonly kind: 'ParenthesizedExpression';
  readonly expression: Expression;
}

export interface ErrorExpression extends BaseNode {
  readonly kind: 'ErrorExpression';
  readonly message: string;
}

export type TypeAnnotation =
  | TypeReference
  | TypeLiteral
  | FunctionType
  | TableType
  | UnionType
  | IntersectionType
  | OptionalType
  | TypeofType
  | VariadicType
  | ParenthesizedType
  | ErrorType;

export interface TypeReference extends BaseNode {
  readonly kind: 'TypeReference';
  readonly name: string;
  readonly module: string | undefined;
  readonly typeArgs: ReadonlyArray<TypeAnnotation> | undefined;
}

export interface TypeLiteral extends BaseNode {
  readonly kind: 'TypeLiteral';
  readonly value: string | boolean | number;
}

export interface FunctionType extends BaseNode {
  readonly kind: 'FunctionType';
  readonly typeParams: ReadonlyArray<TypeParameter> | undefined;
  readonly thisType: TypeAnnotation | undefined;
  readonly params: ReadonlyArray<FunctionTypeParam>;
  readonly returnType: TypeAnnotation;
  readonly isVariadic: boolean;
}

export interface FunctionTypeParam extends BaseNode {
  readonly kind: 'FunctionTypeParam';
  readonly name: string | undefined;
  readonly type: TypeAnnotation;
}

export interface TableType extends BaseNode {
  readonly kind: 'TableType';
  readonly properties: ReadonlyArray<TableTypeProperty>;
  readonly indexer: TableTypeIndexer | undefined;
}

export interface TableTypeProperty extends BaseNode {
  readonly kind: 'TableTypeProperty';
  readonly name: string;
  readonly type: TypeAnnotation;
  readonly isReadonly: boolean;
}

export interface TableTypeIndexer extends BaseNode {
  readonly kind: 'TableTypeIndexer';
  readonly keyType: TypeAnnotation;
  readonly valueType: TypeAnnotation;
}

export interface UnionType extends BaseNode {
  readonly kind: 'UnionType';
  readonly types: ReadonlyArray<TypeAnnotation>;
}

export interface IntersectionType extends BaseNode {
  readonly kind: 'IntersectionType';
  readonly types: ReadonlyArray<TypeAnnotation>;
}

export interface OptionalType extends BaseNode {
  readonly kind: 'OptionalType';
  readonly type: TypeAnnotation;
}

export interface TypeofType extends BaseNode {
  readonly kind: 'TypeofType';
  readonly expression: Expression;
}

export interface VariadicType extends BaseNode {
  readonly kind: 'VariadicType';
  readonly type: TypeAnnotation;
}

export interface ParenthesizedType extends BaseNode {
  readonly kind: 'ParenthesizedType';
  readonly type: TypeAnnotation;
}

export interface ErrorType extends BaseNode {
  readonly kind: 'ErrorType';
  readonly message: string;
}

export interface TypeParameter extends BaseNode {
  readonly kind: 'TypeParameter';
  readonly name: string;
  readonly constraint: TypeAnnotation | undefined;
  readonly defaultType: TypeAnnotation | undefined;
}
