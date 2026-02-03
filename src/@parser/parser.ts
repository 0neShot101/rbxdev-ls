/**
 * Luau Parser - Recursive descent parser with error recovery
 *
 * Parses Luau source code into an Abstract Syntax Tree (AST).
 * Features include type annotation parsing, documentation comment extraction,
 * and error recovery to continue parsing after syntax errors.
 */

import { parseDocComment, type DocComment } from './docComment';
import { createLexer } from './lexer';
import { isTrivia, TokenKind, type Token, type TokenPosition } from './tokens';

import type {
  AssignmentTarget,
  BinaryOperator,
  Chunk,
  Comment,
  CompoundOperator,
  DoStatement,
  ElseifClause,
  ExportStatement,
  Expression,
  ForGeneric,
  ForNumeric,
  FunctionDeclaration,
  FunctionExpression,
  FunctionName,
  FunctionTypeParam,
  Identifier,
  IfStatement,
  LocalDeclaration,
  LocalFunction,
  NodeRange,
  Parameter,
  RepeatStatement,
  ReturnStatement,
  Statement,
  TableField,
  TableTypeProperty,
  TypeAlias,
  TypeAnnotation,
  TypeParameter,
  UnaryOperator,
  WhileStatement,
} from './ast';

/**
 * Represents a parsing error with its message and source location.
 */
export interface ParseError {
  /** Human-readable error message describing the issue */
  readonly message: string;
  /** The source range where the error occurred */
  readonly range: NodeRange;
}

/**
 * The result of parsing source code, containing the AST and any errors encountered.
 */
export interface ParseResult {
  /** The root AST node representing the parsed file */
  readonly ast: Chunk;
  /** Array of parsing errors encountered (empty if parsing succeeded without errors) */
  readonly errors: ReadonlyArray<ParseError>;
}

/**
 * Internal state maintained during parsing.
 */
interface ParserState {
  /** Filtered tokens (trivia removed) for parsing */
  readonly tokens: ReadonlyArray<Token>;
  /** All tokens including trivia (for doc comment extraction) */
  readonly allTokens: ReadonlyArray<Token>;
  /** Extracted comments from the source */
  readonly comments: Comment[];
  /** Accumulated parsing errors */
  readonly errors: ParseError[];
  /** Current position in the token stream */
  current: number;
  /** Pending documentation comment to attach to next declaration */
  pendingDocComment: DocComment | undefined;
}

/**
 * Map of binary operators to their precedence levels.
 * Higher numbers indicate higher precedence (bind tighter).
 */
const BINARY_PRECEDENCE: ReadonlyMap<string, number> = new Map([
  ['or', 1],
  ['and', 2],
  ['<', 3],
  ['>', 3],
  ['<=', 3],
  ['>=', 3],
  ['~=', 3],
  ['==', 3],
  ['..', 4],
  ['+', 5],
  ['-', 5],
  ['*', 6],
  ['/', 6],
  ['//', 6],
  ['%', 6],
  ['^', 8], // Right associative, handled separately
]);

/**
 * Determines if a binary operator is right-associative.
 * @param op The operator string to check
 * @returns True if the operator is right-associative, false otherwise
 */
const isRightAssociative = (op: string): boolean => op === '^' || op === '..';

/**
 * Returns the token at the current position plus an optional offset without consuming it.
 * @param state The parser state
 * @param offset Optional offset from current position (default 0)
 * @returns The token at the specified position
 */
const peek = (state: ParserState, offset = 0): Token => {
  const index = state.current + offset;
  if (index >= state.tokens.length) return state.tokens[state.tokens.length - 1]!;
  return state.tokens[index]!;
};

/**
 * Returns the current token without consuming it.
 * @param state The parser state
 * @returns The current token
 */
const current = (state: ParserState): Token => peek(state, 0);

/**
 * Checks if the parser has reached the end of the token stream.
 * @param state The parser state
 * @returns True if at EOF, false otherwise
 */
const isAtEnd = (state: ParserState): boolean => current(state).kind === TokenKind.EOF;

/**
 * Checks if the current token is of the specified kind.
 * @param state The parser state
 * @param kind The token kind to check for
 * @returns True if current token matches the kind, false otherwise
 */
const check = (state: ParserState, kind: TokenKind): boolean => current(state).kind === kind;

/**
 * Checks if the token at a given offset from current position is of the specified kind.
 * @param state The parser state
 * @param offset The offset from current position to look ahead
 * @param kind The token kind to check for
 * @returns True if the token at offset matches the kind, false otherwise
 */
const checkAhead = (state: ParserState, offset: number, kind: TokenKind): boolean => {
  const index = state.current + offset;
  if (index >= state.tokens.length) return false;
  return state.tokens[index]?.kind === kind;
};

/**
 * Consumes and returns the current token, advancing to the next token.
 * @param state The parser state (will be mutated)
 * @returns The token that was consumed
 */
const advance = (state: ParserState): Token => {
  if (isAtEnd(state) === false) state.current++;
  return state.tokens[state.current - 1]!;
};

/**
 * Consumes a token of the expected kind, or reports an error if it doesn't match.
 * @param state The parser state (will be mutated)
 * @param kind The expected token kind
 * @param message Error message to display if the token doesn't match
 * @returns The consumed token, or the current token if there was an error
 */
const consume = (state: ParserState, kind: TokenKind, message: string): Token => {
  if (check(state, kind)) return advance(state);

  const token = current(state);
  state.errors.push({
    message,
    'range': { 'start': token.start, 'end': token.end },
  });
  return token;
};

/**
 * Attempts to match and consume any of the specified token kinds.
 * @param state The parser state (will be mutated if match succeeds)
 * @param kinds The token kinds to match against
 * @returns True if a match was found and consumed, false otherwise
 */
const match = (state: ParserState, ...kinds: TokenKind[]): boolean => {
  for (const kind of kinds) {
    if (check(state, kind)) {
      advance(state);
      return true;
    }
  }
  return false;
};

/**
 * Creates a NodeRange from start and end positions.
 * @param start The starting position
 * @param end The ending position
 * @returns A NodeRange spanning from start to end
 */
const createRange = (start: TokenPosition, end: TokenPosition): NodeRange => ({ start, end });

/**
 * Synchronizes the parser after an error by advancing to the next statement boundary.
 * Used for error recovery to allow continued parsing after syntax errors.
 * @param state The parser state (will be mutated)
 * @returns void
 */
const synchronize = (state: ParserState): void => {
  advance(state);

  while (isAtEnd(state) === false) {
    const kind = current(state).kind;

    if (
      kind === TokenKind.End ||
      kind === TokenKind.Local ||
      kind === TokenKind.Function ||
      kind === TokenKind.If ||
      kind === TokenKind.While ||
      kind === TokenKind.For ||
      kind === TokenKind.Repeat ||
      kind === TokenKind.Return ||
      kind === TokenKind.Do ||
      kind === TokenKind.Type ||
      kind === TokenKind.Export
    ) {
      return;
    }

    advance(state);
  }
};

/**
 * Parses an identifier token into an Identifier AST node.
 * @param state The parser state (will be mutated)
 * @returns An Identifier node
 */
const parseIdentifier = (state: ParserState): Identifier => {
  const token = consume(state, TokenKind.Identifier, 'Expected identifier');
  return {
    'kind': 'Identifier',
    'name': token.value,
    'range': createRange(token.start, token.end),
  };
};

/**
 * Parses a primary expression (literals, identifiers, parenthesized expressions, tables, functions).
 * @param state The parser state (will be mutated)
 * @returns An Expression AST node
 */
const parsePrimaryExpression = (state: ParserState): Expression => {
  const token = current(state);

  switch (token.kind) {
    case TokenKind.Nil:
      advance(state);
      return { 'kind': 'NilLiteral', 'range': createRange(token.start, token.end) };

    case TokenKind.True:
      advance(state);
      return { 'kind': 'BooleanLiteral', 'value': true, 'range': createRange(token.start, token.end) };

    case TokenKind.False:
      advance(state);
      return { 'kind': 'BooleanLiteral', 'value': false, 'range': createRange(token.start, token.end) };

    case TokenKind.Number:
      advance(state);
      return {
        'kind': 'NumberLiteral',
        'value': parseFloat(token.value.replace(/_/g, '')),
        'raw': token.value,
        'range': createRange(token.start, token.end),
      };

    case TokenKind.String:
      advance(state);
      return {
        'kind': 'StringLiteral',
        'value': parseStringValue(token.value),
        'raw': token.value,
        'range': createRange(token.start, token.end),
      };

    case TokenKind.InterpolatedString:
      return parseInterpolatedString(state);

    case TokenKind.Vararg:
      advance(state);
      return { 'kind': 'VarargExpression', 'range': createRange(token.start, token.end) };

    case TokenKind.Identifier:
      return parseIdentifier(state);

    // type and typeof can be used as function calls
    case TokenKind.Type:
    case TokenKind.Typeof:
      advance(state);
      return {
        'kind': 'Identifier',
        'name': token.value,
        'range': createRange(token.start, token.end),
      };

    case TokenKind.LeftParen:
      return parseParenthesizedExpression(state);

    case TokenKind.LeftBrace:
      return parseTableExpression(state);

    case TokenKind.Function:
      return parseFunctionExpression(state);

    case TokenKind.If:
      return parseIfExpression(state);

    default:
      state.errors.push({
        'message': `Unexpected token: ${token.kind}`,
        'range': createRange(token.start, token.end),
      });
      advance(state);
      return {
        'kind': 'ErrorExpression',
        'message': `Unexpected token: ${token.kind}`,
        'range': createRange(token.start, token.end),
      };
  }
};

/**
 * Parses a raw string token value into its actual string content.
 * Handles escape sequences and long bracket strings.
 * @param raw The raw string value from the token
 * @returns The parsed string content with escapes resolved
 */
const parseStringValue = (raw: string): string => {
  if (raw.startsWith('[[') || raw.startsWith('[=')) {
    // Long string - find the content between brackets
    const level = raw.match(/^\[=*\[/)![0].length - 2;
    const endPattern = ']' + '='.repeat(level) + ']';
    const startIndex = level + 2;
    const endIndex = raw.lastIndexOf(endPattern);
    return raw.slice(startIndex, endIndex);
  }

  // Regular string - remove quotes and handle escapes
  const content = raw.slice(1, -1);
  return content.replace(/\\(.)/g, (_, char) => {
    switch (char) {
      case 'n':
        return '\n';
      case 't':
        return '\t';
      case 'r':
        return '\r';
      case '\\':
        return '\\';
      case '"':
        return '"';
      case "'":
        return "'";
      default:
        return char;
    }
  });
};

/**
 * Parses an interpolated string expression (backtick strings with embedded expressions).
 * @param state The parser state (will be mutated)
 * @returns An InterpolatedString expression node
 */
const parseInterpolatedString = (state: ParserState): Expression => {
  const start = current(state);
  advance(state);

  // For now, treat as a simple string literal
  // Full interpolation parsing would require re-lexing the content
  return {
    'kind': 'InterpolatedString',
    'parts': [
      {
        'kind': 'StringLiteral',
        'value': start.value.slice(1, -1),
        'raw': start.value,
        'range': createRange(start.start, start.end),
      },
    ],
    'range': createRange(start.start, start.end),
  };
};

/**
 * Parses a parenthesized expression.
 * @param state The parser state (will be mutated)
 * @returns A ParenthesizedExpression node
 */
const parseParenthesizedExpression = (state: ParserState): Expression => {
  const start = current(state);
  consume(state, TokenKind.LeftParen, 'Expected (');
  const expression = parseExpression(state);
  const end = consume(state, TokenKind.RightParen, 'Expected )');
  return {
    'kind': 'ParenthesizedExpression',
    expression,
    'range': createRange(start.start, end.end),
  };
};

/**
 * Parses a table constructor expression.
 * @param state The parser state (will be mutated)
 * @returns A TableExpression node
 */
const parseTableExpression = (state: ParserState): Expression => {
  const start = current(state);
  consume(state, TokenKind.LeftBrace, 'Expected {');

  const fields: TableField[] = [];

  while (check(state, TokenKind.RightBrace) === false && isAtEnd(state) === false) {
    fields.push(parseTableField(state));

    if (check(state, TokenKind.Comma) || check(state, TokenKind.Semicolon)) {
      advance(state);
    } else {
      break;
    }
  }

  const end = consume(state, TokenKind.RightBrace, 'Expected }');
  return {
    'kind': 'TableExpression',
    fields,
    'range': createRange(start.start, end.end),
  };
};

/**
 * Set of keywords that can be used as identifiers in certain contexts (like table fields, property access).
 */
const CONTEXTUAL_KEYWORDS = new Set<TokenKind>([
  TokenKind.Type,
  TokenKind.Typeof,
  TokenKind.And,
  TokenKind.Or,
  TokenKind.Not,
  TokenKind.True,
  TokenKind.False,
  TokenKind.Nil,
  TokenKind.If,
  TokenKind.Then,
  TokenKind.Else,
  TokenKind.Elseif,
  TokenKind.End,
  TokenKind.Do,
  TokenKind.While,
  TokenKind.Repeat,
  TokenKind.Until,
  TokenKind.For,
  TokenKind.In,
  TokenKind.Function,
  TokenKind.Local,
  TokenKind.Return,
  TokenKind.Break,
  TokenKind.Continue,
  TokenKind.Export,
]);

/**
 * Checks if the current token can be used as an identifier (includes contextual keywords).
 * @param state The parser state
 * @returns True if current token is identifier-like, false otherwise
 */
const isIdentifierLike = (state: ParserState): boolean => {
  const kind = current(state).kind;
  return kind === TokenKind.Identifier || CONTEXTUAL_KEYWORDS.has(kind);
};

/**
 * Parses an identifier or contextual keyword as an Identifier node.
 * @param state The parser state (will be mutated)
 * @returns An Identifier node
 */
const parseIdentifierLike = (state: ParserState): Identifier => {
  const token = current(state);
  if (token.kind === TokenKind.Identifier || CONTEXTUAL_KEYWORDS.has(token.kind)) {
    advance(state);
    return {
      'kind': 'Identifier',
      'name': token.value,
      'range': createRange(token.start, token.end),
    };
  }
  return parseIdentifier(state);
};

/**
 * Parses a single table field (key=value, [expr]=value, or value).
 * @param state The parser state (will be mutated)
 * @returns A TableField node
 */
const parseTableField = (state: ParserState): TableField => {
  const start = current(state);

  // [expr] = expr
  if (check(state, TokenKind.LeftBracket)) {
    advance(state);
    const index = parseExpression(state);
    consume(state, TokenKind.RightBracket, 'Expected ]');
    consume(state, TokenKind.Assign, 'Expected =');
    const value = parseExpression(state);
    return {
      'kind': 'TableFieldIndex',
      index,
      value,
      'range': createRange(start.start, value.range.end),
    };
  }

  // name = expr (lookahead for =) - allow type/typeof as field names
  if (isIdentifierLike(state) && peek(state, 1).kind === TokenKind.Assign) {
    const key = parseIdentifierLike(state);
    consume(state, TokenKind.Assign, 'Expected =');
    const value = parseExpression(state);
    return {
      'kind': 'TableFieldKey',
      key,
      value,
      'range': createRange(start.start, value.range.end),
    };
  }

  // expr (array-style)
  const value = parseExpression(state);
  return {
    'kind': 'TableFieldValue',
    value,
    'range': createRange(start.start, value.range.end),
  };
};

/**
 * Parses a function expression (anonymous function).
 * @param state The parser state (will be mutated)
 * @returns A FunctionExpression node
 */
const parseFunctionExpression = (state: ParserState): FunctionExpression => {
  const start = current(state);
  consume(state, TokenKind.Function, 'Expected function');

  const typeParams = parseOptionalTypeParameters(state);
  const { params, isVariadic } = parseParameters(state);
  const returnType = parseOptionalReturnType(state);
  const body = parseBlock(state);
  const end = consume(state, TokenKind.End, 'Expected end');

  return {
    'kind': 'FunctionExpression',
    typeParams,
    params,
    returnType,
    body,
    isVariadic,
    'range': createRange(start.start, end.end),
  };
};

/**
 * Parses optional generic type parameters (e.g., <T, U>).
 * @param state The parser state (will be mutated)
 * @returns An array of TypeParameter nodes, or undefined if none present
 */
const parseOptionalTypeParameters = (state: ParserState): ReadonlyArray<TypeParameter> | undefined => {
  if (check(state, TokenKind.Less) === false) return undefined;
  advance(state);

  const params: TypeParameter[] = [];

  do {
    const start = current(state);
    const name = consume(state, TokenKind.Identifier, 'Expected type parameter name').value;

    let constraint: TypeAnnotation | undefined;
    let defaultType: TypeAnnotation | undefined;

    // Handle constraint (Name : Type)
    // Handle default (Name = Type)

    params.push({
      'kind': 'TypeParameter',
      name,
      constraint,
      defaultType,
      'range': createRange(start.start, current(state).start),
    });
  } while (match(state, TokenKind.Comma));

  consume(state, TokenKind.Greater, 'Expected >');
  return params;
};

/**
 * Parses function parameters including optional type annotations and vararg.
 * @param state The parser state (will be mutated)
 * @returns An object containing the parameter list and whether the function is variadic
 */
const parseParameters = (state: ParserState): { params: Parameter[]; isVariadic: boolean } => {
  consume(state, TokenKind.LeftParen, 'Expected (');

  const params: Parameter[] = [];
  let isVariadic = false;

  while (check(state, TokenKind.RightParen) === false && isAtEnd(state) === false) {
    const start = current(state);

    if (check(state, TokenKind.Vararg)) {
      advance(state);
      isVariadic = true;

      let type: TypeAnnotation | undefined;
      if (check(state, TokenKind.Colon)) {
        advance(state);
        type = parseTypeAnnotation(state);
      }

      params.push({
        'kind': 'Parameter',
        'name': undefined,
        type,
        'isVariadic': true,
        'range': createRange(start.start, current(state).start),
      });
      break;
    }

    const name = parseIdentifier(state);

    let type: TypeAnnotation | undefined;
    if (check(state, TokenKind.Colon)) {
      advance(state);
      type = parseTypeAnnotation(state);
    }

    params.push({
      'kind': 'Parameter',
      name,
      type,
      'isVariadic': false,
      'range': createRange(start.start, current(state).start),
    });

    if (check(state, TokenKind.Comma) === false) break;
    advance(state);
  }

  consume(state, TokenKind.RightParen, 'Expected )');
  return { params, isVariadic };
};

/**
 * Parses an optional return type annotation (: Type).
 * @param state The parser state (will be mutated)
 * @returns A TypeAnnotation node, or undefined if no return type is specified
 */
const parseOptionalReturnType = (state: ParserState): TypeAnnotation | undefined => {
  if (check(state, TokenKind.Colon) === false) return undefined;
  advance(state);
  return parseTypeAnnotation(state);
};

/**
 * Parses an if-then-else expression.
 * @param state The parser state (will be mutated)
 * @returns An IfExpression node
 */
const parseIfExpression = (state: ParserState): Expression => {
  const start = current(state);
  consume(state, TokenKind.If, 'Expected if');

  const condition = parseExpression(state);
  consume(state, TokenKind.Then, 'Expected then');
  const thenExpr = parseExpression(state);

  const elseifExprs: {
    kind: 'ElseifExpressionClause';
    condition: Expression;
    thenExpr: Expression;
    range: NodeRange;
  }[] = [];

  while (check(state, TokenKind.Elseif)) {
    const elseifStart = current(state);
    advance(state);
    const elseifCondition = parseExpression(state);
    consume(state, TokenKind.Then, 'Expected then');
    const elseifThenExpr = parseExpression(state);
    elseifExprs.push({
      'kind': 'ElseifExpressionClause',
      'condition': elseifCondition,
      'thenExpr': elseifThenExpr,
      'range': createRange(elseifStart.start, elseifThenExpr.range.end),
    });
  }

  consume(state, TokenKind.Else, 'Expected else');
  const elseExpr = parseExpression(state);

  return {
    'kind': 'IfExpression',
    condition,
    thenExpr,
    elseifExprs,
    elseExpr,
    'range': createRange(start.start, elseExpr.range.end),
  };
};

/**
 * Parses a suffix expression (primary expression with optional suffixes like .field, [index], :method(), ()).
 * @param state The parser state (will be mutated)
 * @returns An Expression node with any suffixes applied
 */
const parseSuffixExpression = (state: ParserState): Expression => {
  let expr = parsePrimaryExpression(state);

  while (true) {
    if (check(state, TokenKind.Dot)) {
      advance(state);
      // Allow type/typeof as property names (e.g., item.type)
      const property = isIdentifierLike(state) ? parseIdentifierLike(state) : parseIdentifier(state);
      expr = {
        'kind': 'MemberExpression',
        'object': expr,
        property,
        'range': createRange(expr.range.start, property.range.end),
      };
    } else if (check(state, TokenKind.LeftBracket)) {
      advance(state);
      const index = parseExpression(state);
      const end = consume(state, TokenKind.RightBracket, 'Expected ]');
      expr = {
        'kind': 'IndexExpression',
        'object': expr,
        index,
        'range': createRange(expr.range.start, end.end),
      };
    } else if (check(state, TokenKind.Colon)) {
      advance(state);
      // Allow type/typeof as method names
      const method = isIdentifierLike(state) ? parseIdentifierLike(state) : parseIdentifier(state);
      const args = parseCallArguments(state);
      expr = {
        'kind': 'MethodCallExpression',
        'object': expr,
        method,
        args,
        'range': createRange(expr.range.start, current(state).start),
      };
    } else if (
      check(state, TokenKind.LeftParen) ||
      check(state, TokenKind.LeftBrace) ||
      check(state, TokenKind.String)
    ) {
      const args = parseCallArguments(state);
      expr = {
        'kind': 'CallExpression',
        'callee': expr,
        args,
        'range': createRange(expr.range.start, current(state).start),
      };
    } else if (check(state, TokenKind.DoubleColon)) {
      advance(state);
      const type = parseTypeAnnotation(state);
      expr = {
        'kind': 'TypeCastExpression',
        'expression': expr,
        type,
        'range': createRange(expr.range.start, type.range.end),
      };
    } else {
      break;
    }
  }

  return expr;
};

/**
 * Parses function call arguments (parenthesized list, string literal, or table).
 * @param state The parser state (will be mutated)
 * @returns An array of Expression nodes representing the arguments
 */
const parseCallArguments = (state: ParserState): Expression[] => {
  // String or table as single argument
  if (check(state, TokenKind.String)) {
    const token = advance(state);
    return [
      {
        'kind': 'StringLiteral',
        'value': parseStringValue(token.value),
        'raw': token.value,
        'range': createRange(token.start, token.end),
      },
    ];
  }

  if (check(state, TokenKind.LeftBrace)) {
    return [parseTableExpression(state)];
  }

  // Regular parenthesized arguments
  consume(state, TokenKind.LeftParen, 'Expected (');

  const args: Expression[] = [];

  while (check(state, TokenKind.RightParen) === false && isAtEnd(state) === false) {
    args.push(parseExpression(state));
    if (check(state, TokenKind.Comma) === false) break;
    advance(state);
  }

  consume(state, TokenKind.RightParen, 'Expected )');
  return args;
};

/**
 * Parses a unary expression (-, not, #) or a suffix expression.
 * @param state The parser state (will be mutated)
 * @returns An Expression node
 */
const parseUnaryExpression = (state: ParserState): Expression => {
  if (check(state, TokenKind.Minus) || check(state, TokenKind.Not) || check(state, TokenKind.Hash)) {
    const start = current(state);
    const operator = advance(state).value as UnaryOperator;
    const operand = parseUnaryExpression(state);
    return {
      'kind': 'UnaryExpression',
      operator,
      operand,
      'range': createRange(start.start, operand.range.end),
    };
  }

  return parseSuffixExpression(state);
};

/**
 * Parses a binary expression using precedence climbing.
 * @param state The parser state (will be mutated)
 * @param minPrecedence The minimum precedence level to parse (default 0)
 * @returns An Expression node representing the binary expression tree
 */
const parseBinaryExpression = (state: ParserState, minPrecedence = 0): Expression => {
  let left = parseUnaryExpression(state);

  while (true) {
    const token = current(state);
    const operator = tokenToBinaryOperator(token);

    if (operator === undefined) break;

    const precedence = BINARY_PRECEDENCE.get(operator);
    if (precedence === undefined || precedence < minPrecedence) break;

    advance(state);

    const nextMinPrecedence = isRightAssociative(operator) ? precedence : precedence + 1;
    const right = parseBinaryExpression(state, nextMinPrecedence);

    left = {
      'kind': 'BinaryExpression',
      operator,
      left,
      right,
      'range': createRange(left.range.start, right.range.end),
    };
  }

  return left;
};

/**
 * Converts a token to its corresponding binary operator string, if applicable.
 * @param token The token to convert
 * @returns The binary operator string, or undefined if not a binary operator
 */
const tokenToBinaryOperator = (token: Token): BinaryOperator | undefined => {
  switch (token.kind) {
    case TokenKind.Plus:
      return '+';
    case TokenKind.Minus:
      return '-';
    case TokenKind.Star:
      return '*';
    case TokenKind.Slash:
      return '/';
    case TokenKind.DoubleSlash:
      return '//';
    case TokenKind.Percent:
      return '%';
    case TokenKind.Caret:
      return '^';
    case TokenKind.Concat:
      return '..';
    case TokenKind.Equal:
      return '==';
    case TokenKind.NotEqual:
      return '~=';
    case TokenKind.Less:
      return '<';
    case TokenKind.LessEqual:
      return '<=';
    case TokenKind.Greater:
      return '>';
    case TokenKind.GreaterEqual:
      return '>=';
    case TokenKind.And:
      return 'and';
    case TokenKind.Or:
      return 'or';
    default:
      return undefined;
  }
};

/**
 * Parses an expression.
 * @param state The parser state (will be mutated)
 * @returns An Expression AST node
 */
const parseExpression = (state: ParserState): Expression => parseBinaryExpression(state);

/**
 * Parses a type annotation.
 * @param state The parser state (will be mutated)
 * @returns A TypeAnnotation AST node
 */
const parseTypeAnnotation = (state: ParserState): TypeAnnotation => parseUnionType(state);

/**
 * Parses a union type (A | B | C).
 * @param state The parser state (will be mutated)
 * @returns A TypeAnnotation node (UnionType if multiple types, otherwise the single type)
 */
const parseUnionType = (state: ParserState): TypeAnnotation => {
  let left = parseIntersectionType(state);

  while (check(state, TokenKind.Pipe)) {
    advance(state);
    const right = parseIntersectionType(state);
    left = {
      'kind': 'UnionType',
      'types': left.kind === 'UnionType' ? [...left.types, right] : [left, right],
      'range': createRange(left.range.start, right.range.end),
    };
  }

  return left;
};

/**
 * Parses an intersection type (A & B & C).
 * @param state The parser state (will be mutated)
 * @returns A TypeAnnotation node (IntersectionType if multiple types, otherwise the single type)
 */
const parseIntersectionType = (state: ParserState): TypeAnnotation => {
  let left = parsePrimaryType(state);

  while (check(state, TokenKind.Ampersand)) {
    advance(state);
    const right = parsePrimaryType(state);
    left = {
      'kind': 'IntersectionType',
      'types': left.kind === 'IntersectionType' ? [...left.types, right] : [left, right],
      'range': createRange(left.range.start, right.range.end),
    };
  }

  return left;
};

/**
 * Parses a primary type (typeof, parenthesized type, table type, variadic, literal, or type reference).
 * @param state The parser state (will be mutated)
 * @returns A TypeAnnotation AST node
 */
const parsePrimaryType = (state: ParserState): TypeAnnotation => {
  const start = current(state);

  // typeof
  if (check(state, TokenKind.Typeof)) {
    advance(state);
    consume(state, TokenKind.LeftParen, 'Expected (');
    const expression = parseExpression(state);
    const end = consume(state, TokenKind.RightParen, 'Expected )');
    return {
      'kind': 'TypeofType',
      expression,
      'range': createRange(start.start, end.end),
    };
  }

  // Parenthesized type or function type
  if (check(state, TokenKind.LeftParen)) {
    return parseFunctionOrParenType(state);
  }

  // Table type
  if (check(state, TokenKind.LeftBrace)) {
    return parseTableType(state);
  }

  // Variadic type
  if (check(state, TokenKind.Vararg)) {
    advance(state);
    const type = parsePrimaryType(state);
    return {
      'kind': 'VariadicType',
      type,
      'range': createRange(start.start, type.range.end),
    };
  }

  // String literal type
  if (check(state, TokenKind.String)) {
    const token = advance(state);
    return {
      'kind': 'TypeLiteral',
      'value': parseStringValue(token.value),
      'range': createRange(start.start, token.end),
    };
  }

  // Boolean literal type
  if (check(state, TokenKind.True)) {
    advance(state);
    return { 'kind': 'TypeLiteral', 'value': true, 'range': createRange(start.start, start.end) };
  }

  if (check(state, TokenKind.False)) {
    advance(state);
    return { 'kind': 'TypeLiteral', 'value': false, 'range': createRange(start.start, start.end) };
  }

  // Type reference (identifier with optional generics)
  if (check(state, TokenKind.Identifier)) {
    return parseTypeReference(state);
  }

  // Error
  state.errors.push({
    'message': `Unexpected token in type: ${current(state).kind}`,
    'range': createRange(start.start, start.end),
  });
  advance(state);
  return { 'kind': 'ErrorType', 'message': 'Unexpected token', 'range': createRange(start.start, start.end) };
};

/**
 * Parses a type reference (identifier with optional module prefix and type arguments).
 * @param state The parser state (will be mutated)
 * @returns A TypeReference node (possibly wrapped in OptionalType)
 */
const parseTypeReference = (state: ParserState): TypeAnnotation => {
  const start = current(state);
  let name = consume(state, TokenKind.Identifier, 'Expected type name').value;
  let moduleName: string | undefined;

  // Check for module.Type
  if (check(state, TokenKind.Dot)) {
    advance(state);
    moduleName = name;
    name = consume(state, TokenKind.Identifier, 'Expected type name').value;
  }

  // Check for type arguments
  let typeArgs: TypeAnnotation[] | undefined;
  if (check(state, TokenKind.Less)) {
    advance(state);
    typeArgs = [];

    while (check(state, TokenKind.Greater) === false && isAtEnd(state) === false) {
      typeArgs.push(parseTypeAnnotation(state));
      if (check(state, TokenKind.Comma) === false) break;
      advance(state);
    }

    consume(state, TokenKind.Greater, 'Expected >');
  }

  let type: TypeAnnotation = {
    'kind': 'TypeReference',
    name,
    'module': moduleName,
    typeArgs,
    'range': createRange(start.start, current(state).start),
  };

  // Check for optional type suffix
  if (check(state, TokenKind.Question)) {
    advance(state);
    type = {
      'kind': 'OptionalType',
      type,
      'range': createRange(start.start, current(state).start),
    };
  }

  return type;
};

/**
 * Parses either a function type or a parenthesized type.
 * Disambiguates based on presence of -> after the closing parenthesis.
 * @param state The parser state (will be mutated)
 * @returns A FunctionType, ParenthesizedType, or ErrorType node
 */
const parseFunctionOrParenType = (state: ParserState): TypeAnnotation => {
  const start = current(state);
  consume(state, TokenKind.LeftParen, 'Expected (');

  // Check if this is a function type by looking for ->
  // We need to parse the parameter list and then check

  const params: FunctionTypeParam[] = [];
  let isVariadic = false;
  let thisType: TypeAnnotation | undefined;

  while (check(state, TokenKind.RightParen) === false && isAtEnd(state) === false) {
    const paramStart = current(state);

    // Handle 'this' type annotation
    if (check(state, TokenKind.Identifier) && current(state).value === 'this') {
      advance(state);
      consume(state, TokenKind.Colon, 'Expected :');
      thisType = parseTypeAnnotation(state);

      if (check(state, TokenKind.Comma)) {
        advance(state);
      }
      continue;
    }

    // Handle variadic
    if (check(state, TokenKind.Vararg)) {
      advance(state);
      const type = parseTypeAnnotation(state);
      params.push({
        'kind': 'FunctionTypeParam',
        'name': undefined,
        type,
        'range': createRange(paramStart.start, type.range.end),
      });
      isVariadic = true;
      break;
    }

    // Check for named parameter (name: type) or just type
    let paramName: string | undefined;
    let paramType: TypeAnnotation;

    if (check(state, TokenKind.Identifier) && peek(state, 1).kind === TokenKind.Colon) {
      paramName = advance(state).value;
      advance(state); // :
      paramType = parseTypeAnnotation(state);
    } else {
      paramType = parseTypeAnnotation(state);
    }

    params.push({
      'kind': 'FunctionTypeParam',
      'name': paramName,
      'type': paramType,
      'range': createRange(paramStart.start, paramType.range.end),
    });

    if (check(state, TokenKind.Comma) === false) break;
    advance(state);
  }

  consume(state, TokenKind.RightParen, 'Expected )');

  // If we see ->, it's a function type
  if (check(state, TokenKind.Arrow)) {
    advance(state);
    const returnType = parseTypeAnnotation(state);
    return {
      'kind': 'FunctionType',
      'typeParams': undefined,
      thisType,
      params,
      returnType,
      isVariadic,
      'range': createRange(start.start, returnType.range.end),
    };
  }

  // Otherwise, if there's only one param with no name, it's a parenthesized type
  if (params.length === 1 && params[0]!.name === undefined) {
    return {
      'kind': 'ParenthesizedType',
      'type': params[0]!.type,
      'range': createRange(start.start, current(state).start),
    };
  }

  // Error - malformed type
  state.errors.push({
    'message': 'Expected -> for function type',
    'range': createRange(start.start, current(state).start),
  });
  return { 'kind': 'ErrorType', 'message': 'Malformed type', 'range': createRange(start.start, current(state).start) };
};

/**
 * Parses a table type ({ field: Type, [KeyType]: ValueType }).
 * @param state The parser state (will be mutated)
 * @returns A TableType node
 */
const parseTableType = (state: ParserState): TypeAnnotation => {
  const start = current(state);
  consume(state, TokenKind.LeftBrace, 'Expected {');

  const properties: TableTypeProperty[] = [];
  let indexer:
    | { kind: 'TableTypeIndexer'; keyType: TypeAnnotation; valueType: TypeAnnotation; range: NodeRange }
    | undefined;

  while (check(state, TokenKind.RightBrace) === false && isAtEnd(state) === false) {
    const propStart = current(state);

    // [type]: type (indexer)
    if (check(state, TokenKind.LeftBracket)) {
      advance(state);
      const keyType = parseTypeAnnotation(state);
      consume(state, TokenKind.RightBracket, 'Expected ]');
      consume(state, TokenKind.Colon, 'Expected :');
      const valueType = parseTypeAnnotation(state);
      indexer = {
        'kind': 'TableTypeIndexer',
        keyType,
        valueType,
        'range': createRange(propStart.start, valueType.range.end),
      };
    } else if (check(state, TokenKind.Identifier)) {
      // name: type
      const name = advance(state).value;
      consume(state, TokenKind.Colon, 'Expected :');
      const type = parseTypeAnnotation(state);
      properties.push({
        'kind': 'TableTypeProperty',
        name,
        type,
        'isReadonly': false,
        'range': createRange(propStart.start, type.range.end),
      });
    }

    if (check(state, TokenKind.Comma) || check(state, TokenKind.Semicolon)) {
      advance(state);
    } else {
      break;
    }
  }

  const end = consume(state, TokenKind.RightBrace, 'Expected }');
  return {
    'kind': 'TableType',
    properties,
    indexer,
    'range': createRange(start.start, end.end),
  };
};

/**
 * Parses a statement, dispatching to the appropriate parser based on the current token.
 * @param state The parser state (will be mutated)
 * @returns A Statement AST node
 */
const parseStatement = (state: ParserState): Statement => {
  const token = current(state);

  switch (token.kind) {
    case TokenKind.Local:
      return parseLocalStatement(state);
    case TokenKind.Function:
      return parseFunctionStatement(state);
    case TokenKind.If:
      return parseIfStatement(state);
    case TokenKind.While:
      return parseWhileStatement(state);
    case TokenKind.Repeat:
      return parseRepeatStatement(state);
    case TokenKind.For:
      return parseForStatement(state);
    case TokenKind.Do:
      return parseDoStatement(state);
    case TokenKind.Return:
      return parseReturnStatement(state);
    case TokenKind.Break:
      advance(state);
      return { 'kind': 'BreakStatement', 'range': createRange(token.start, token.end) };
    case TokenKind.Continue:
      advance(state);
      return { 'kind': 'ContinueStatement', 'range': createRange(token.start, token.end) };
    case TokenKind.Type:
      // Check if this is a type alias (type Name = ...) or a function call (type({}))
      // Type alias is followed by identifier, function call is followed by ( or string/table
      if (checkAhead(state, 1, TokenKind.Identifier)) {
        return parseTypeAliasStatement(state);
      }
      // Otherwise treat as expression statement (type(...) function call)
      return parseExpressionStatement(state);
    case TokenKind.Export:
      return parseExportStatement(state);
    default:
      return parseExpressionStatement(state);
  }
};

/**
 * Parses a local statement (local variable declaration or local function).
 * @param state The parser state (will be mutated)
 * @returns A LocalDeclaration or LocalFunction node
 */
const parseLocalStatement = (state: ParserState): LocalDeclaration | LocalFunction => {
  const docComment = collectDocComment(state);
  const start = current(state);
  consume(state, TokenKind.Local, 'Expected local');

  if (check(state, TokenKind.Function)) {
    advance(state);
    const name = parseIdentifier(state);
    const typeParams = parseOptionalTypeParameters(state);
    const { params, isVariadic } = parseParameters(state);
    const returnType = parseOptionalReturnType(state);
    const body = parseBlock(state);
    const end = consume(state, TokenKind.End, 'Expected end');

    const func: FunctionExpression = {
      'kind': 'FunctionExpression',
      typeParams,
      params,
      returnType,
      body,
      isVariadic,
      'range': createRange(start.start, end.end),
    };

    return {
      'kind': 'LocalFunction',
      name,
      func,
      docComment,
      'range': createRange(start.start, end.end),
    };
  }

  const names: Identifier[] = [];
  const types: (TypeAnnotation | undefined)[] = [];

  do {
    names.push(parseIdentifier(state));

    if (check(state, TokenKind.Colon)) {
      advance(state);
      types.push(parseTypeAnnotation(state));
    } else {
      types.push(undefined);
    }
  } while (match(state, TokenKind.Comma));

  const values: Expression[] = [];
  if (match(state, TokenKind.Assign)) {
    do {
      values.push(parseExpression(state));
    } while (match(state, TokenKind.Comma));
  }

  return {
    'kind': 'LocalDeclaration',
    names,
    types,
    values,
    docComment,
    'range': createRange(start.start, current(state).start),
  };
};

/**
 * Parses a global function declaration statement.
 * @param state The parser state (will be mutated)
 * @returns A FunctionDeclaration node
 */
const parseFunctionStatement = (state: ParserState): FunctionDeclaration => {
  const docComment = collectDocComment(state);
  const start = current(state);
  consume(state, TokenKind.Function, 'Expected function');

  const funcName = parseFunctionName(state);
  const typeParams = parseOptionalTypeParameters(state);
  const { params, isVariadic } = parseParameters(state);
  const returnType = parseOptionalReturnType(state);
  const body = parseBlock(state);
  const end = consume(state, TokenKind.End, 'Expected end');

  const func: FunctionExpression = {
    'kind': 'FunctionExpression',
    typeParams,
    params,
    returnType,
    body,
    isVariadic,
    'range': createRange(start.start, end.end),
  };

  return {
    'kind': 'FunctionDeclaration',
    'name': funcName,
    func,
    docComment,
    'isLocal': false,
    'range': createRange(start.start, end.end),
  };
};

/**
 * Parses a function name (base.path1.path2:method).
 * @param state The parser state (will be mutated)
 * @returns A FunctionName node
 */
const parseFunctionName = (state: ParserState): FunctionName => {
  const start = current(state);
  const base = parseIdentifier(state);
  const path: Identifier[] = [];
  let method: Identifier | undefined;

  while (check(state, TokenKind.Dot)) {
    advance(state);
    path.push(parseIdentifier(state));
  }

  if (check(state, TokenKind.Colon)) {
    advance(state);
    method = parseIdentifier(state);
  }

  return {
    'kind': 'FunctionName',
    base,
    path,
    method,
    'range': createRange(start.start, current(state).start),
  };
};

/**
 * Parses an if statement with optional elseif and else clauses.
 * @param state The parser state (will be mutated)
 * @returns An IfStatement node
 */
const parseIfStatement = (state: ParserState): IfStatement => {
  const start = current(state);
  consume(state, TokenKind.If, 'Expected if');

  const condition = parseExpression(state);
  consume(state, TokenKind.Then, 'Expected then');
  const thenBody = parseBlock(state);

  const elseifClauses: ElseifClause[] = [];

  while (check(state, TokenKind.Elseif)) {
    const elseifStart = current(state);
    advance(state);
    const elseifCondition = parseExpression(state);
    consume(state, TokenKind.Then, 'Expected then');
    const elseifBody = parseBlock(state);
    elseifClauses.push({
      'kind': 'ElseifClause',
      'condition': elseifCondition,
      'body': elseifBody,
      'range': createRange(elseifStart.start, current(state).start),
    });
  }

  let elseBody: Statement[] | undefined;
  if (check(state, TokenKind.Else)) {
    advance(state);
    elseBody = parseBlock(state);
  }

  const end = consume(state, TokenKind.End, 'Expected end');

  return {
    'kind': 'IfStatement',
    condition,
    thenBody,
    elseifClauses,
    elseBody,
    'range': createRange(start.start, end.end),
  };
};

/**
 * Parses a while loop statement.
 * @param state The parser state (will be mutated)
 * @returns A WhileStatement node
 */
const parseWhileStatement = (state: ParserState): WhileStatement => {
  const start = current(state);
  consume(state, TokenKind.While, 'Expected while');

  const condition = parseExpression(state);
  consume(state, TokenKind.Do, 'Expected do');
  const body = parseBlock(state);
  const end = consume(state, TokenKind.End, 'Expected end');

  return {
    'kind': 'WhileStatement',
    condition,
    body,
    'range': createRange(start.start, end.end),
  };
};

/**
 * Parses a repeat-until loop statement.
 * @param state The parser state (will be mutated)
 * @returns A RepeatStatement node
 */
const parseRepeatStatement = (state: ParserState): RepeatStatement => {
  const start = current(state);
  consume(state, TokenKind.Repeat, 'Expected repeat');

  const body = parseBlock(state);
  consume(state, TokenKind.Until, 'Expected until');
  const condition = parseExpression(state);

  return {
    'kind': 'RepeatStatement',
    body,
    condition,
    'range': createRange(start.start, current(state).start),
  };
};

/**
 * Parses a for loop statement (either numeric or generic).
 * @param state The parser state (will be mutated)
 * @returns A ForNumeric or ForGeneric node
 */
const parseForStatement = (state: ParserState): ForNumeric | ForGeneric => {
  const start = current(state);
  consume(state, TokenKind.For, 'Expected for');

  const firstVar = parseIdentifier(state);

  // Numeric for: for i = start, end, step do
  if (check(state, TokenKind.Assign)) {
    advance(state);
    const startExpr = parseExpression(state);
    consume(state, TokenKind.Comma, 'Expected ,');
    const endExpr = parseExpression(state);

    let stepExpr: Expression | undefined;
    if (check(state, TokenKind.Comma)) {
      advance(state);
      stepExpr = parseExpression(state);
    }

    consume(state, TokenKind.Do, 'Expected do');
    const body = parseBlock(state);
    const end = consume(state, TokenKind.End, 'Expected end');

    return {
      'kind': 'ForNumeric',
      'variable': firstVar,
      'start': startExpr,
      'end': endExpr,
      'step': stepExpr,
      body,
      'range': createRange(start.start, end.end),
    };
  }

  // Generic for: for k, v in iterator do
  const variables: Identifier[] = [firstVar];
  while (check(state, TokenKind.Comma)) {
    advance(state);
    variables.push(parseIdentifier(state));
  }

  consume(state, TokenKind.In, 'Expected in');

  const iterators: Expression[] = [];
  do {
    iterators.push(parseExpression(state));
  } while (match(state, TokenKind.Comma));

  consume(state, TokenKind.Do, 'Expected do');
  const body = parseBlock(state);
  const end = consume(state, TokenKind.End, 'Expected end');

  return {
    'kind': 'ForGeneric',
    variables,
    iterators,
    body,
    'range': createRange(start.start, end.end),
  };
};

/**
 * Parses a do-end block statement.
 * @param state The parser state (will be mutated)
 * @returns A DoStatement node
 */
const parseDoStatement = (state: ParserState): DoStatement => {
  const start = current(state);
  consume(state, TokenKind.Do, 'Expected do');
  const body = parseBlock(state);
  const end = consume(state, TokenKind.End, 'Expected end');

  return {
    'kind': 'DoStatement',
    body,
    'range': createRange(start.start, end.end),
  };
};

/**
 * Parses a return statement with optional return values.
 * @param state The parser state (will be mutated)
 * @returns A ReturnStatement node
 */
const parseReturnStatement = (state: ParserState): ReturnStatement => {
  const start = current(state);
  consume(state, TokenKind.Return, 'Expected return');

  const values: Expression[] = [];

  // Check if there are return values (not at end of block or followed by semicolon)
  if (
    isAtEnd(state) === false &&
    check(state, TokenKind.End) === false &&
    check(state, TokenKind.Else) === false &&
    check(state, TokenKind.Elseif) === false &&
    check(state, TokenKind.Until) === false &&
    check(state, TokenKind.Semicolon) === false
  ) {
    do {
      values.push(parseExpression(state));
    } while (match(state, TokenKind.Comma));
  }

  return {
    'kind': 'ReturnStatement',
    values,
    'range': createRange(start.start, current(state).start),
  };
};

/**
 * Parses a type alias statement (type Name = Type).
 * @param state The parser state (will be mutated)
 * @param existingDocComment Optional pre-collected documentation comment
 * @returns A TypeAlias node
 */
const parseTypeAliasStatement = (state: ParserState, existingDocComment?: DocComment): TypeAlias => {
  const docComment = existingDocComment ?? collectDocComment(state);
  const start = current(state);
  consume(state, TokenKind.Type, 'Expected type');

  const name = parseIdentifier(state);
  const typeParams = parseOptionalTypeParameters(state);
  consume(state, TokenKind.Assign, 'Expected =');
  const type = parseTypeAnnotation(state);

  return {
    'kind': 'TypeAlias',
    name,
    typeParams,
    type,
    docComment,
    'range': createRange(start.start, type.range.end),
  };
};

/**
 * Parses an export statement (export type Name = Type).
 * @param state The parser state (will be mutated)
 * @returns An ExportStatement node
 */
const parseExportStatement = (state: ParserState): ExportStatement => {
  const docComment = collectDocComment(state);
  const start = current(state);
  consume(state, TokenKind.Export, 'Expected export');

  const declaration = parseTypeAliasStatement(state, docComment);

  return {
    'kind': 'ExportStatement',
    declaration,
    'range': createRange(start.start, declaration.range.end),
  };
};

/**
 * Parses an expression statement (assignment, compound assignment, or call statement).
 * @param state The parser state (will be mutated)
 * @returns An Assignment, CompoundAssignment, CallStatement, or ErrorStatement node
 */
const parseExpressionStatement = (state: ParserState): Statement => {
  const start = current(state);
  const expr = parseSuffixExpression(state);

  // Check for assignment
  if (check(state, TokenKind.Assign) || check(state, TokenKind.Comma)) {
    const targets: AssignmentTarget[] = [expr as AssignmentTarget];

    while (check(state, TokenKind.Comma)) {
      advance(state);
      targets.push(parseSuffixExpression(state) as AssignmentTarget);
    }

    consume(state, TokenKind.Assign, 'Expected =');

    const values: Expression[] = [];
    do {
      values.push(parseExpression(state));
    } while (match(state, TokenKind.Comma));

    return {
      'kind': 'Assignment',
      targets,
      values,
      'range': createRange(start.start, current(state).start),
    };
  }

  // Check for compound assignment
  const compoundOp = getCompoundOperator(current(state));
  if (compoundOp !== undefined) {
    advance(state);
    const value = parseExpression(state);

    return {
      'kind': 'CompoundAssignment',
      'target': expr as AssignmentTarget,
      'operator': compoundOp,
      value,
      'range': createRange(start.start, value.range.end),
    };
  }

  // Must be a call statement
  if (expr.kind === 'CallExpression' || expr.kind === 'MethodCallExpression') {
    return {
      'kind': 'CallStatement',
      'expression': expr,
      'range': expr.range,
    };
  }

  // Error - expression is not a valid statement
  state.errors.push({
    'message': 'Expression is not a valid statement',
    'range': expr.range,
  });

  return {
    'kind': 'ErrorStatement',
    'message': 'Expression is not a valid statement',
    'range': expr.range,
  };
};

/**
 * Gets the compound assignment operator for a token, if applicable.
 * @param token The token to check
 * @returns The compound operator string, or undefined if not a compound assignment
 */
const getCompoundOperator = (token: Token): CompoundOperator | undefined => {
  switch (token.kind) {
    case TokenKind.PlusAssign:
      return '+=';
    case TokenKind.MinusAssign:
      return '-=';
    case TokenKind.StarAssign:
      return '*=';
    case TokenKind.SlashAssign:
      return '/=';
    case TokenKind.DoubleSlashAssign:
      return '//=';
    case TokenKind.PercentAssign:
      return '%=';
    case TokenKind.CaretAssign:
      return '^=';
    case TokenKind.ConcatAssign:
      return '..=';
    default:
      return undefined;
  }
};

/**
 * Parses a block of statements until a block-ending keyword is reached.
 * @param state The parser state (will be mutated)
 * @returns An array of Statement nodes
 */
const parseBlock = (state: ParserState): Statement[] => {
  const statements: Statement[] = [];

  while (
    isAtEnd(state) === false &&
    check(state, TokenKind.End) === false &&
    check(state, TokenKind.Else) === false &&
    check(state, TokenKind.Elseif) === false &&
    check(state, TokenKind.Until) === false
  ) {
    // Skip optional semicolons between statements
    while (check(state, TokenKind.Semicolon)) {
      advance(state);
    }

    // Check again after skipping semicolons
    if (
      isAtEnd(state) ||
      check(state, TokenKind.End) ||
      check(state, TokenKind.Else) ||
      check(state, TokenKind.Elseif) ||
      check(state, TokenKind.Until)
    ) {
      break;
    }

    try {
      statements.push(parseStatement(state));
    } catch {
      synchronize(state);
    }
  }

  return statements;
};

/**
 * Finds a documentation comment that immediately precedes a token.
 * @param state The parser state
 * @param tokenOffset The offset of the token to find preceding comments for
 * @returns A DocComment if found, undefined otherwise
 */
const findPrecedingDocComment = (state: ParserState, tokenOffset: number): DocComment | undefined => {
  const docCommentLines: string[] = [];

  for (let i = 0; i < state.allTokens.length; i++) {
    const token = state.allTokens[i]!;
    if (token.start.offset >= tokenOffset) break;

    if (token.kind === TokenKind.Comment && token.value.startsWith('---')) {
      const nextNonTrivia = state.allTokens.slice(i + 1).find(t => isTrivia(t.kind) === false);
      if (nextNonTrivia !== undefined && nextNonTrivia.start.offset === tokenOffset) {
        docCommentLines.push(token.value);
      } else if (docCommentLines.length > 0) {
        const lastDocLine = state.allTokens[i - 1];
        if (
          lastDocLine !== undefined &&
          lastDocLine.kind === TokenKind.Comment &&
          lastDocLine.value.startsWith('---')
        ) {
          docCommentLines.push(token.value);
        }
      }
    } else if (token.kind !== TokenKind.Whitespace && token.kind !== TokenKind.Newline) {
      docCommentLines.length = 0;
    }
  }

  if (docCommentLines.length === 0) return undefined;

  const combined = docCommentLines.join('\n');
  return parseDocComment(combined);
};

/**
 * Collects any documentation comment that precedes the current token.
 * @param state The parser state
 * @returns A DocComment if found, undefined otherwise
 */
const collectDocComment = (state: ParserState): DocComment | undefined => {
  const currentToken = current(state);
  return findPrecedingDocComment(state, currentToken.start.offset);
};

/**
 * Parses Luau source code into an Abstract Syntax Tree (AST).
 * @param source The Luau source code to parse
 * @returns A ParseResult containing the AST and any parsing errors
 */
export const parse = (source: string): ParseResult => {
  const allTokens = createLexer(source).tokens();
  const tokens = allTokens.filter(t => isTrivia(t.kind) === false);
  const comments: Comment[] = allTokens
    .filter(t => t.kind === TokenKind.Comment)
    .map(t => ({
      'kind': 'Comment' as const,
      'value': t.value,
      'isBlock': t.value.startsWith('--[[') || t.value.startsWith('--[='),
      'range': createRange(t.start, t.end),
    }));

  const state: ParserState = {
    tokens,
    allTokens,
    comments,
    'errors': [],
    'current': 0,
    'pendingDocComment': undefined,
  };

  const body: Statement[] = [];

  while (isAtEnd(state) === false) {
    while (check(state, TokenKind.Semicolon)) {
      advance(state);
    }

    if (isAtEnd(state)) break;

    try {
      body.push(parseStatement(state));
    } catch {
      synchronize(state);
    }
  }

  const startPos = tokens[0]?.start ?? { 'offset': 0, 'line': 1, 'column': 1 };
  const endPos = tokens[tokens.length - 1]?.end ?? startPos;

  const ast: Chunk = {
    'kind': 'Chunk',
    body,
    comments,
    'range': createRange(startPos, endPos),
  };

  return {
    ast,
    'errors': state.errors,
  };
};
