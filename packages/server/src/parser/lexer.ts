import { TokenKind, type Lexer, type LexerState, type Token, type TokenPosition } from '@typings/parser';
import { Keywords, createPosition, createToken } from '@parser/tokens';

const isDigit = (char: string): boolean => char >= '0' && char <= '9';

const isHexDigit = (char: string): boolean =>
  isDigit(char) || (char >= 'a' && char <= 'f') || (char >= 'A' && char <= 'F');

const isBinaryDigit = (char: string): boolean => char === '0' || char === '1';

const isAlpha = (char: string): boolean => (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || char === '_';

const isAlphaNumeric = (char: string): boolean => isAlpha(char) || isDigit(char);

const isWhitespace = (char: string): boolean => char === ' ' || char === '\t' || char === '\r';

const isNewline = (char: string): boolean => char === '\n';

const peek = (state: LexerState, offset = 0): string => {
  const index = state.offset + offset;
  if (index >= state.source.length) return '\0';
  return state.source[index] ?? '\0';
};

const advance = (state: LexerState): string => {
  const char = peek(state);
  state.offset++;
  if (isNewline(char)) {
    state.line++;
    state.column = 1;
  } else {
    state.column++;
  }
  return char;
};

const currentPosition = (state: LexerState): TokenPosition => createPosition(state.offset, state.line, state.column);

const scanWhitespace = (state: LexerState): Token => {
  const start = currentPosition(state);
  const startOffset = state.offset;

  while (isWhitespace(peek(state))) {
    advance(state);
  }

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
  const startOffset = state.offset;

  advance(state);
  advance(state);

  while (peek(state) !== '\0' && isNewline(peek(state)) === false) {
    advance(state);
  }

  const value = state.source.slice(startOffset, state.offset);
  return createToken(TokenKind.Comment, value, start, currentPosition(state));
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
    while (isDigit(peek(state)) || peek(state) === '_') {
      advance(state);
    }
    if (peek(state) === 'e' || peek(state) === 'E') {
      advance(state);
      if (peek(state) === '+' || peek(state) === '-') {
        advance(state);
      }
      while (isDigit(peek(state)) || peek(state) === '_') {
        advance(state);
      }
    }
    const value = state.source.slice(startOffset, state.offset);
    return createToken(TokenKind.Number, value, start, currentPosition(state));
  }

  if (peek(state) === '0') {
    const next = peek(state, 1);

    if (next === 'x' || next === 'X') {
      advance(state);
      advance(state);

      while (isHexDigit(peek(state)) || peek(state) === '_') {
        advance(state);
      }

      const value = state.source.slice(startOffset, state.offset);
      return createToken(TokenKind.Number, value, start, currentPosition(state));
    }

    if (next === 'b' || next === 'B') {
      advance(state);
      advance(state);

      while (isBinaryDigit(peek(state)) || peek(state) === '_') {
        advance(state);
      }

      const value = state.source.slice(startOffset, state.offset);
      return createToken(TokenKind.Number, value, start, currentPosition(state));
    }
  }

  while (isDigit(peek(state)) || peek(state) === '_') {
    advance(state);
  }

  if (peek(state) === '.' && isDigit(peek(state, 1))) {
    advance(state);

    while (isDigit(peek(state)) || peek(state) === '_') {
      advance(state);
    }
  }

  if (peek(state) === 'e' || peek(state) === 'E') {
    advance(state);

    if (peek(state) === '+' || peek(state) === '-') {
      advance(state);
    }

    while (isDigit(peek(state)) || peek(state) === '_') {
      advance(state);
    }
  }

  const value = state.source.slice(startOffset, state.offset);
  return createToken(TokenKind.Number, value, start, currentPosition(state));
};

const scanString = (state: LexerState, quote: string): Token => {
  const start = currentPosition(state);
  const startOffset = state.offset;

  advance(state);

  while (peek(state) !== '\0' && peek(state) !== quote && isNewline(peek(state)) === false) {
    if (peek(state) === '\\') {
      advance(state);
      if (peek(state) !== '\0') advance(state);
    } else {
      advance(state);
    }
  }

  if (peek(state) === quote) {
    advance(state);
  }

  const value = state.source.slice(startOffset, state.offset);
  return createToken(TokenKind.String, value, start, currentPosition(state));
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

  while (peek(state) !== '\0' && peek(state) !== '`') {
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
    } else {
      advance(state);
    }
  }

  if (peek(state) === '`') {
    advance(state);
  }

  const value = state.source.slice(startOffset, state.offset);
  return createToken(TokenKind.InterpolatedString, value, start, currentPosition(state));
};

const scanIdentifierOrKeyword = (state: LexerState): Token => {
  const start = currentPosition(state);
  const startOffset = state.offset;

  while (isAlphaNumeric(peek(state))) {
    advance(state);
  }

  const value = state.source.slice(startOffset, state.offset);
  const keyword = Keywords.get(value);

  if (keyword !== undefined) {
    return createToken(keyword, value, start, currentPosition(state));
  }

  return createToken(TokenKind.Identifier, value, start, currentPosition(state));
};

const scanPunctuation = (state: LexerState): Token => {
  const start = currentPosition(state);
  const char = peek(state);

  if (char === '.' && isDigit(peek(state, 1))) {
    return scanNumber(state);
  }

  const twoChar = char + peek(state, 1);

  switch (twoChar) {
    case '==':
      advance(state);
      advance(state);
      return createToken(TokenKind.Equal, '==', start, currentPosition(state));
    case '~=':
      advance(state);
      advance(state);
      return createToken(TokenKind.NotEqual, '~=', start, currentPosition(state));
    case '<=':
      advance(state);
      advance(state);
      return createToken(TokenKind.LessEqual, '<=', start, currentPosition(state));
    case '>=':
      advance(state);
      advance(state);
      return createToken(TokenKind.GreaterEqual, '>=', start, currentPosition(state));
    case '::':
      advance(state);
      advance(state);
      return createToken(TokenKind.DoubleColon, '::', start, currentPosition(state));
    case '->':
      advance(state);
      advance(state);
      return createToken(TokenKind.Arrow, '->', start, currentPosition(state));
    case '//':
      if (peek(state, 2) === '=') {
        advance(state);
        advance(state);
        advance(state);
        return createToken(TokenKind.DoubleSlashAssign, '//=', start, currentPosition(state));
      }
      advance(state);
      advance(state);
      return createToken(TokenKind.DoubleSlash, '//', start, currentPosition(state));
    case '..':
      if (peek(state, 2) === '.') {
        advance(state);
        advance(state);
        advance(state);
        return createToken(TokenKind.Vararg, '...', start, currentPosition(state));
      }
      if (peek(state, 2) === '=') {
        advance(state);
        advance(state);
        advance(state);
        return createToken(TokenKind.ConcatAssign, '..=', start, currentPosition(state));
      }
      advance(state);
      advance(state);
      return createToken(TokenKind.Concat, '..', start, currentPosition(state));
    case '+=':
      advance(state);
      advance(state);
      return createToken(TokenKind.PlusAssign, '+=', start, currentPosition(state));
    case '-=':
      advance(state);
      advance(state);
      return createToken(TokenKind.MinusAssign, '-=', start, currentPosition(state));
    case '*=':
      advance(state);
      advance(state);
      return createToken(TokenKind.StarAssign, '*=', start, currentPosition(state));
    case '/=':
      advance(state);
      advance(state);
      return createToken(TokenKind.SlashAssign, '/=', start, currentPosition(state));
    case '%=':
      advance(state);
      advance(state);
      return createToken(TokenKind.PercentAssign, '%=', start, currentPosition(state));
    case '^=':
      advance(state);
      advance(state);
      return createToken(TokenKind.CaretAssign, '^=', start, currentPosition(state));
  }

  advance(state);

  switch (char) {
    case '+':
      return createToken(TokenKind.Plus, '+', start, currentPosition(state));
    case '-':
      return createToken(TokenKind.Minus, '-', start, currentPosition(state));
    case '*':
      return createToken(TokenKind.Star, '*', start, currentPosition(state));
    case '/':
      return createToken(TokenKind.Slash, '/', start, currentPosition(state));
    case '%':
      return createToken(TokenKind.Percent, '%', start, currentPosition(state));
    case '^':
      return createToken(TokenKind.Caret, '^', start, currentPosition(state));
    case '#':
      return createToken(TokenKind.Hash, '#', start, currentPosition(state));
    case '<':
      return createToken(TokenKind.Less, '<', start, currentPosition(state));
    case '>':
      return createToken(TokenKind.Greater, '>', start, currentPosition(state));
    case '=':
      return createToken(TokenKind.Assign, '=', start, currentPosition(state));
    case ':':
      return createToken(TokenKind.Colon, ':', start, currentPosition(state));
    case '.':
      return createToken(TokenKind.Dot, '.', start, currentPosition(state));
    case '?':
      return createToken(TokenKind.Question, '?', start, currentPosition(state));
    case '&':
      return createToken(TokenKind.Ampersand, '&', start, currentPosition(state));
    case '|':
      return createToken(TokenKind.Pipe, '|', start, currentPosition(state));
    case '(':
      return createToken(TokenKind.LeftParen, '(', start, currentPosition(state));
    case ')':
      return createToken(TokenKind.RightParen, ')', start, currentPosition(state));
    case '[':
      return createToken(TokenKind.LeftBracket, '[', start, currentPosition(state));
    case ']':
      return createToken(TokenKind.RightBracket, ']', start, currentPosition(state));
    case '{':
      return createToken(TokenKind.LeftBrace, '{', start, currentPosition(state));
    case '}':
      return createToken(TokenKind.RightBrace, '}', start, currentPosition(state));
    case ',':
      return createToken(TokenKind.Comma, ',', start, currentPosition(state));
    case ';':
      return createToken(TokenKind.Semicolon, ';', start, currentPosition(state));
    default:
      return createToken(TokenKind.Error, char, start, currentPosition(state));
  }
};

const scanToken = (state: LexerState): Token => {
  const char = peek(state);

  if (isWhitespace(char)) return scanWhitespace(state);
  if (isNewline(char)) return scanNewline(state);
  if (char === '-' && peek(state, 1) === '-') return scanComment(state);
  if (isDigit(char)) return scanNumber(state);
  if (char === '"' || char === "'") return scanString(state, char);

  if (char === '[') {
    const level = countLongBracketLevel(state);
    if (level >= 0) return scanLongString(state, level);
  }

  if (char === '`') return scanInterpolatedString(state);
  if (isAlpha(char)) return scanIdentifierOrKeyword(state);

  return scanPunctuation(state);
};

/** Creates a new Lexer instance for tokenizing Luau source code. */
export const createLexer = (source: string): Lexer => {
  const state: LexerState = {
    source,
    'offset': 0,
    'line': 1,
    'column': 1,
  };

  const tokenize = function* (): Generator<Token> {
    while (state.offset < source.length) {
      yield scanToken(state);
    }

    yield createToken(TokenKind.EOF, '', currentPosition(state), currentPosition(state));
  };

  const tokens = (): Token[] => [...tokenize()];

  return {
    source,
    tokens,
    tokenize,
  };
};

/** Tokenizes source code directly into an array of tokens. */
export const tokenize = (source: string): Token[] => createLexer(source).tokens();

/** Tokenizes source code and filters out trivia tokens (whitespace, newlines, comments). */
export const tokenizeWithoutTrivia = (source: string): Token[] => {
  const allTokens = tokenize(source);
  return allTokens.filter(
    token =>
      token.kind !== TokenKind.Whitespace && token.kind !== TokenKind.Newline && token.kind !== TokenKind.Comment,
  );
};
