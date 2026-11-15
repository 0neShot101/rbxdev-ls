import { Keywords, createPosition, createToken } from '@parser/tokens';
import { TokenKind } from '@typings/parser';

import type { LexedSource, Lexer, LexerState, Token, TokenKindValue, TokenPosition } from '@typings/parser';

const NUL = 0;
const TAB = 9;
const LF = 10;
const CR = 13;
const SPACE = 32;
const DOUBLE_QUOTE = 34;
const SINGLE_QUOTE = 39;
const DASH = 45;
const ZERO = 48;
const NINE = 57;
const LEFT_BRACKET = 91;
const BACKSLASH = 92;
const BACKTICK = 96;

/** A NUL character or a read past the end of the source; both terminate string scanning. */
const isEnd = (code: number): boolean => code === NUL || Number.isNaN(code);

const isDigit = (char: string): boolean => char >= '0' && char <= '9';

const isHexDigit = (char: string): boolean =>
  isDigit(char) || (char >= 'a' && char <= 'f') || (char >= 'A' && char <= 'F');

const isBinaryDigit = (char: string): boolean => char === '0' || char === '1';

const isWhitespace = (char: string): boolean => char === ' ' || char === '\t' || char === '\r';

/** ASCII letter or underscore, by UTF-16 code unit; `NaN` past the end of the source is never a match. */
const isIdentifierStart = (code: number): boolean =>
  (code >= 97 && code <= 122) || (code >= 65 && code <= 90) || code === 95;

const isIdentifierPart = (code: number): boolean => isIdentifierStart(code) || (code >= 48 && code <= 57);

const peek = (state: LexerState, offset = 0): string => {
  const index = state.offset + offset;
  if (index >= state.source.length) return '\0';
  return state.source[index] ?? '\0';
};

const advance = (state: LexerState): void => {
  if (state.source.charCodeAt(state.offset) === LF) {
    state.line++;
    state.column = 1;
  } else state.column++;
  state.offset++;
};

const currentPosition = (state: LexerState): TokenPosition => {
  if (state.position.offset !== state.offset) state.position = createPosition(state.offset, state.line, state.column);
  return state.position;
};

/** Emits a fixed-text token that cannot contain a newline. */
const emit = (state: LexerState, kind: TokenKindValue, value: string): Token => {
  const start = currentPosition(state);
  state.offset += value.length;
  state.column += value.length;
  return createToken(kind, value, start, currentPosition(state));
};

const scanWhitespace = (state: LexerState): Token => {
  const start = currentPosition(state);
  const startOffset = state.offset;

  while (isWhitespace(peek(state))) advance(state);

  const value = state.source.slice(startOffset, state.offset);
  return createToken(TokenKind.Whitespace, value, start, currentPosition(state));
};

const scanNewline = (state: LexerState): Token => {
  const start = currentPosition(state);
  advance(state);
  return createToken(TokenKind.Newline, '\n', start, currentPosition(state));
};

const scanSingleLineComment = (state: LexerState): Token => {
  const start = currentPosition(state);
  const { source } = state;
  const startOffset = state.offset;
  let end = startOffset + 2;
  while (end < source.length && source.charCodeAt(end) !== LF && source.charCodeAt(end) !== NUL) end++;

  state.column += end - startOffset;
  state.offset = end;
  return createToken(TokenKind.Comment, source.slice(startOffset, end), start, currentPosition(state));
};

const countLongBracketLevel = (state: LexerState): number => {
  let level = 0;
  let offset = 1;

  while (peek(state, offset) === '=') {
    level++;
    offset++;
  }

  if (peek(state, offset) === '[') return level;
  return -1;
};

const scanLongBracketContent = (state: LexerState, level: number): string => {
  const startOffset = state.offset;

  advance(state);
  for (let i = 0; i < level; i++) advance(state);
  advance(state);

  while (peek(state) !== '\0') {
    if (peek(state) === ']') {
      let closingLevel = 0;
      let offset = 1;

      while (peek(state, offset) === '=') {
        closingLevel++;
        offset++;
      }

      if (closingLevel === level && peek(state, offset) === ']') {
        const content = state.source.slice(startOffset, state.offset);
        advance(state);
        for (let i = 0; i < level; i++) advance(state);
        advance(state);
        return content + state.source.slice(state.offset - level - 2, state.offset);
      }
    }
    advance(state);
  }

  return state.source.slice(startOffset, state.offset);
};

const scanMultiLineComment = (state: LexerState, level: number): Token => {
  const start = currentPosition(state);

  advance(state);
  advance(state);

  const content = scanLongBracketContent(state, level);
  const value = '--' + content;

  return createToken(TokenKind.Comment, value, start, currentPosition(state));
};

const scanComment = (state: LexerState): Token => {
  if (peek(state, 2) === '[') {
    const savedOffset = state.offset;
    const savedLine = state.line;
    const savedColumn = state.column;

    state.offset += 2;
    state.column += 2;

    const level = countLongBracketLevel(state);

    state.offset = savedOffset;
    state.line = savedLine;
    state.column = savedColumn;

    if (level >= 0) return scanMultiLineComment(state, level);
  }

  return scanSingleLineComment(state);
};

const scanNumber = (state: LexerState): Token => {
  const start = currentPosition(state);
  const startOffset = state.offset;

  if (peek(state) === '.') {
    advance(state);
    while (isDigit(peek(state)) || peek(state) === '_') advance(state);
    if (peek(state) === 'e' || peek(state) === 'E') {
      advance(state);
      if (peek(state) === '+' || peek(state) === '-') advance(state);
      while (isDigit(peek(state)) || peek(state) === '_') advance(state);
    }
    const value = state.source.slice(startOffset, state.offset);
    return createToken(TokenKind.Number, value, start, currentPosition(state));
  }

  if (peek(state) === '0') {
    const next = peek(state, 1);

    if (next === 'x' || next === 'X') {
      advance(state);
      advance(state);

      while (isHexDigit(peek(state)) || peek(state) === '_') advance(state);

      const value = state.source.slice(startOffset, state.offset);
      return createToken(TokenKind.Number, value, start, currentPosition(state));
    }

    if (next === 'b' || next === 'B') {
      advance(state);
      advance(state);

      while (isBinaryDigit(peek(state)) || peek(state) === '_') advance(state);

      const value = state.source.slice(startOffset, state.offset);
      return createToken(TokenKind.Number, value, start, currentPosition(state));
    }
  }

  while (isDigit(peek(state)) || peek(state) === '_') advance(state);

  if (peek(state) === '.' && isDigit(peek(state, 1))) {
    advance(state);

    while (isDigit(peek(state)) || peek(state) === '_') advance(state);
  }

  if (peek(state) === 'e' || peek(state) === 'E') {
    advance(state);

    if (peek(state) === '+' || peek(state) === '-') advance(state);

    while (isDigit(peek(state)) || peek(state) === '_') advance(state);
  }

  const value = state.source.slice(startOffset, state.offset);
  return createToken(TokenKind.Number, value, start, currentPosition(state));
};

const scanString = (state: LexerState, quote: number): Token => {
  const start = currentPosition(state);
  const { source } = state;
  const startOffset = state.offset;

  advance(state);

  for (
    let code = source.charCodeAt(state.offset);
    code !== quote && code !== LF && isEnd(code) === false;
    code = source.charCodeAt(state.offset)
  )
    if (code === BACKSLASH) {
      advance(state);
      if (isEnd(source.charCodeAt(state.offset)) === false) advance(state);
    } else {
      state.offset++;
      state.column++;
    }

  if (source.charCodeAt(state.offset) === quote) advance(state);

  return createToken(TokenKind.String, source.slice(startOffset, state.offset), start, currentPosition(state));
};

const scanLongString = (state: LexerState, level: number): Token => {
  const start = currentPosition(state);
  const content = scanLongBracketContent(state, level);
  return createToken(TokenKind.String, content, start, currentPosition(state));
};

const scanInterpolatedString = (state: LexerState): Token => {
  const start = currentPosition(state);
  const startOffset = state.offset;

  advance(state);

  while (peek(state) !== '\0' && peek(state) !== '`')
    if (peek(state) === '\\') {
      advance(state);
      if (peek(state) !== '\0') advance(state);
    } else if (peek(state) === '{') {
      advance(state);
      let braceDepth = 1;
      while (peek(state) !== '\0' && braceDepth > 0) {
        if (peek(state) === '{') braceDepth++;
        else if (peek(state) === '}') braceDepth--;
        if (braceDepth > 0) advance(state);
      }
      if (peek(state) === '}') advance(state);
    } else advance(state);

  if (peek(state) === '`') advance(state);

  const value = state.source.slice(startOffset, state.offset);
  return createToken(TokenKind.InterpolatedString, value, start, currentPosition(state));
};

const scanIdentifierOrKeyword = (state: LexerState): Token => {
  const start = currentPosition(state);
  const { source } = state;
  const startOffset = state.offset;
  let end = startOffset + 1;
  while (isIdentifierPart(source.charCodeAt(end))) end++;

  state.column += end - startOffset;
  state.offset = end;
  const value = source.slice(startOffset, end);
  /** Every keyword is two to eight characters long, so longer identifiers skip the lookup. */
  const keyword = value.length > 8 ? undefined : Keywords.get(value);
  return createToken(keyword ?? TokenKind.Identifier, value, start, currentPosition(state));
};

const scanPunctuation = (state: LexerState): Token => {
  const char = peek(state);
  const next = peek(state, 1);

  switch (char) {
    case '.':
      if (isDigit(next)) return scanNumber(state);
      if (next !== '.') return emit(state, TokenKind.Dot, '.');
      if (peek(state, 2) === '.') return emit(state, TokenKind.Vararg, '...');
      if (peek(state, 2) === '=') return emit(state, TokenKind.ConcatAssign, '..=');
      return emit(state, TokenKind.Concat, '..');
    case '=':
      return next === '=' ? emit(state, TokenKind.Equal, '==') : emit(state, TokenKind.Assign, '=');
    case '~':
      return next === '=' ? emit(state, TokenKind.NotEqual, '~=') : emit(state, TokenKind.Error, char);
    case '<':
      return next === '=' ? emit(state, TokenKind.LessEqual, '<=') : emit(state, TokenKind.Less, '<');
    case '>':
      return next === '=' ? emit(state, TokenKind.GreaterEqual, '>=') : emit(state, TokenKind.Greater, '>');
    case ':':
      return next === ':' ? emit(state, TokenKind.DoubleColon, '::') : emit(state, TokenKind.Colon, ':');
    case '-':
      if (next === '>') return emit(state, TokenKind.Arrow, '->');
      return next === '=' ? emit(state, TokenKind.MinusAssign, '-=') : emit(state, TokenKind.Minus, '-');
    case '/':
      if (next === '=') return emit(state, TokenKind.SlashAssign, '/=');
      if (next !== '/') return emit(state, TokenKind.Slash, '/');
      return peek(state, 2) === '='
        ? emit(state, TokenKind.DoubleSlashAssign, '//=')
        : emit(state, TokenKind.DoubleSlash, '//');
    case '+':
      return next === '=' ? emit(state, TokenKind.PlusAssign, '+=') : emit(state, TokenKind.Plus, '+');
    case '*':
      return next === '=' ? emit(state, TokenKind.StarAssign, '*=') : emit(state, TokenKind.Star, '*');
    case '%':
      return next === '=' ? emit(state, TokenKind.PercentAssign, '%=') : emit(state, TokenKind.Percent, '%');
    case '^':
      return next === '=' ? emit(state, TokenKind.CaretAssign, '^=') : emit(state, TokenKind.Caret, '^');
    case '#':
      return emit(state, TokenKind.Hash, '#');
    case '?':
      return emit(state, TokenKind.Question, '?');
    case '&':
      return emit(state, TokenKind.Ampersand, '&');
    case '|':
      return emit(state, TokenKind.Pipe, '|');
    case '(':
      return emit(state, TokenKind.LeftParen, '(');
    case ')':
      return emit(state, TokenKind.RightParen, ')');
    case '[':
      return emit(state, TokenKind.LeftBracket, '[');
    case ']':
      return emit(state, TokenKind.RightBracket, ']');
    case '{':
      return emit(state, TokenKind.LeftBrace, '{');
    case '}':
      return emit(state, TokenKind.RightBrace, '}');
    case ',':
      return emit(state, TokenKind.Comma, ',');
    case ';':
      return emit(state, TokenKind.Semicolon, ';');
    default:
      return emit(state, TokenKind.Error, char);
  }
};

const scanToken = (state: LexerState): Token => {
  const code = state.source.charCodeAt(state.offset);
  if (isIdentifierStart(code)) return scanIdentifierOrKeyword(state);
  if (code === SPACE || code === TAB || code === CR) return scanWhitespace(state);
  if (code === LF) return scanNewline(state);
  if (code === DASH && state.source.charCodeAt(state.offset + 1) === DASH) return scanComment(state);
  if (code >= ZERO && code <= NINE) return scanNumber(state);
  if (code === DOUBLE_QUOTE || code === SINGLE_QUOTE) return scanString(state, code);

  if (code === LEFT_BRACKET) {
    const level = countLongBracketLevel(state);
    if (level >= 0) return scanLongString(state, level);
  }

  if (code === BACKTICK) return scanInterpolatedString(state);
  return scanPunctuation(state);
};

const createState = (source: string): LexerState => ({
  source,
  'offset': 0,
  'line': 1,
  'column': 1,
  'position': createPosition(0, 1, 1),
});

const endOfFile = (state: LexerState): Token =>
  createToken(TokenKind.EOF, '', currentPosition(state), currentPosition(state));

/**
 * Lexes source code for the parser: whitespace and newlines advance the cursor without becoming tokens, and comments
 * are collected separately from the significant token stream, which ends with an EOF token.
 */
export const lex = (source: string): LexedSource => {
  const state = createState(source);
  const tokens: Token[] = [];
  const comments: Token[] = [];

  while (state.offset < source.length) {
    const code = source.charCodeAt(state.offset);
    if (code === SPACE || code === TAB || code === CR) {
      state.offset++;
      state.column++;
    } else if (code === LF) {
      state.offset++;
      state.line++;
      state.column = 1;
    } else {
      const token = scanToken(state);
      if (token.kind === TokenKind.Comment) comments.push(token);
      else tokens.push(token);
    }
  }

  tokens.push(endOfFile(state));
  return { tokens, comments };
};

/** Creates a new Lexer instance for tokenizing Luau source code. */
export const createLexer = (source: string): Lexer => {
  const state = createState(source);

  const tokens = (): Token[] => {
    const collected: Token[] = [];
    while (state.offset < source.length) collected.push(scanToken(state));
    collected.push(endOfFile(state));
    return collected;
  };

  return {
    source,
    tokens,
  };
};

/** Tokenizes source code directly into an array of tokens. */
export const tokenize = (source: string): Token[] => createLexer(source).tokens();

/** Tokenizes source code and filters out trivia tokens (whitespace, newlines, comments). */
export const tokenizeWithoutTrivia = (source: string): Token[] => lex(source).tokens;
