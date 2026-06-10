import {
  TokenKind,
  TokenKindName,
  type BinaryOpInfo,
  type DocComment,
  type ParseResult,
  type ParserState,
  type Token,
  type TokenPosition,
} from '@typings/parser';

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
} from '@typings/ast';
import { parseDocComment } from '@parser/docComment';
import { createLexer } from '@parser/lexer';
import { isTrivia } from '@parser/tokens';

const BINARY_OP_INFO: ReadonlyMap<TokenKind, BinaryOpInfo> = new Map([
  [TokenKind.Or, { 'operator': 'or' as BinaryOperator, 'precedence': 1, 'rightAssociative': false }],
  [TokenKind.And, { 'operator': 'and' as BinaryOperator, 'precedence': 2, 'rightAssociative': false }],
  [TokenKind.Less, { 'operator': '<' as BinaryOperator, 'precedence': 3, 'rightAssociative': false }],
  [TokenKind.Greater, { 'operator': '>' as BinaryOperator, 'precedence': 3, 'rightAssociative': false }],
  [TokenKind.LessEqual, { 'operator': '<=' as BinaryOperator, 'precedence': 3, 'rightAssociative': false }],
  [TokenKind.GreaterEqual, { 'operator': '>=' as BinaryOperator, 'precedence': 3, 'rightAssociative': false }],
  [TokenKind.NotEqual, { 'operator': '~=' as BinaryOperator, 'precedence': 3, 'rightAssociative': false }],
  [TokenKind.Equal, { 'operator': '==' as BinaryOperator, 'precedence': 3, 'rightAssociative': false }],
  [TokenKind.Concat, { 'operator': '..' as BinaryOperator, 'precedence': 4, 'rightAssociative': true }],
  [TokenKind.Plus, { 'operator': '+' as BinaryOperator, 'precedence': 5, 'rightAssociative': false }],
  [TokenKind.Minus, { 'operator': '-' as BinaryOperator, 'precedence': 5, 'rightAssociative': false }],
  [TokenKind.Star, { 'operator': '*' as BinaryOperator, 'precedence': 6, 'rightAssociative': false }],
  [TokenKind.Slash, { 'operator': '/' as BinaryOperator, 'precedence': 6, 'rightAssociative': false }],
  [TokenKind.DoubleSlash, { 'operator': '//' as BinaryOperator, 'precedence': 6, 'rightAssociative': false }],
  [TokenKind.Percent, { 'operator': '%' as BinaryOperator, 'precedence': 6, 'rightAssociative': false }],
  [TokenKind.Caret, { 'operator': '^' as BinaryOperator, 'precedence': 8, 'rightAssociative': true }],
]);

const peek = (state: ParserState, offset = 0): Token => {
  const index = state.current + offset;
  if (index >= state.tokens.length) return state.tokens[state.tokens.length - 1]!;
  return state.tokens[index]!;
};

const current = (state: ParserState): Token => peek(state, 0);

const isAtEnd = (state: ParserState): boolean => current(state).kind === TokenKind.EOF;

const check = (state: ParserState, kind: TokenKind): boolean => current(state).kind === kind;

const checkAhead = (state: ParserState, offset: number, kind: TokenKind): boolean => {
  const index = state.current + offset;
  if (index >= state.tokens.length) return false;
  return state.tokens[index]?.kind === kind;
};

const advance = (state: ParserState): Token => {
  if (isAtEnd(state) === false) state.current++;
  return state.tokens[state.current - 1]!;
};

const consume = (state: ParserState, kind: TokenKind, message: string): Token => {
  if (check(state, kind)) return advance(state);

  const token = current(state);
  state.errors.push({
    message,
    'range': { 'start': token.start, 'end': token.end },
  });
  return token;
};

const match = (state: ParserState, ...kinds: TokenKind[]): boolean => {
  for (const kind of kinds)
    if (check(state, kind)) {
      advance(state);
      return true;
    }
  return false;
};

const createRange = (start: TokenPosition, end: TokenPosition): NodeRange => ({ start, end });

const SYNC_TOKENS: ReadonlySet<TokenKind> = new Set([
  TokenKind.End,
  TokenKind.Local,
  TokenKind.Function,
  TokenKind.If,
  TokenKind.While,
  TokenKind.For,
  TokenKind.Repeat,
  TokenKind.Return,
  TokenKind.Do,
  TokenKind.Type,
  TokenKind.Export,
]);

const BLOCK_END_TOKENS: ReadonlySet<TokenKind> = new Set([
  TokenKind.End,
  TokenKind.Else,
  TokenKind.Elseif,
  TokenKind.Until,
]);

const RETURN_END_TOKENS: ReadonlySet<TokenKind> = new Set([
  TokenKind.End,
  TokenKind.Else,
  TokenKind.Elseif,
  TokenKind.Until,
  TokenKind.Semicolon,
]);

const synchronize = (state: ParserState): void => {
  advance(state);

  while (isAtEnd(state) === false) {
    if (SYNC_TOKENS.has(current(state).kind)) return;

    advance(state);
  }
};

const parseIdentifier = (state: ParserState): Identifier => {
  const token = consume(state, TokenKind.Identifier, 'Expected identifier');
  return {
    'kind': 'Identifier',
    'name': token.value,
    'range': createRange(token.start, token.end),
  };
};

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
        'message': `Unexpected token: ${TokenKindName.get(token.kind) ?? 'Unknown'}`,
        'range': createRange(token.start, token.end),
      });
      advance(state);
      return {
        'kind': 'ErrorExpression',
        'message': `Unexpected token: ${TokenKindName.get(token.kind) ?? 'Unknown'}`,
        'range': createRange(token.start, token.end),
      };
  }
};

const parseStringValue = (raw: string): string => {
  if (raw.startsWith('[[') || raw.startsWith('[=')) {
    const level = raw.match(/^\[=*\[/)![0].length - 2;
    const endPattern = ']' + '='.repeat(level) + ']';
    const startIndex = level + 2;
    const endIndex = raw.lastIndexOf(endPattern);
    return raw.slice(startIndex, endIndex);
  }

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

const parseInterpolatedString = (state: ParserState): Expression => {
  const start = current(state);
  advance(state);

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

const parseTableExpression = (state: ParserState): Expression => {
  const start = current(state);
  consume(state, TokenKind.LeftBrace, 'Expected {');

  const fields: TableField[] = [];

  while (check(state, TokenKind.RightBrace) === false && isAtEnd(state) === false) {
    fields.push(parseTableField(state));

    if (check(state, TokenKind.Comma) || check(state, TokenKind.Semicolon)) advance(state);
    else break;
  }

  const end = consume(state, TokenKind.RightBrace, 'Expected }');
  return {
    'kind': 'TableExpression',
    fields,
    'range': createRange(start.start, end.end),
  };
};

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

const isIdentifierLike = (state: ParserState): boolean => {
  const kind = current(state).kind;
  return kind === TokenKind.Identifier || CONTEXTUAL_KEYWORDS.has(kind);
};

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

const parseTableField = (state: ParserState): TableField => {
  const start = current(state);

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

  const value = parseExpression(state);
  return {
    'kind': 'TableFieldValue',
    value,
    'range': createRange(start.start, value.range.end),
  };
};

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

const parseOptionalTypeParameters = (state: ParserState): ReadonlyArray<TypeParameter> | undefined => {
  if (check(state, TokenKind.Less) === false) return undefined;
  advance(state);

  const params: TypeParameter[] = [];

  do {
    const start = current(state);
    const name = consume(state, TokenKind.Identifier, 'Expected type parameter name').value;

    let constraint: TypeAnnotation | undefined;
    let defaultType: TypeAnnotation | undefined;

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

const parseOptionalReturnType = (state: ParserState): TypeAnnotation | undefined => {
  if (check(state, TokenKind.Colon) === false) return undefined;
  advance(state);
  return parseTypeAnnotation(state);
};

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

const parseSuffixExpression = (state: ParserState): Expression => {
  let expr = parsePrimaryExpression(state);

  while (true)
    if (check(state, TokenKind.Dot)) {
      advance(state);
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
    } else break;

  return expr;
};

const parseCallArguments = (state: ParserState): Expression[] => {
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

  if (check(state, TokenKind.LeftBrace)) return [parseTableExpression(state)];

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

const parseBinaryExpression = (state: ParserState, minPrecedence = 0): Expression => {
  let left = parseUnaryExpression(state);

  while (true) {
    const info = BINARY_OP_INFO.get(current(state).kind);
    if (info === undefined || info.precedence < minPrecedence) break;

    advance(state);

    const nextMinPrecedence = info.rightAssociative ? info.precedence : info.precedence + 1;
    const right = parseBinaryExpression(state, nextMinPrecedence);

    left = {
      'kind': 'BinaryExpression',
      'operator': info.operator,
      left,
      right,
      'range': createRange(left.range.start, right.range.end),
    };
  }

  return left;
};

const parseExpression = (state: ParserState): Expression => parseBinaryExpression(state);

const parseTypeAnnotation = (state: ParserState): TypeAnnotation => parseUnionType(state);

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

const parsePrimaryType = (state: ParserState): TypeAnnotation => {
  const start = current(state);
  let type: TypeAnnotation;

  if (check(state, TokenKind.Typeof)) {
    advance(state);
    consume(state, TokenKind.LeftParen, 'Expected (');
    const expression = parseExpression(state);
    const end = consume(state, TokenKind.RightParen, 'Expected )');
    type = {
      'kind': 'TypeofType',
      expression,
      'range': createRange(start.start, end.end),
    };
  } else if (check(state, TokenKind.LeftParen)) type = parseFunctionOrParenType(state);
  else if (check(state, TokenKind.LeftBrace)) type = parseTableType(state);
  else if (check(state, TokenKind.Vararg)) {
    advance(state);
    const inner = parsePrimaryType(state);
    type = {
      'kind': 'VariadicType',
      'type': inner,
      'range': createRange(start.start, inner.range.end),
    };
  } else if (check(state, TokenKind.String)) {
    const token = advance(state);
    type = {
      'kind': 'TypeLiteral',
      'value': parseStringValue(token.value),
      'range': createRange(start.start, token.end),
    };
  } else if (check(state, TokenKind.Number)) {
    const token = advance(state);
    type = {
      'kind': 'TypeLiteral',
      'value': Number(token.value),
      'range': createRange(start.start, token.end),
    };
  } else if (check(state, TokenKind.True)) {
    advance(state);
    type = { 'kind': 'TypeLiteral', 'value': true, 'range': createRange(start.start, start.end) };
  } else if (check(state, TokenKind.False)) {
    advance(state);
    type = { 'kind': 'TypeLiteral', 'value': false, 'range': createRange(start.start, start.end) };
  } else if (check(state, TokenKind.Nil)) {
    advance(state);
    type = {
      'kind': 'TypeReference',
      'name': 'nil',
      'module': undefined,
      'typeArgs': undefined,
      'range': createRange(start.start, start.end),
    };
  } else if (check(state, TokenKind.Identifier)) type = parseTypeReference(state);
  else {
    state.errors.push({
      'message': `Unexpected token in type: ${TokenKindName.get(current(state).kind) ?? 'Unknown'}`,
      'range': createRange(start.start, start.end),
    });
    advance(state);
    return { 'kind': 'ErrorType', 'message': 'Unexpected token', 'range': createRange(start.start, start.end) };
  }

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

const parseTypeReference = (state: ParserState): TypeAnnotation => {
  const start = current(state);
  let name = consume(state, TokenKind.Identifier, 'Expected type name').value;
  let moduleName: string | undefined;

  if (check(state, TokenKind.Dot)) {
    advance(state);
    moduleName = name;
    name = consume(state, TokenKind.Identifier, 'Expected type name').value;
  }

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

  return {
    'kind': 'TypeReference',
    name,
    'module': moduleName,
    typeArgs,
    'range': createRange(start.start, current(state).start),
  };
};

const parseFunctionOrParenType = (state: ParserState): TypeAnnotation => {
  const start = current(state);
  consume(state, TokenKind.LeftParen, 'Expected (');

  const params: FunctionTypeParam[] = [];
  let isVariadic = false;
  let thisType: TypeAnnotation | undefined;

  while (check(state, TokenKind.RightParen) === false && isAtEnd(state) === false) {
    const paramStart = current(state);

    if (check(state, TokenKind.Identifier) && current(state).value === 'this') {
      advance(state);
      consume(state, TokenKind.Colon, 'Expected :');
      thisType = parseTypeAnnotation(state);

      if (check(state, TokenKind.Comma)) advance(state);
      continue;
    }

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

    let paramName: string | undefined;
    let paramType: TypeAnnotation;

    if (check(state, TokenKind.Identifier) && peek(state, 1).kind === TokenKind.Colon) {
      paramName = advance(state).value;
      advance(state);
      paramType = parseTypeAnnotation(state);
    } else paramType = parseTypeAnnotation(state);

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

  if (params.length === 0)
    return {
      'kind': 'TypeReference',
      'name': 'nil',
      'module': undefined,
      'typeArgs': undefined,
      'range': createRange(start.start, current(state).start),
    };

  if (params.length === 1 && params[0]!.name === undefined)
    return {
      'kind': 'ParenthesizedType',
      'type': params[0]!.type,
      'range': createRange(start.start, current(state).start),
    };

  if (params.length > 1 && params[0] !== undefined)
    return {
      'kind': 'ParenthesizedType',
      'type': params[0].type,
      'range': createRange(start.start, current(state).start),
    };

  state.errors.push({
    'message': 'Expected -> for function type',
    'range': createRange(start.start, current(state).start),
  });
  return { 'kind': 'ErrorType', 'message': 'Malformed type', 'range': createRange(start.start, current(state).start) };
};

const parseTableType = (state: ParserState): TypeAnnotation => {
  const start = current(state);
  consume(state, TokenKind.LeftBrace, 'Expected {');

  const properties: TableTypeProperty[] = [];
  let indexer:
    | { kind: 'TableTypeIndexer'; keyType: TypeAnnotation; valueType: TypeAnnotation; range: NodeRange }
    | undefined;

  while (check(state, TokenKind.RightBrace) === false && isAtEnd(state) === false) {
    const propStart = current(state);

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
    } else if (check(state, TokenKind.Identifier) && peek(state, 1).kind === TokenKind.Colon) {
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
    } else {
      const elementType = parseTypeAnnotation(state);
      indexer = {
        'kind': 'TableTypeIndexer',
        'keyType': {
          'kind': 'TypeReference',
          'name': 'number',
          'module': undefined,
          'typeArgs': undefined,
          'range': elementType.range,
        },
        'valueType': elementType,
        'range': createRange(propStart.start, elementType.range.end),
      };
    }

    if (check(state, TokenKind.Comma) || check(state, TokenKind.Semicolon)) advance(state);
    else break;
  }

  const end = consume(state, TokenKind.RightBrace, 'Expected }');
  return {
    'kind': 'TableType',
    properties,
    indexer,
    'range': createRange(start.start, end.end),
  };
};

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
      if (checkAhead(state, 1, TokenKind.Identifier)) return parseTypeAliasStatement(state);
      return parseExpressionStatement(state);
    case TokenKind.Export:
      return parseExportStatement(state);
    default:
      return parseExpressionStatement(state);
  }
};

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
    } else types.push(undefined);
  } while (match(state, TokenKind.Comma));

  const values: Expression[] = [];
  if (match(state, TokenKind.Assign))
    do values.push(parseExpression(state));
    while (match(state, TokenKind.Comma));

  return {
    'kind': 'LocalDeclaration',
    names,
    types,
    values,
    docComment,
    'range': createRange(start.start, current(state).start),
  };
};

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

const parseForStatement = (state: ParserState): ForNumeric | ForGeneric => {
  const start = current(state);
  consume(state, TokenKind.For, 'Expected for');

  const firstVar = parseIdentifier(state);

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

  const variables: Identifier[] = [firstVar];
  while (check(state, TokenKind.Comma)) {
    advance(state);
    variables.push(parseIdentifier(state));
  }

  consume(state, TokenKind.In, 'Expected in');

  const iterators: Expression[] = [];
  do iterators.push(parseExpression(state));
  while (match(state, TokenKind.Comma));

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

const parseReturnStatement = (state: ParserState): ReturnStatement => {
  const start = current(state);
  consume(state, TokenKind.Return, 'Expected return');

  const values: Expression[] = [];

  if (isAtEnd(state) === false && RETURN_END_TOKENS.has(current(state).kind) === false)
    do values.push(parseExpression(state));
    while (match(state, TokenKind.Comma));

  return {
    'kind': 'ReturnStatement',
    values,
    'range': createRange(start.start, current(state).start),
  };
};

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

const parseExpressionStatement = (state: ParserState): Statement => {
  const start = current(state);
  const expr = parseSuffixExpression(state);

  if (check(state, TokenKind.Assign) || check(state, TokenKind.Comma)) {
    const targets: AssignmentTarget[] = [expr as AssignmentTarget];

    while (check(state, TokenKind.Comma)) {
      advance(state);
      targets.push(parseSuffixExpression(state) as AssignmentTarget);
    }

    consume(state, TokenKind.Assign, 'Expected =');

    const values: Expression[] = [];
    do values.push(parseExpression(state));
    while (match(state, TokenKind.Comma));

    return {
      'kind': 'Assignment',
      targets,
      values,
      'range': createRange(start.start, current(state).start),
    };
  }

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

  if (expr.kind === 'CallExpression' || expr.kind === 'MethodCallExpression')
    return {
      'kind': 'CallStatement',
      'expression': expr,
      'range': expr.range,
    };

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

const COMPOUND_OP_MAP: ReadonlyMap<TokenKind, CompoundOperator> = new Map([
  [TokenKind.PlusAssign, '+='],
  [TokenKind.MinusAssign, '-='],
  [TokenKind.StarAssign, '*='],
  [TokenKind.SlashAssign, '/='],
  [TokenKind.DoubleSlashAssign, '//='],
  [TokenKind.PercentAssign, '%='],
  [TokenKind.CaretAssign, '^='],
  [TokenKind.ConcatAssign, '..='],
]);

const getCompoundOperator = (token: Token): CompoundOperator | undefined => COMPOUND_OP_MAP.get(token.kind);

const parseBlock = (state: ParserState): Statement[] => {
  const statements: Statement[] = [];

  while (isAtEnd(state) === false && BLOCK_END_TOKENS.has(current(state).kind) === false) {
    while (check(state, TokenKind.Semicolon)) advance(state);

    if (isAtEnd(state) || BLOCK_END_TOKENS.has(current(state).kind)) break;

    try {
      statements.push(parseStatement(state));
    } catch {
      synchronize(state);
    }
  }

  return statements;
};

const findPrecedingDocComment = (state: ParserState, tokenOffset: number): DocComment | undefined => {
  const docCommentLines: string[] = [];

  for (let i = 0; i < state.allTokens.length; i++) {
    const token = state.allTokens[i]!;
    if (token.start.offset >= tokenOffset) break;

    if (token.kind === TokenKind.Comment && token.value.startsWith('---')) {
      const nextNonTrivia = state.allTokens.slice(i + 1).find(t => isTrivia(t.kind) === false);
      if (nextNonTrivia !== undefined && nextNonTrivia.start.offset === tokenOffset) docCommentLines.push(token.value);
      else if (docCommentLines.length > 0) {
        const lastDocLine = state.allTokens[i - 1];
        if (lastDocLine !== undefined && lastDocLine.kind === TokenKind.Comment && lastDocLine.value.startsWith('---'))
          docCommentLines.push(token.value);
      }
    } else if (token.kind !== TokenKind.Whitespace && token.kind !== TokenKind.Newline) docCommentLines.length = 0;
  }

  if (docCommentLines.length === 0) return undefined;

  const combined = docCommentLines.join('\n');
  return parseDocComment(combined);
};

const collectDocComment = (state: ParserState): DocComment | undefined => {
  const currentToken = current(state);
  return findPrecedingDocComment(state, currentToken.start.offset);
};

/** Parses Luau source code into an Abstract Syntax Tree (AST). */
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
    while (check(state, TokenKind.Semicolon)) advance(state);

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
