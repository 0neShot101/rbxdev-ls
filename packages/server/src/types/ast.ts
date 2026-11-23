import type { DocComment, TokenPosition } from '@typings/parser';

/** Inclusive source span covered by a node. */
export interface NodeRange {
  readonly start: TokenPosition;
  readonly end: TokenPosition;
}

/** Fields shared by every AST node: its discriminating kind and source range. */
export interface BaseNode {
  readonly kind: string;
  readonly range: NodeRange;
}

/** Node that can carry the doc comment written directly above it. */
export interface DocumentedNode extends BaseNode {
  readonly docComment: DocComment | undefined;
}

/** Root of a parsed file: top-level statements plus every comment encountered. */
export interface Chunk extends BaseNode {
  readonly kind: 'Chunk';
  readonly body: ReadonlyArray<Statement>;
  readonly comments: ReadonlyArray<Comment>;
}

/** Line (`--`) or block (`--[[ ]]`) comment captured from the source. */
export interface Comment extends BaseNode {
  readonly kind: 'Comment';
  readonly value: string;
  readonly isBlock: boolean;
}

/** Any Luau statement node. */
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

/** Local variable declaration starting with `local` or `const`. */
export interface LocalDeclaration extends DocumentedNode {
  readonly kind: 'LocalDeclaration';
  readonly isConst: boolean;
  readonly names: ReadonlyArray<Identifier>;
  readonly types: ReadonlyArray<TypeAnnotation | undefined>;
  readonly values: ReadonlyArray<Expression>;
}

/** Local function declaration starting with `local function` or `const function`. */
export interface LocalFunction extends DocumentedNode {
  readonly kind: 'LocalFunction';
  readonly isConst: boolean;
  readonly name: Identifier;
  readonly func: FunctionExpression;
}

/** Function declaration `function a.b:c() end`. */
export interface FunctionDeclaration extends DocumentedNode {
  readonly kind: 'FunctionDeclaration';
  readonly name: FunctionName;
  readonly func: FunctionExpression;
  readonly isLocal: boolean;
}

/** Dotted and optional method path naming a declared function (`base.path:method`). */
export interface FunctionName extends BaseNode {
  readonly kind: 'FunctionName';
  readonly base: Identifier;
  readonly path: ReadonlyArray<Identifier>;
  readonly method: Identifier | undefined;
}

/** Multiple assignment `a, b = x, y`; targets are kept as parsed, so invalid left-hand sides such as calls or literals survive into the AST. */
export interface Assignment extends BaseNode {
  readonly kind: 'Assignment';
  readonly targets: ReadonlyArray<Expression>;
  readonly values: ReadonlyArray<Expression>;
}

/** Compound assignment such as `a += 1`; the target is kept as parsed, without validating its shape. */
export interface CompoundAssignment extends BaseNode {
  readonly kind: 'CompoundAssignment';
  readonly target: Expression;
  readonly operator: CompoundOperator;
  readonly value: Expression;
}

/** Luau compound assignment operators. */
export type CompoundOperator = '+=' | '-=' | '*=' | '/=' | '//=' | '%=' | '^=' | '..=';

/** `if ... then ... elseif ... else ... end` statement. */
export interface IfStatement extends BaseNode {
  readonly kind: 'IfStatement';
  readonly condition: Expression;
  readonly thenBody: ReadonlyArray<Statement>;
  readonly thenRange: NodeRange;
  readonly elseifClauses: ReadonlyArray<ElseifClause>;
  readonly elseBody: ReadonlyArray<Statement> | undefined;
}

/** One `elseif` branch of an if statement. */
export interface ElseifClause extends BaseNode {
  readonly kind: 'ElseifClause';
  readonly condition: Expression;
  readonly body: ReadonlyArray<Statement>;
}

/** `while condition do ... end` loop. */
export interface WhileStatement extends BaseNode {
  readonly kind: 'WhileStatement';
  readonly condition: Expression;
  readonly body: ReadonlyArray<Statement>;
}

/** `repeat ... until condition` loop. */
export interface RepeatStatement extends BaseNode {
  readonly kind: 'RepeatStatement';
  readonly body: ReadonlyArray<Statement>;
  readonly condition: Expression;
}

/** Numeric for loop `for i = start, end, step do ... end`. */
export interface ForNumeric extends BaseNode {
  readonly kind: 'ForNumeric';
  readonly variable: Identifier;
  readonly start: Expression;
  readonly end: Expression;
  readonly step: Expression | undefined;
  readonly body: ReadonlyArray<Statement>;
  readonly bodyStart: TokenPosition;
}

/** Generic for loop `for k, v in iterators do ... end`. */
export interface ForGeneric extends BaseNode {
  readonly kind: 'ForGeneric';
  readonly variables: ReadonlyArray<Identifier>;
  readonly iterators: ReadonlyArray<Expression>;
  readonly body: ReadonlyArray<Statement>;
  readonly bodyStart: TokenPosition;
}

/** `do ... end` block introducing a new scope. */
export interface DoStatement extends BaseNode {
  readonly kind: 'DoStatement';
  readonly body: ReadonlyArray<Statement>;
}

/** `return` statement with zero or more values. */
export interface ReturnStatement extends BaseNode {
  readonly kind: 'ReturnStatement';
  readonly values: ReadonlyArray<Expression>;
}

/** `break` statement exiting the innermost loop. */
export interface BreakStatement extends BaseNode {
  readonly kind: 'BreakStatement';
}

/** `continue` statement skipping to the next loop iteration. */
export interface ContinueStatement extends BaseNode {
  readonly kind: 'ContinueStatement';
}

/** Type alias declaration `type Name<T> = Type`. */
export interface TypeAlias extends DocumentedNode {
  readonly kind: 'TypeAlias';
  readonly name: Identifier;
  readonly typeParams: ReadonlyArray<TypeParameter> | undefined;
  readonly type: TypeAnnotation;
}

/** `export type` declaration exposing a type alias to requiring modules. */
export interface ExportStatement extends BaseNode {
  readonly kind: 'ExportStatement';
  readonly declaration: TypeAlias;
}

/** Function or method call used as a statement. */
export interface CallStatement extends BaseNode {
  readonly kind: 'CallStatement';
  readonly expression: CallExpression | MethodCallExpression;
}

/** Placeholder produced when a statement fails to parse. */
export interface ErrorStatement extends BaseNode {
  readonly kind: 'ErrorStatement';
  readonly message: string;
}

/** Any Luau expression node. */
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

/** Name reference or binding. */
export interface Identifier extends BaseNode {
  readonly kind: 'Identifier';
  readonly name: string;
}

/** Any literal value expression. */
export type Literal = NilLiteral | BooleanLiteral | NumberLiteral | StringLiteral;

/** `nil` literal. */
export interface NilLiteral extends BaseNode {
  readonly kind: 'NilLiteral';
}

/** `true` or `false` literal. */
export interface BooleanLiteral extends BaseNode {
  readonly kind: 'BooleanLiteral';
  readonly value: boolean;
}

/** Numeric literal with its parsed value and original source text. */
export interface NumberLiteral extends BaseNode {
  readonly kind: 'NumberLiteral';
  readonly value: number;
  readonly raw: string;
}

/** String literal with its unescaped value and original source text. */
export interface StringLiteral extends BaseNode {
  readonly kind: 'StringLiteral';
  readonly value: string;
  readonly raw: string;
}

/** Vararg expression `...`. */
export interface VarargExpression extends BaseNode {
  readonly kind: 'VarargExpression';
}

/** Anonymous function body, also used for named function declarations. */
export interface FunctionExpression extends BaseNode {
  readonly kind: 'FunctionExpression';
  readonly typeParams: ReadonlyArray<TypeParameter> | undefined;
  readonly params: ReadonlyArray<Parameter>;
  readonly returnType: TypeAnnotation | undefined;
  readonly body: ReadonlyArray<Statement>;
  readonly isVariadic: boolean;
}

/** Function parameter; `name` is absent for the variadic `...` parameter. */
export interface Parameter extends BaseNode {
  readonly kind: 'Parameter';
  readonly name: Identifier | undefined;
  readonly type: TypeAnnotation | undefined;
  readonly isVariadic: boolean;
}

/** Table constructor expression `{ ... }`. */
export interface TableExpression extends BaseNode {
  readonly kind: 'TableExpression';
  readonly fields: ReadonlyArray<TableField>;
}

/** Any entry inside a table constructor. */
export type TableField = TableFieldKey | TableFieldIndex | TableFieldValue;

/** Table field with an identifier key (`name = value`). */
export interface TableFieldKey extends BaseNode {
  readonly kind: 'TableFieldKey';
  readonly key: Identifier;
  readonly value: Expression;
}

/** Table field with a computed key (`[key] = value`). */
export interface TableFieldIndex extends BaseNode {
  readonly kind: 'TableFieldIndex';
  readonly index: Expression;
  readonly value: Expression;
}

/** Positional table field (`value`) appended to the array part. */
export interface TableFieldValue extends BaseNode {
  readonly kind: 'TableFieldValue';
  readonly value: Expression;
}

/** Infix operation combining two operands. */
export interface BinaryExpression extends BaseNode {
  readonly kind: 'BinaryExpression';
  readonly operator: BinaryOperator;
  readonly left: Expression;
  readonly right: Expression;
}

/** Luau infix operator symbols and keywords. */
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

/** Prefix operation applied to a single operand. */
export interface UnaryExpression extends BaseNode {
  readonly kind: 'UnaryExpression';
  readonly operator: UnaryOperator;
  readonly operand: Expression;
}

/** Luau prefix operators: negation, logical not, and length. */
export type UnaryOperator = '-' | 'not' | '#';

/** Function call `callee(args)`. */
export interface CallExpression extends BaseNode {
  readonly kind: 'CallExpression';
  readonly callee: Expression;
  readonly args: ReadonlyArray<Expression>;
}

/** Method call `object:method(args)` that passes `object` as `self`. */
export interface MethodCallExpression extends BaseNode {
  readonly kind: 'MethodCallExpression';
  readonly object: Expression;
  readonly method: Identifier;
  readonly args: ReadonlyArray<Expression>;
}

/** Bracket index access `object[index]`. */
export interface IndexExpression extends BaseNode {
  readonly kind: 'IndexExpression';
  readonly object: Expression;
  readonly index: Expression;
}

/** Dot field access `object.property`. */
export interface MemberExpression extends BaseNode {
  readonly kind: 'MemberExpression';
  readonly object: Expression;
  readonly property: Identifier;
}

/** Inline conditional `if c then a elseif d then b else e`. */
export interface IfExpression extends BaseNode {
  readonly kind: 'IfExpression';
  readonly condition: Expression;
  readonly thenExpr: Expression;
  readonly elseifExprs: ReadonlyArray<ElseifExpressionClause>;
  readonly elseExpr: Expression;
}

/** One `elseif` branch of an inline if-expression. */
export interface ElseifExpressionClause extends BaseNode {
  readonly kind: 'ElseifExpressionClause';
  readonly condition: Expression;
  readonly thenExpr: Expression;
}

/** Type assertion `expression :: Type`. */
export interface TypeCastExpression extends BaseNode {
  readonly kind: 'TypeCastExpression';
  readonly expression: Expression;
  readonly type: TypeAnnotation;
}

/** Backtick string with `{expression}` interpolations. */
export interface InterpolatedString extends BaseNode {
  readonly kind: 'InterpolatedString';
  readonly parts: ReadonlyArray<InterpolatedStringPart>;
}

/** Literal text segment or embedded expression of an interpolated string. */
export type InterpolatedStringPart = StringLiteral | InterpolatedExpression;

/** Expression embedded between braces of an interpolated string. */
export interface InterpolatedExpression extends BaseNode {
  readonly kind: 'InterpolatedExpression';
  readonly expression: Expression;
}

/** Expression wrapped in parentheses, truncating multiple returns to one value. */
export interface ParenthesizedExpression extends BaseNode {
  readonly kind: 'ParenthesizedExpression';
  readonly expression: Expression;
}

/** Placeholder produced when an expression fails to parse. */
export interface ErrorExpression extends BaseNode {
  readonly kind: 'ErrorExpression';
  readonly message: string;
}

/** Any Luau type annotation node. */
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

/** Named type reference, optionally module-qualified and generic (`module.Name<T>`). */
export interface TypeReference extends BaseNode {
  readonly kind: 'TypeReference';
  readonly name: string;
  readonly module: string | undefined;
  readonly typeArgs: ReadonlyArray<TypeAnnotation> | undefined;
}

/** Singleton string literal type such as `"text"`. */
export interface StringTypeLiteral extends BaseNode {
  readonly kind: 'TypeLiteral';
  readonly baseType: 'string';
  readonly value: string;
}

/** Singleton number literal type such as `1`. */
export interface NumberTypeLiteral extends BaseNode {
  readonly kind: 'TypeLiteral';
  readonly baseType: 'number';
  readonly value: number;
}

/** Singleton boolean literal type `true` or `false`. */
export interface BooleanTypeLiteral extends BaseNode {
  readonly kind: 'TypeLiteral';
  readonly baseType: 'boolean';
  readonly value: boolean;
}

/** Singleton literal type, discriminated by `baseType`. */
export type TypeLiteral = StringTypeLiteral | NumberTypeLiteral | BooleanTypeLiteral;

/** Function type signature `<T>(params) -> Return`. */
export interface FunctionType extends BaseNode {
  readonly kind: 'FunctionType';
  readonly typeParams: ReadonlyArray<TypeParameter> | undefined;
  readonly thisType: TypeAnnotation | undefined;
  readonly params: ReadonlyArray<FunctionTypeParam>;
  readonly returnType: TypeAnnotation;
  readonly isVariadic: boolean;
}

/** Parameter of a function type, optionally named. */
export interface FunctionTypeParam extends BaseNode {
  readonly kind: 'FunctionTypeParam';
  readonly name: string | undefined;
  readonly type: TypeAnnotation;
}

/** Table type `{ property: T, [K]: V }`. */
export interface TableType extends BaseNode {
  readonly kind: 'TableType';
  readonly properties: ReadonlyArray<TableTypeProperty>;
  readonly indexer: TableTypeIndexer | undefined;
}

/** Named property inside a table type. */
export interface TableTypeProperty extends BaseNode {
  readonly kind: 'TableTypeProperty';
  readonly name: string;
  readonly type: TypeAnnotation;
  readonly isReadonly: boolean;
}

/** Indexer signature `[K]: V` inside a table type. */
export interface TableTypeIndexer extends BaseNode {
  readonly kind: 'TableTypeIndexer';
  readonly keyType: TypeAnnotation;
  readonly valueType: TypeAnnotation;
}

/** Union of types `A | B`. */
export interface UnionType extends BaseNode {
  readonly kind: 'UnionType';
  readonly types: ReadonlyArray<TypeAnnotation>;
}

/** Intersection of types `A & B`. */
export interface IntersectionType extends BaseNode {
  readonly kind: 'IntersectionType';
  readonly types: ReadonlyArray<TypeAnnotation>;
}

/** Optional type `T?`, equivalent to `T | nil`. */
export interface OptionalType extends BaseNode {
  readonly kind: 'OptionalType';
  readonly type: TypeAnnotation;
}

/** Type derived from an expression via `typeof(expression)`. */
export interface TypeofType extends BaseNode {
  readonly kind: 'TypeofType';
  readonly expression: Expression;
}

/** Variadic type pack `...T`. */
export interface VariadicType extends BaseNode {
  readonly kind: 'VariadicType';
  readonly type: TypeAnnotation;
}

/** Type wrapped in parentheses. */
export interface ParenthesizedType extends BaseNode {
  readonly kind: 'ParenthesizedType';
  readonly type: TypeAnnotation;
}

/** Placeholder produced when a type annotation fails to parse. */
export interface ErrorType extends BaseNode {
  readonly kind: 'ErrorType';
  readonly message: string;
}

/** Generic type parameter with optional constraint and default. */
export interface TypeParameter extends BaseNode {
  readonly kind: 'TypeParameter';
  readonly name: string;
  readonly constraint: TypeAnnotation | undefined;
  readonly defaultType: TypeAnnotation | undefined;
}

/** Every node kind the visitor dispatches on: chunk root, comments, statements, expressions, and type annotations. */
export type VisitableNode = Chunk | Comment | Statement | Expression | TypeAnnotation;
