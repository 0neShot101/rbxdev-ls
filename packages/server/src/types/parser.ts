import type {
  Assignment,
  BinaryExpression,
  BinaryOperator,
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
  NodeRange,
  NumberLiteral,
  OptionalType,
  ParenthesizedExpression,
  ParenthesizedType,
  RepeatStatement,
  ReturnStatement,
  StringLiteral,
  TableExpression,
  TableType,
  TypeAlias,
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

/** Numeric enum of all Luau token kinds (literals, operators, keywords, and trivia). */
export const TokenKind = {
  'Number': 0,
  'String': 1,
  'InterpolatedString': 2,
  'True': 3,
  'False': 4,
  'Nil': 5,

  'Identifier': 6,

  'And': 7,
  'Break': 8,
  'Continue': 9,
  'Do': 10,
  'Else': 11,
  'Elseif': 12,
  'End': 13,
  'Export': 14,
  'For': 15,
  'Function': 16,
  'If': 17,
  'In': 18,
  'Local': 19,
  'Not': 20,
  'Or': 21,
  'Repeat': 22,
  'Return': 23,
  'Then': 24,
  'Type': 25,
  'Typeof': 26,
  'Until': 27,
  'While': 28,

  'Plus': 29,
  'Minus': 30,
  'Star': 31,
  'Slash': 32,
  'DoubleSlash': 33,
  'Percent': 34,
  'Caret': 35,
  'Hash': 36,

  'Equal': 37,
  'NotEqual': 38,
  'Less': 39,
  'LessEqual': 40,
  'Greater': 41,
  'GreaterEqual': 42,

  'Assign': 43,
  'PlusAssign': 44,
  'MinusAssign': 45,
  'StarAssign': 46,
  'SlashAssign': 47,
  'DoubleSlashAssign': 48,
  'PercentAssign': 49,
  'CaretAssign': 50,
  'ConcatAssign': 51,

  'Concat': 52,
  'Vararg': 53,
  'Colon': 54,
  'DoubleColon': 55,
  'Arrow': 56,
  'Question': 57,
  'Dot': 58,
  'Ampersand': 59,
  'Pipe': 60,

  'LeftParen': 61,
  'RightParen': 62,
  'LeftBracket': 63,
  'RightBracket': 64,
  'LeftBrace': 65,
  'RightBrace': 66,
  'Comma': 67,
  'Semicolon': 68,

  'Comment': 69,
  'Whitespace': 70,
  'Newline': 71,
  'EOF': 72,
  'Error': 73,
} as const;

/** Numeric value of a single {@link TokenKind} entry. */
export type TokenKindValue = (typeof TokenKind)[keyof typeof TokenKind];

/** Source location: zero-based character offset with one-based line and column. */
export interface TokenPosition {
  readonly offset: number;
  readonly line: number;
  readonly column: number;
}

/** Lexed token with its kind, raw source text, and span. */
export interface Token {
  readonly kind: TokenKindValue;
  readonly value: string;
  readonly start: TokenPosition;
  readonly end: TokenPosition;
}

/** `@param` entry parsed from a doc comment. */
export interface DocParam {
  readonly name: string;
  readonly type: string | undefined;
  readonly description: string | undefined;
}

/** `@return` entry parsed from a doc comment. */
export interface DocReturn {
  readonly type: string | undefined;
  readonly description: string | undefined;
}

/** `@field` entry parsed from a doc comment. */
export interface DocField {
  readonly name: string;
  readonly type: string | undefined;
  readonly description: string | undefined;
}

/** Structured doc comment attached to a declaration, with its raw text. */
export interface DocComment {
  readonly description: string | undefined;
  readonly params: ReadonlyArray<DocParam>;
  readonly returns: ReadonlyArray<DocReturn>;
  readonly type: string | undefined;
  readonly class: string | undefined;
  readonly fields: ReadonlyArray<DocField>;
  readonly deprecated: string | undefined;
  readonly raw: string;
}

/** Mutable cursor the lexer advances through the source. */
export interface LexerState {
  readonly source: string;
  offset: number;
  line: number;
  column: number;
  /** Most recently created position; reused when the cursor has not moved, so adjacent tokens share it. */
  position: TokenPosition;
}

/** Lexer bound to a source string that produces its token stream on demand. */
export interface Lexer {
  readonly source: string;
  readonly tokens: () => Token[];
}

/** Significant tokens and comments of a source, with whitespace and newlines skipped rather than materialized. */
export interface LexedSource {
  readonly tokens: Token[];
  readonly comments: Token[];
}

/** Syntax error reported by the parser with its source range. */
export interface ParseError {
  readonly message: string;
  readonly range: NodeRange;
}

/** Parsed AST root together with every syntax error encountered. */
export interface ParseResult {
  readonly ast: Chunk;
  readonly errors: ReadonlyArray<ParseError>;
}

/** Mutable parser cursor over the token stream plus collected comments, errors, and pending doc comment; `eof` is the terminating token returned once the cursor runs past the end. */
export interface ParserState {
  readonly tokens: ReadonlyArray<Token>;
  readonly eof: Token;
  readonly comments: Comment[];
  readonly errors: ParseError[];
  current: number;
  pendingDocComment: DocComment | undefined;
}

/** Precedence and associativity entry for a binary operator token. */
export interface BinaryOpInfo {
  readonly operator: BinaryOperator;
  readonly precedence: number;
  readonly rightAssociative: boolean;
}

/** Optional per-kind callbacks invoked while walking the AST. */
export interface Visitor<T = void> {
  visitChunk?(node: Chunk): T;
  visitComment?(node: Comment): T;

  visitLocalDeclaration?(node: LocalDeclaration): T;
  visitLocalFunction?(node: LocalFunction): T;
  visitFunctionDeclaration?(node: FunctionDeclaration): T;
  visitAssignment?(node: Assignment): T;
  visitCompoundAssignment?(node: CompoundAssignment): T;
  visitIfStatement?(node: IfStatement): T;
  visitWhileStatement?(node: WhileStatement): T;
  visitRepeatStatement?(node: RepeatStatement): T;
  visitForNumeric?(node: ForNumeric): T;
  visitForGeneric?(node: ForGeneric): T;
  visitDoStatement?(node: DoStatement): T;
  visitReturnStatement?(node: ReturnStatement): T;
  visitBreakStatement?(node: BreakStatement): T;
  visitContinueStatement?(node: ContinueStatement): T;
  visitTypeAlias?(node: TypeAlias): T;
  visitExportStatement?(node: ExportStatement): T;
  visitCallStatement?(node: CallStatement): T;
  visitErrorStatement?(node: ErrorStatement): T;

  visitIdentifier?(node: Identifier): T;
  visitNilLiteral?(node: NilLiteral): T;
  visitBooleanLiteral?(node: BooleanLiteral): T;
  visitNumberLiteral?(node: NumberLiteral): T;
  visitStringLiteral?(node: StringLiteral): T;
  visitVarargExpression?(node: VarargExpression): T;
  visitFunctionExpression?(node: FunctionExpression): T;
  visitTableExpression?(node: TableExpression): T;
  visitBinaryExpression?(node: BinaryExpression): T;
  visitUnaryExpression?(node: UnaryExpression): T;
  visitCallExpression?(node: CallExpression): T;
  visitMethodCallExpression?(node: MethodCallExpression): T;
  visitIndexExpression?(node: IndexExpression): T;
  visitMemberExpression?(node: MemberExpression): T;
  visitIfExpression?(node: IfExpression): T;
  visitTypeCastExpression?(node: TypeCastExpression): T;
  visitInterpolatedString?(node: InterpolatedString): T;
  visitParenthesizedExpression?(node: ParenthesizedExpression): T;
  visitErrorExpression?(node: ErrorExpression): T;

  visitTypeReference?(node: TypeReference): T;
  visitTypeLiteral?(node: TypeLiteral): T;
  visitFunctionType?(node: FunctionType): T;
  visitTableType?(node: TableType): T;
  visitUnionType?(node: UnionType): T;
  visitIntersectionType?(node: IntersectionType): T;
  visitOptionalType?(node: OptionalType): T;
  visitTypeofType?(node: TypeofType): T;
  visitVariadicType?(node: VariadicType): T;
  visitParenthesizedType?(node: ParenthesizedType): T;
  visitErrorType?(node: ErrorType): T;
}
