/**
 * Luau Token Definitions
 *
 * Defines all token types produced by the lexer, along with helper functions
 * for token creation and classification.
 */

/**
 * Enumeration of all token kinds recognized by the Luau lexer.
 * Includes literals, identifiers, keywords, operators, delimiters, and special tokens.
 */
export const TokenKind = {
  // Literals
  'Number': 'Number',
  'String': 'String',
  'InterpolatedString': 'InterpolatedString',
  'True': 'True',
  'False': 'False',
  'Nil': 'Nil',

  // Identifier
  'Identifier': 'Identifier',

  // Keywords
  'And': 'And',
  'Break': 'Break',
  'Continue': 'Continue',
  'Do': 'Do',
  'Else': 'Else',
  'Elseif': 'Elseif',
  'End': 'End',
  'Export': 'Export',
  'For': 'For',
  'Function': 'Function',
  'If': 'If',
  'In': 'In',
  'Local': 'Local',
  'Not': 'Not',
  'Or': 'Or',
  'Repeat': 'Repeat',
  'Return': 'Return',
  'Then': 'Then',
  'Type': 'Type',
  'Typeof': 'Typeof',
  'Until': 'Until',
  'While': 'While',

  // Operators - Arithmetic
  'Plus': 'Plus',
  'Minus': 'Minus',
  'Star': 'Star',
  'Slash': 'Slash',
  'DoubleSlash': 'DoubleSlash',
  'Percent': 'Percent',
  'Caret': 'Caret',
  'Hash': 'Hash',

  // Operators - Comparison
  'Equal': 'Equal',
  'NotEqual': 'NotEqual',
  'Less': 'Less',
  'LessEqual': 'LessEqual',
  'Greater': 'Greater',
  'GreaterEqual': 'GreaterEqual',

  // Operators - Assignment
  'Assign': 'Assign',
  'PlusAssign': 'PlusAssign',
  'MinusAssign': 'MinusAssign',
  'StarAssign': 'StarAssign',
  'SlashAssign': 'SlashAssign',
  'DoubleSlashAssign': 'DoubleSlashAssign',
  'PercentAssign': 'PercentAssign',
  'CaretAssign': 'CaretAssign',
  'ConcatAssign': 'ConcatAssign',

  // Operators - Other
  'Concat': 'Concat',
  'Vararg': 'Vararg',
  'Colon': 'Colon',
  'DoubleColon': 'DoubleColon',
  'Arrow': 'Arrow',
  'Question': 'Question',
  'Dot': 'Dot',
  'Ampersand': 'Ampersand',
  'Pipe': 'Pipe',

  // Delimiters
  'LeftParen': 'LeftParen',
  'RightParen': 'RightParen',
  'LeftBracket': 'LeftBracket',
  'RightBracket': 'RightBracket',
  'LeftBrace': 'LeftBrace',
  'RightBrace': 'RightBrace',
  'Comma': 'Comma',
  'Semicolon': 'Semicolon',

  // Special
  'Comment': 'Comment',
  'Whitespace': 'Whitespace',
  'Newline': 'Newline',
  'EOF': 'EOF',
  'Error': 'Error',
} as const;

/** Type representing any valid token kind value */
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type TokenKind = (typeof TokenKind)[keyof typeof TokenKind];

/**
 * Represents a position in the source code.
 */
export interface TokenPosition {
  /** The character offset from the beginning of the source (0-based) */
  readonly offset: number;
  /** The line number in the source (1-based) */
  readonly line: number;
  /** The column number in the source (1-based) */
  readonly column: number;
}

/**
 * Represents a lexical token produced by the lexer.
 */
export interface Token {
  /** The kind/type of this token */
  readonly kind: TokenKind;
  /** The raw string value of this token from the source */
  readonly value: string;
  /** The position where this token starts in the source */
  readonly start: TokenPosition;
  /** The position where this token ends in the source */
  readonly end: TokenPosition;
}

/**
 * Map of Luau keyword strings to their corresponding TokenKind values.
 * Used by the lexer to identify keywords during tokenization.
 */
export const Keywords: ReadonlyMap<string, TokenKind> = new Map([
  ['and', TokenKind.And],
  ['break', TokenKind.Break],
  ['continue', TokenKind.Continue],
  ['do', TokenKind.Do],
  ['else', TokenKind.Else],
  ['elseif', TokenKind.Elseif],
  ['end', TokenKind.End],
  ['export', TokenKind.Export],
  ['false', TokenKind.False],
  ['for', TokenKind.For],
  ['function', TokenKind.Function],
  ['if', TokenKind.If],
  ['in', TokenKind.In],
  ['local', TokenKind.Local],
  ['nil', TokenKind.Nil],
  ['not', TokenKind.Not],
  ['or', TokenKind.Or],
  ['repeat', TokenKind.Repeat],
  ['return', TokenKind.Return],
  ['then', TokenKind.Then],
  ['true', TokenKind.True],
  ['type', TokenKind.Type],
  ['typeof', TokenKind.Typeof],
  ['until', TokenKind.Until],
  ['while', TokenKind.While],
]);

/**
 * Creates a new Token object with the specified properties.
 * @param kind The token kind/type
 * @param value The raw string value of the token
 * @param start The starting position of the token in the source
 * @param end The ending position of the token in the source
 * @returns A new Token object
 */
export const createToken = (kind: TokenKind, value: string, start: TokenPosition, end: TokenPosition): Token => ({
  kind,
  value,
  start,
  end,
});

/**
 * Creates a new TokenPosition object with the specified coordinates.
 * @param offset The character offset from the beginning of the source (0-based)
 * @param line The line number in the source (1-based)
 * @param column The column number in the source (1-based)
 * @returns A new TokenPosition object
 */
export const createPosition = (offset: number, line: number, column: number): TokenPosition => ({
  offset,
  line,
  column,
});

/**
 * Determines whether a token kind represents a Luau keyword.
 * @param kind The token kind to check
 * @returns True if the token kind is a keyword, false otherwise
 */
export const isKeyword = (kind: TokenKind): boolean => {
  const keywordKinds: ReadonlySet<TokenKind> = new Set([
    TokenKind.And,
    TokenKind.Break,
    TokenKind.Continue,
    TokenKind.Do,
    TokenKind.Else,
    TokenKind.Elseif,
    TokenKind.End,
    TokenKind.Export,
    TokenKind.For,
    TokenKind.Function,
    TokenKind.If,
    TokenKind.In,
    TokenKind.Local,
    TokenKind.Not,
    TokenKind.Or,
    TokenKind.Repeat,
    TokenKind.Return,
    TokenKind.Then,
    TokenKind.Type,
    TokenKind.Typeof,
    TokenKind.Until,
    TokenKind.While,
  ]);
  return keywordKinds.has(kind);
};

/**
 * Determines whether a token kind represents a literal value (number, string, boolean, or nil).
 * @param kind The token kind to check
 * @returns True if the token kind is a literal, false otherwise
 */
export const isLiteral = (kind: TokenKind): boolean => {
  const literalKinds: ReadonlySet<TokenKind> = new Set([
    TokenKind.Number,
    TokenKind.String,
    TokenKind.InterpolatedString,
    TokenKind.True,
    TokenKind.False,
    TokenKind.Nil,
  ]);
  return literalKinds.has(kind);
};

/**
 * Determines whether a token kind represents an operator (arithmetic, comparison, logical, or assignment).
 * @param kind The token kind to check
 * @returns True if the token kind is an operator, false otherwise
 */
export const isOperator = (kind: TokenKind): boolean => {
  const operatorKinds: ReadonlySet<TokenKind> = new Set([
    TokenKind.Plus,
    TokenKind.Minus,
    TokenKind.Star,
    TokenKind.Slash,
    TokenKind.DoubleSlash,
    TokenKind.Percent,
    TokenKind.Caret,
    TokenKind.Hash,
    TokenKind.Equal,
    TokenKind.NotEqual,
    TokenKind.Less,
    TokenKind.LessEqual,
    TokenKind.Greater,
    TokenKind.GreaterEqual,
    TokenKind.Assign,
    TokenKind.PlusAssign,
    TokenKind.MinusAssign,
    TokenKind.StarAssign,
    TokenKind.SlashAssign,
    TokenKind.DoubleSlashAssign,
    TokenKind.PercentAssign,
    TokenKind.CaretAssign,
    TokenKind.ConcatAssign,
    TokenKind.Concat,
    TokenKind.And,
    TokenKind.Or,
    TokenKind.Not,
  ]);
  return operatorKinds.has(kind);
};

/**
 * Determines whether a token kind represents trivia (whitespace, newlines, or comments).
 * Trivia tokens are typically filtered out before parsing.
 * @param kind The token kind to check
 * @returns True if the token kind is trivia, false otherwise
 */
export const isTrivia = (kind: TokenKind): boolean => {
  const triviaKinds: ReadonlySet<TokenKind> = new Set([TokenKind.Comment, TokenKind.Whitespace, TokenKind.Newline]);
  return triviaKinds.has(kind);
};
