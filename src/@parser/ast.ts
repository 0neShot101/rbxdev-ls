/**
 * Luau AST Node Definitions
 */

import type { DocComment } from './docComment';
import type { TokenPosition } from './tokens';

/**
 * Represents a source code range with start and end positions.
 * Used to track the exact location of AST nodes within the source file.
 */
export interface NodeRange {
  /** The starting position of the range in the source */
  readonly start: TokenPosition;
  /** The ending position of the range in the source */
  readonly end: TokenPosition;
}

/**
 * The foundational interface for all AST nodes.
 * Every node in the AST tree extends this interface.
 */
export interface BaseNode {
  /** The source range indicating where this node appears in the source code */
  readonly range: NodeRange;
}

/**
 * Extends BaseNode with optional documentation comment support.
 * Used for nodes that can have JSDoc-style comments attached.
 */
export interface DocumentedNode extends BaseNode {
  /** The documentation comment attached to this node, if present */
  readonly docComment: DocComment | undefined;
}

/**
 * Represents the root node of a parsed Luau source file.
 * Contains all statements and comments found in the file.
 */
export interface Chunk extends BaseNode {
  /** Discriminator for the Chunk node type */
  readonly kind: 'Chunk';
  /** The list of statements that make up the program body */
  readonly body: ReadonlyArray<Statement>;
  /** All comments found in the source file */
  readonly comments: ReadonlyArray<Comment>;
}

/**
 * Represents a comment in the source code.
 * Can be either a single-line or block comment.
 */
export interface Comment extends BaseNode {
  /** Discriminator for the Comment node type */
  readonly kind: 'Comment';
  /** The text content of the comment, excluding delimiters */
  readonly value: string;
  /** Whether this is a block comment (--[[ ]]) or line comment (--) */
  readonly isBlock: boolean;
}

/**
 * Union type representing all possible statement node types in Luau.
 * Statements are executable units of code that perform actions.
 */
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

/**
 * Represents a local variable declaration statement.
 * Example: `local x, y: number = 1, 2`
 */
export interface LocalDeclaration extends DocumentedNode {
  /** Discriminator for the LocalDeclaration node type */
  readonly kind: 'LocalDeclaration';
  /** The names of the variables being declared */
  readonly names: ReadonlyArray<Identifier>;
  /** Type annotations for each variable, may contain undefined entries */
  readonly types: ReadonlyArray<TypeAnnotation | undefined>;
  /** The initializer expressions for the variables */
  readonly values: ReadonlyArray<Expression>;
}

/**
 * Represents a local function declaration.
 * Example: `local function foo() end`
 */
export interface LocalFunction extends DocumentedNode {
  /** Discriminator for the LocalFunction node type */
  readonly kind: 'LocalFunction';
  /** The identifier name of the function */
  readonly name: Identifier;
  /** The function expression containing parameters, body, and return type */
  readonly func: FunctionExpression;
}

/**
 * Represents a function declaration statement.
 * Can be local or global, and may have a complex name path.
 */
export interface FunctionDeclaration extends DocumentedNode {
  /** Discriminator for the FunctionDeclaration node type */
  readonly kind: 'FunctionDeclaration';
  /** The full name of the function, possibly including module path and method */
  readonly name: FunctionName;
  /** The function expression containing parameters, body, and return type */
  readonly func: FunctionExpression;
  /** Whether this is a local function declaration */
  readonly isLocal: boolean;
}

/**
 * Represents the name portion of a function declaration.
 * Supports complex names like `module.submodule:method`.
 */
export interface FunctionName extends BaseNode {
  /** Discriminator for the FunctionName node type */
  readonly kind: 'FunctionName';
  /** The base identifier of the function name */
  readonly base: Identifier;
  /** Additional path components (e.g., `submodule` in `module.submodule`) */
  readonly path: ReadonlyArray<Identifier>;
  /** The method name if using colon syntax (e.g., `method` in `obj:method`) */
  readonly method: Identifier | undefined;
}

/**
 * Represents a variable assignment statement.
 * Example: `x, y = 1, 2`
 */
export interface Assignment extends BaseNode {
  /** Discriminator for the Assignment node type */
  readonly kind: 'Assignment';
  /** The variables or expressions being assigned to */
  readonly targets: ReadonlyArray<AssignmentTarget>;
  /** The values being assigned */
  readonly values: ReadonlyArray<Expression>;
}

/**
 * Represents a compound assignment statement.
 * Example: `x += 1`
 */
export interface CompoundAssignment extends BaseNode {
  /** Discriminator for the CompoundAssignment node type */
  readonly kind: 'CompoundAssignment';
  /** The variable or expression being assigned to */
  readonly target: AssignmentTarget;
  /** The compound assignment operator */
  readonly operator: CompoundOperator;
  /** The value to combine with the target */
  readonly value: Expression;
}

/**
 * Union type representing all compound assignment operators in Luau.
 * These operators combine an arithmetic/string operation with assignment.
 */
export type CompoundOperator = '+=' | '-=' | '*=' | '/=' | '//=' | '%=' | '^=' | '..=';

/**
 * Union type representing valid targets for assignment operations.
 * Can be an identifier, index expression, or member expression.
 */
export type AssignmentTarget = Identifier | IndexExpression | MemberExpression;

/**
 * Represents an if-then-elseif-else control flow statement.
 */
export interface IfStatement extends BaseNode {
  /** Discriminator for the IfStatement node type */
  readonly kind: 'IfStatement';
  /** The condition expression for the if branch */
  readonly condition: Expression;
  /** The statements to execute when condition is truthy */
  readonly thenBody: ReadonlyArray<Statement>;
  /** The elseif clauses, if any */
  readonly elseifClauses: ReadonlyArray<ElseifClause>;
  /** The statements to execute in the else branch, if present */
  readonly elseBody: ReadonlyArray<Statement> | undefined;
}

/**
 * Represents an elseif clause within an if statement.
 */
export interface ElseifClause extends BaseNode {
  /** Discriminator for the ElseifClause node type */
  readonly kind: 'ElseifClause';
  /** The condition expression for this elseif branch */
  readonly condition: Expression;
  /** The statements to execute when this condition is truthy */
  readonly body: ReadonlyArray<Statement>;
}

/**
 * Represents a while loop statement.
 * Example: `while condition do ... end`
 */
export interface WhileStatement extends BaseNode {
  /** Discriminator for the WhileStatement node type */
  readonly kind: 'WhileStatement';
  /** The condition expression evaluated before each iteration */
  readonly condition: Expression;
  /** The statements to execute while condition is truthy */
  readonly body: ReadonlyArray<Statement>;
}

/**
 * Represents a repeat-until loop statement.
 * Example: `repeat ... until condition`
 */
export interface RepeatStatement extends BaseNode {
  /** Discriminator for the RepeatStatement node type */
  readonly kind: 'RepeatStatement';
  /** The statements to execute each iteration */
  readonly body: ReadonlyArray<Statement>;
  /** The condition expression evaluated after each iteration */
  readonly condition: Expression;
}

/**
 * Represents a numeric for loop statement.
 * Example: `for i = 1, 10, 2 do ... end`
 */
export interface ForNumeric extends BaseNode {
  /** Discriminator for the ForNumeric node type */
  readonly kind: 'ForNumeric';
  /** The loop variable identifier */
  readonly variable: Identifier;
  /** The starting value expression */
  readonly start: Expression;
  /** The ending value expression */
  readonly end: Expression;
  /** The step value expression, if specified */
  readonly step: Expression | undefined;
  /** The statements to execute each iteration */
  readonly body: ReadonlyArray<Statement>;
}

/**
 * Represents a generic for loop statement.
 * Example: `for k, v in pairs(t) do ... end`
 */
export interface ForGeneric extends BaseNode {
  /** Discriminator for the ForGeneric node type */
  readonly kind: 'ForGeneric';
  /** The loop variable identifiers */
  readonly variables: ReadonlyArray<Identifier>;
  /** The iterator expressions */
  readonly iterators: ReadonlyArray<Expression>;
  /** The statements to execute each iteration */
  readonly body: ReadonlyArray<Statement>;
}

/**
 * Represents a do-end block statement.
 * Creates a new scope for the enclosed statements.
 */
export interface DoStatement extends BaseNode {
  /** Discriminator for the DoStatement node type */
  readonly kind: 'DoStatement';
  /** The statements within the do block */
  readonly body: ReadonlyArray<Statement>;
}

/**
 * Represents a return statement.
 * Example: `return x, y`
 */
export interface ReturnStatement extends BaseNode {
  /** Discriminator for the ReturnStatement node type */
  readonly kind: 'ReturnStatement';
  /** The values being returned */
  readonly values: ReadonlyArray<Expression>;
}

/**
 * Represents a break statement to exit from a loop.
 */
export interface BreakStatement extends BaseNode {
  /** Discriminator for the BreakStatement node type */
  readonly kind: 'BreakStatement';
}

/**
 * Represents a continue statement to skip to the next loop iteration.
 */
export interface ContinueStatement extends BaseNode {
  /** Discriminator for the ContinueStatement node type */
  readonly kind: 'ContinueStatement';
}

/**
 * Represents a type alias declaration.
 * Example: `type MyType<T> = { value: T }`
 */
export interface TypeAlias extends DocumentedNode {
  /** Discriminator for the TypeAlias node type */
  readonly kind: 'TypeAlias';
  /** The name of the type alias */
  readonly name: Identifier;
  /** Generic type parameters for the alias, if any */
  readonly typeParams: ReadonlyArray<TypeParameter> | undefined;
  /** The type annotation this alias refers to */
  readonly type: TypeAnnotation;
}

/**
 * Represents an export statement for type aliases.
 * Example: `export type MyType = number`
 */
export interface ExportStatement extends BaseNode {
  /** Discriminator for the ExportStatement node type */
  readonly kind: 'ExportStatement';
  /** The type alias being exported */
  readonly declaration: TypeAlias;
}

/**
 * Represents a standalone function or method call statement.
 * Example: `print("hello")`
 */
export interface CallStatement extends BaseNode {
  /** Discriminator for the CallStatement node type */
  readonly kind: 'CallStatement';
  /** The call expression being executed */
  readonly expression: CallExpression | MethodCallExpression;
}

/**
 * Represents a parsing error that was encountered while processing a statement.
 */
export interface ErrorStatement extends BaseNode {
  /** Discriminator for the ErrorStatement node type */
  readonly kind: 'ErrorStatement';
  /** The error message describing what went wrong */
  readonly message: string;
}

/**
 * Union type representing all possible expression node types in Luau.
 * Expressions are constructs that evaluate to a value.
 */
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

/**
 * Represents an identifier (variable name, function name, etc.).
 */
export interface Identifier extends BaseNode {
  /** Discriminator for the Identifier node type */
  readonly kind: 'Identifier';
  /** The string name of the identifier */
  readonly name: string;
}

/**
 * Union type representing all literal value types in Luau.
 * Includes nil, boolean, number, and string literals.
 */
export type Literal = NilLiteral | BooleanLiteral | NumberLiteral | StringLiteral;

/**
 * Represents the nil literal value.
 */
export interface NilLiteral extends BaseNode {
  /** Discriminator for the NilLiteral node type */
  readonly kind: 'NilLiteral';
}

/**
 * Represents a boolean literal value (true or false).
 */
export interface BooleanLiteral extends BaseNode {
  /** Discriminator for the BooleanLiteral node type */
  readonly kind: 'BooleanLiteral';
  /** The boolean value */
  readonly value: boolean;
}

/**
 * Represents a numeric literal value.
 */
export interface NumberLiteral extends BaseNode {
  /** Discriminator for the NumberLiteral node type */
  readonly kind: 'NumberLiteral';
  /** The parsed numeric value */
  readonly value: number;
  /** The raw string representation as it appeared in source */
  readonly raw: string;
}

/**
 * Represents a string literal value.
 */
export interface StringLiteral extends BaseNode {
  /** Discriminator for the StringLiteral node type */
  readonly kind: 'StringLiteral';
  /** The parsed string value with escape sequences processed */
  readonly value: string;
  /** The raw string representation as it appeared in source, including quotes */
  readonly raw: string;
}

/**
 * Represents the vararg expression (...).
 * Used to access variable arguments passed to a function.
 */
export interface VarargExpression extends BaseNode {
  /** Discriminator for the VarargExpression node type */
  readonly kind: 'VarargExpression';
}

/**
 * Represents a function expression (anonymous function or function body).
 * Example: `function(x, y) return x + y end`
 */
export interface FunctionExpression extends BaseNode {
  /** Discriminator for the FunctionExpression node type */
  readonly kind: 'FunctionExpression';
  /** Generic type parameters for the function, if any */
  readonly typeParams: ReadonlyArray<TypeParameter> | undefined;
  /** The function parameters */
  readonly params: ReadonlyArray<Parameter>;
  /** The return type annotation, if specified */
  readonly returnType: TypeAnnotation | undefined;
  /** The statements in the function body */
  readonly body: ReadonlyArray<Statement>;
  /** Whether this function accepts variable arguments */
  readonly isVariadic: boolean;
}

/**
 * Represents a function parameter definition.
 */
export interface Parameter extends BaseNode {
  /** Discriminator for the Parameter node type */
  readonly kind: 'Parameter';
  /** The parameter name identifier, undefined for vararg parameter */
  readonly name: Identifier | undefined;
  /** The type annotation for this parameter, if specified */
  readonly type: TypeAnnotation | undefined;
  /** Whether this is a variadic parameter (...) */
  readonly isVariadic: boolean;
}

/**
 * Represents a table constructor expression.
 * Example: `{ x = 1, y = 2 }` or `{ 1, 2, 3 }`
 */
export interface TableExpression extends BaseNode {
  /** Discriminator for the TableExpression node type */
  readonly kind: 'TableExpression';
  /** The fields in the table constructor */
  readonly fields: ReadonlyArray<TableField>;
}

/**
 * Union type representing all possible table field types.
 * Tables can have keyed fields, indexed fields, or array-style values.
 */
export type TableField = TableFieldKey | TableFieldIndex | TableFieldValue;

/**
 * Represents a table field with an identifier key.
 * Example: `{ key = value }`
 */
export interface TableFieldKey extends BaseNode {
  /** Discriminator for the TableFieldKey node type */
  readonly kind: 'TableFieldKey';
  /** The identifier key */
  readonly key: Identifier;
  /** The value expression */
  readonly value: Expression;
}

/**
 * Represents a table field with a computed index key.
 * Example: `{ [expr] = value }`
 */
export interface TableFieldIndex extends BaseNode {
  /** Discriminator for the TableFieldIndex node type */
  readonly kind: 'TableFieldIndex';
  /** The expression that evaluates to the key */
  readonly index: Expression;
  /** The value expression */
  readonly value: Expression;
}

/**
 * Represents a table field with an implicit array-style index.
 * Example: the values in `{ 1, 2, 3 }`
 */
export interface TableFieldValue extends BaseNode {
  /** Discriminator for the TableFieldValue node type */
  readonly kind: 'TableFieldValue';
  /** The value expression */
  readonly value: Expression;
}

/**
 * Represents a binary operation expression.
 * Example: `a + b`, `x and y`
 */
export interface BinaryExpression extends BaseNode {
  /** Discriminator for the BinaryExpression node type */
  readonly kind: 'BinaryExpression';
  /** The binary operator */
  readonly operator: BinaryOperator;
  /** The left-hand side expression */
  readonly left: Expression;
  /** The right-hand side expression */
  readonly right: Expression;
}

/**
 * Union type representing all binary operators in Luau.
 * Includes arithmetic, comparison, logical, and string concatenation operators.
 */
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

/**
 * Represents a unary operation expression.
 * Example: `-x`, `not y`, `#t`
 */
export interface UnaryExpression extends BaseNode {
  /** Discriminator for the UnaryExpression node type */
  readonly kind: 'UnaryExpression';
  /** The unary operator */
  readonly operator: UnaryOperator;
  /** The operand expression */
  readonly operand: Expression;
}

/**
 * Union type representing all unary operators in Luau.
 * Includes negation (-), logical not, and length (#) operators.
 */
export type UnaryOperator = '-' | 'not' | '#';

/**
 * Represents a function call expression.
 * Example: `func(arg1, arg2)`
 */
export interface CallExpression extends BaseNode {
  /** Discriminator for the CallExpression node type */
  readonly kind: 'CallExpression';
  /** The expression being called */
  readonly callee: Expression;
  /** The arguments passed to the function */
  readonly args: ReadonlyArray<Expression>;
}

/**
 * Represents a method call expression using colon syntax.
 * Example: `object:method(arg1, arg2)`
 */
export interface MethodCallExpression extends BaseNode {
  /** Discriminator for the MethodCallExpression node type */
  readonly kind: 'MethodCallExpression';
  /** The object the method is called on */
  readonly object: Expression;
  /** The method name identifier */
  readonly method: Identifier;
  /** The arguments passed to the method */
  readonly args: ReadonlyArray<Expression>;
}

/**
 * Represents an index access expression using brackets.
 * Example: `table[key]`
 */
export interface IndexExpression extends BaseNode {
  /** Discriminator for the IndexExpression node type */
  readonly kind: 'IndexExpression';
  /** The object being indexed */
  readonly object: Expression;
  /** The index expression */
  readonly index: Expression;
}

/**
 * Represents a member access expression using dot notation.
 * Example: `object.property`
 */
export interface MemberExpression extends BaseNode {
  /** Discriminator for the MemberExpression node type */
  readonly kind: 'MemberExpression';
  /** The object whose member is being accessed */
  readonly object: Expression;
  /** The property identifier being accessed */
  readonly property: Identifier;
}

/**
 * Represents an inline if-then-else expression.
 * Example: `if condition then expr1 else expr2`
 */
export interface IfExpression extends BaseNode {
  /** Discriminator for the IfExpression node type */
  readonly kind: 'IfExpression';
  /** The condition expression */
  readonly condition: Expression;
  /** The expression to evaluate when condition is truthy */
  readonly thenExpr: Expression;
  /** The elseif expression clauses, if any */
  readonly elseifExprs: ReadonlyArray<ElseifExpressionClause>;
  /** The expression to evaluate when all conditions are falsy */
  readonly elseExpr: Expression;
}

/**
 * Represents an elseif clause within an if expression.
 */
export interface ElseifExpressionClause extends BaseNode {
  /** Discriminator for the ElseifExpressionClause node type */
  readonly kind: 'ElseifExpressionClause';
  /** The condition expression for this elseif clause */
  readonly condition: Expression;
  /** The expression to evaluate when this condition is truthy */
  readonly thenExpr: Expression;
}

/**
 * Represents a type cast expression.
 * Example: `value :: Type`
 */
export interface TypeCastExpression extends BaseNode {
  /** Discriminator for the TypeCastExpression node type */
  readonly kind: 'TypeCastExpression';
  /** The expression being cast */
  readonly expression: Expression;
  /** The target type annotation */
  readonly type: TypeAnnotation;
}

/**
 * Represents an interpolated string expression.
 * Example: `` `Hello {name}!` ``
 */
export interface InterpolatedString extends BaseNode {
  /** Discriminator for the InterpolatedString node type */
  readonly kind: 'InterpolatedString';
  /** The parts of the interpolated string (literals and expressions) */
  readonly parts: ReadonlyArray<InterpolatedStringPart>;
}

/**
 * Union type representing the parts of an interpolated string.
 * Can be either a string literal or an interpolated expression.
 */
export type InterpolatedStringPart = StringLiteral | InterpolatedExpression;

/**
 * Represents an embedded expression within an interpolated string.
 * Example: the `{name}` part in `` `Hello {name}!` ``
 */
export interface InterpolatedExpression extends BaseNode {
  /** Discriminator for the InterpolatedExpression node type */
  readonly kind: 'InterpolatedExpression';
  /** The embedded expression */
  readonly expression: Expression;
}

/**
 * Represents a parenthesized expression.
 * Example: `(a + b)`
 */
export interface ParenthesizedExpression extends BaseNode {
  /** Discriminator for the ParenthesizedExpression node type */
  readonly kind: 'ParenthesizedExpression';
  /** The expression within the parentheses */
  readonly expression: Expression;
}

/**
 * Represents a parsing error that was encountered while processing an expression.
 */
export interface ErrorExpression extends BaseNode {
  /** Discriminator for the ErrorExpression node type */
  readonly kind: 'ErrorExpression';
  /** The error message describing what went wrong */
  readonly message: string;
}

/**
 * Union type representing all possible type annotation node types in Luau.
 * Type annotations describe the expected types of values.
 */
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

/**
 * Represents a reference to a named type.
 * Example: `number`, `MyModule.MyType<T>`
 */
export interface TypeReference extends BaseNode {
  /** Discriminator for the TypeReference node type */
  readonly kind: 'TypeReference';
  /** The name of the referenced type */
  readonly name: string;
  /** The module prefix if this is a qualified type reference */
  readonly module: string | undefined;
  /** The type arguments if this is a generic type instantiation */
  readonly typeArgs: ReadonlyArray<TypeAnnotation> | undefined;
}

/**
 * Represents a literal type annotation.
 * Example: `"literal"` or `true`
 */
export interface TypeLiteral extends BaseNode {
  /** Discriminator for the TypeLiteral node type */
  readonly kind: 'TypeLiteral';
  /** The literal value (string, boolean, or number) */
  readonly value: string | boolean | number;
}

/**
 * Represents a function type annotation.
 * Example: `(x: number, y: number) -> number`
 */
export interface FunctionType extends BaseNode {
  /** Discriminator for the FunctionType node type */
  readonly kind: 'FunctionType';
  /** Generic type parameters for the function type, if any */
  readonly typeParams: ReadonlyArray<TypeParameter> | undefined;
  /** The type of `self` for method types, if specified */
  readonly thisType: TypeAnnotation | undefined;
  /** The parameter types */
  readonly params: ReadonlyArray<FunctionTypeParam>;
  /** The return type annotation */
  readonly returnType: TypeAnnotation;
  /** Whether this function type accepts variable arguments */
  readonly isVariadic: boolean;
}

/**
 * Represents a parameter in a function type annotation.
 */
export interface FunctionTypeParam extends BaseNode {
  /** Discriminator for the FunctionTypeParam node type */
  readonly kind: 'FunctionTypeParam';
  /** The parameter name, if specified */
  readonly name: string | undefined;
  /** The type annotation for this parameter */
  readonly type: TypeAnnotation;
}

/**
 * Represents a table type annotation.
 * Example: `{ x: number, y: number }` or `{ [string]: number }`
 */
export interface TableType extends BaseNode {
  /** Discriminator for the TableType node type */
  readonly kind: 'TableType';
  /** The named properties of the table type */
  readonly properties: ReadonlyArray<TableTypeProperty>;
  /** The indexer signature, if this is a dictionary type */
  readonly indexer: TableTypeIndexer | undefined;
}

/**
 * Represents a named property in a table type.
 */
export interface TableTypeProperty extends BaseNode {
  /** Discriminator for the TableTypeProperty node type */
  readonly kind: 'TableTypeProperty';
  /** The property name */
  readonly name: string;
  /** The type annotation for this property */
  readonly type: TypeAnnotation;
  /** Whether this property is marked as read-only */
  readonly isReadonly: boolean;
}

/**
 * Represents an indexer signature in a table type.
 * Example: `[string]: number` in `{ [string]: number }`
 */
export interface TableTypeIndexer extends BaseNode {
  /** Discriminator for the TableTypeIndexer node type */
  readonly kind: 'TableTypeIndexer';
  /** The type annotation for valid keys */
  readonly keyType: TypeAnnotation;
  /** The type annotation for values */
  readonly valueType: TypeAnnotation;
}

/**
 * Represents a union type annotation.
 * Example: `string | number`
 */
export interface UnionType extends BaseNode {
  /** Discriminator for the UnionType node type */
  readonly kind: 'UnionType';
  /** The types that make up this union */
  readonly types: ReadonlyArray<TypeAnnotation>;
}

/**
 * Represents an intersection type annotation.
 * Example: `A & B`
 */
export interface IntersectionType extends BaseNode {
  /** Discriminator for the IntersectionType node type */
  readonly kind: 'IntersectionType';
  /** The types that make up this intersection */
  readonly types: ReadonlyArray<TypeAnnotation>;
}

/**
 * Represents an optional type annotation.
 * Example: `number?`
 */
export interface OptionalType extends BaseNode {
  /** Discriminator for the OptionalType node type */
  readonly kind: 'OptionalType';
  /** The underlying type that is optional */
  readonly type: TypeAnnotation;
}

/**
 * Represents a typeof type annotation.
 * Example: `typeof(expr)`
 */
export interface TypeofType extends BaseNode {
  /** Discriminator for the TypeofType node type */
  readonly kind: 'TypeofType';
  /** The expression whose type is being extracted */
  readonly expression: Expression;
}

/**
 * Represents a variadic type annotation.
 * Example: `...number`
 */
export interface VariadicType extends BaseNode {
  /** Discriminator for the VariadicType node type */
  readonly kind: 'VariadicType';
  /** The type of each variadic argument */
  readonly type: TypeAnnotation;
}

/**
 * Represents a parenthesized type annotation.
 * Example: `(A | B)`
 */
export interface ParenthesizedType extends BaseNode {
  /** Discriminator for the ParenthesizedType node type */
  readonly kind: 'ParenthesizedType';
  /** The type annotation within the parentheses */
  readonly type: TypeAnnotation;
}

/**
 * Represents a parsing error that was encountered while processing a type annotation.
 */
export interface ErrorType extends BaseNode {
  /** Discriminator for the ErrorType node type */
  readonly kind: 'ErrorType';
  /** The error message describing what went wrong */
  readonly message: string;
}

/**
 * Represents a generic type parameter declaration.
 * Example: `T` in `type List<T>` or `T: Constraint = Default`
 */
export interface TypeParameter extends BaseNode {
  /** Discriminator for the TypeParameter node type */
  readonly kind: 'TypeParameter';
  /** The name of the type parameter */
  readonly name: string;
  /** The constraint type that this parameter must satisfy, if any */
  readonly constraint: TypeAnnotation | undefined;
  /** The default type if no argument is provided, if any */
  readonly defaultType: TypeAnnotation | undefined;
}

/**
 * Type guard to check if a node is a Statement.
 * @param node - The AST node to check
 * @returns True if the node is a Statement, false otherwise
 */
export const isStatement = (node: BaseNode): node is Statement => {
  const statementKinds = new Set([
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
  return statementKinds.has((node as Statement).kind);
};

/**
 * Type guard to check if a node is an Expression.
 * @param node - The AST node to check
 * @returns True if the node is an Expression, false otherwise
 */
export const isExpression = (node: BaseNode): node is Expression => {
  const expressionKinds = new Set([
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
  return expressionKinds.has((node as Expression).kind);
};

/**
 * Type guard to check if a node is a TypeAnnotation.
 * @param node - The AST node to check
 * @returns True if the node is a TypeAnnotation, false otherwise
 */
export const isTypeAnnotation = (node: BaseNode): node is TypeAnnotation => {
  const typeKinds = new Set([
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
  return typeKinds.has((node as TypeAnnotation).kind);
};

/**
 * Type guard to check if a node is a Literal.
 * @param node - The AST node to check
 * @returns True if the node is a Literal (NilLiteral, BooleanLiteral, NumberLiteral, or StringLiteral), false otherwise
 */
export const isLiteral = (node: BaseNode): node is Literal => {
  const literalKinds = new Set(['NilLiteral', 'BooleanLiteral', 'NumberLiteral', 'StringLiteral']);
  return literalKinds.has((node as Literal).kind);
};
