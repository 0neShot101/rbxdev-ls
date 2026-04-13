import { TokenKind, type Token, type TokenPosition } from '@typings/parser';

/** Maps Luau keyword strings to their corresponding TokenKind values. */
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

/** Creates a new Token object with the specified properties. */
export const createToken = (kind: TokenKind, value: string, start: TokenPosition, end: TokenPosition): Token => ({
  kind,
  value,
  start,
  end,
});

/** Creates a new TokenPosition object with the specified coordinates. */
export const createPosition = (offset: number, line: number, column: number): TokenPosition => ({
  offset,
  line,
  column,
});

const KEYWORD_KINDS: ReadonlySet<TokenKind> = new Set([
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

const LITERAL_KINDS: ReadonlySet<TokenKind> = new Set([
  TokenKind.Number,
  TokenKind.String,
  TokenKind.InterpolatedString,
  TokenKind.True,
  TokenKind.False,
  TokenKind.Nil,
]);

const OPERATOR_KINDS: ReadonlySet<TokenKind> = new Set([
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

const TRIVIA_KINDS: ReadonlySet<TokenKind> = new Set([TokenKind.Comment, TokenKind.Whitespace, TokenKind.Newline]);

/** Determines whether a token kind represents a Luau keyword. */
export const isKeyword = (kind: TokenKind): boolean => KEYWORD_KINDS.has(kind);

/** Determines whether a token kind represents a literal value. */
export const isLiteral = (kind: TokenKind): boolean => LITERAL_KINDS.has(kind);

/** Determines whether a token kind represents an operator. */
export const isOperator = (kind: TokenKind): boolean => OPERATOR_KINDS.has(kind);

/** Determines whether a token kind represents trivia (whitespace, newlines, or comments). */
export const isTrivia = (kind: TokenKind): boolean => TRIVIA_KINDS.has(kind);
