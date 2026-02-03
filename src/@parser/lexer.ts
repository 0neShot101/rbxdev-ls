/**
 * Luau Lexer - Tokenizer for Luau source code
 *
 * Converts source code strings into a sequence of tokens for parsing.
 * Handles all Luau syntax including strings, numbers, identifiers, keywords,
 * operators, comments, and interpolated strings.
 */

import { Keywords, TokenKind, createPosition, createToken, type Token, type TokenPosition } from './tokens';

/**
 * Represents the internal state of the lexer during tokenization.
 */
export interface LexerState {
  /** The complete source code being tokenized */
  readonly source: string;
  /** Current character offset in the source (0-based) */
  offset: number;
  /** Current line number (1-based) */
  line: number;
  /** Current column number (1-based) */
  column: number;
}

/**
 * The public interface for a Luau lexer instance.
 */
export interface Lexer {
  /** The source code being tokenized */
  readonly source: string;
  /** Returns all tokens as an array (including EOF) */
  readonly tokens: () => Token[];
  /** Returns a generator that yields tokens one at a time */
  readonly tokenize: () => Generator<Token>;
}

/**
 * Checks if a character is a decimal digit (0-9).
 * @param char The character to check
 * @returns True if the character is a digit, false otherwise
 */
const isDigit = (char: string): boolean => char >= '0' && char <= '9';

/**
 * Checks if a character is a hexadecimal digit (0-9, a-f, A-F).
 * @param char The character to check
 * @returns True if the character is a hex digit, false otherwise
 */
const isHexDigit = (char: string): boolean =>
  isDigit(char) || (char >= 'a' && char <= 'f') || (char >= 'A' && char <= 'F');

/**
 * Checks if a character is a binary digit (0 or 1).
 * @param char The character to check
 * @returns True if the character is a binary digit, false otherwise
 */
const isBinaryDigit = (char: string): boolean => char === '0' || char === '1';

/**
 * Checks if a character is alphabetic or an underscore (valid identifier start).
 * @param char The character to check
 * @returns True if the character can start an identifier, false otherwise
 */
const isAlpha = (char: string): boolean => (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || char === '_';

/**
 * Checks if a character is alphanumeric or an underscore (valid in identifier).
 * @param char The character to check
 * @returns True if the character can appear in an identifier, false otherwise
 */
const isAlphaNumeric = (char: string): boolean => isAlpha(char) || isDigit(char);

/**
 * Checks if a character is horizontal whitespace (space, tab, or carriage return).
 * @param char The character to check
 * @returns True if the character is whitespace, false otherwise
 */
const isWhitespace = (char: string): boolean => char === ' ' || char === '\t' || char === '\r';

/**
 * Checks if a character is a newline character.
 * @param char The character to check
 * @returns True if the character is a newline, false otherwise
 */
const isNewline = (char: string): boolean => char === '\n';

/**
 * Returns the character at the current position plus an optional offset without consuming it.
 * @param state The current lexer state
 * @param offset Optional offset from the current position (default 0)
 * @returns The character at the specified position, or '\0' if past end of source
 */
const peek = (state: LexerState, offset = 0): string => {
  const index = state.offset + offset;
  if (index >= state.source.length) return '\0';
  return state.source[index] ?? '\0';
};

/**
 * Consumes and returns the current character, advancing the lexer position.
 * Updates line and column tracking appropriately.
 * @param state The current lexer state (will be mutated)
 * @returns The character that was consumed
 */
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

/**
 * Creates a TokenPosition from the current lexer state.
 * @param state The current lexer state
 * @returns A TokenPosition representing the current position
 */
const currentPosition = (state: LexerState): TokenPosition => createPosition(state.offset, state.line, state.column);

/**
 * Scans a sequence of whitespace characters into a single Whitespace token.
 * @param state The current lexer state (will be mutated)
 * @returns A Whitespace token containing the scanned whitespace
 */
const scanWhitespace = (state: LexerState): Token => {
  const start = currentPosition(state);
  const startOffset = state.offset;

  while (isWhitespace(peek(state))) {
    advance(state);
  }

  const value = state.source.slice(startOffset, state.offset);
  return createToken(TokenKind.Whitespace, value, start, currentPosition(state));
};

/**
 * Scans a newline character into a Newline token.
 * @param state The current lexer state (will be mutated)
 * @returns A Newline token
 */
const scanNewline = (state: LexerState): Token => {
  const start = currentPosition(state);
  advance(state);
  return createToken(TokenKind.Newline, '\n', start, currentPosition(state));
};

/**
 * Scans a single-line comment (-- to end of line) into a Comment token.
 * @param state The current lexer state (will be mutated)
 * @returns A Comment token containing the comment text
 */
const scanSingleLineComment = (state: LexerState): Token => {
  const start = currentPosition(state);
  const startOffset = state.offset;

  // Skip --
  advance(state);
  advance(state);

  while (peek(state) !== '\0' && isNewline(peek(state)) === false) {
    advance(state);
  }

  const value = state.source.slice(startOffset, state.offset);
  return createToken(TokenKind.Comment, value, start, currentPosition(state));
};

/**
 * Counts the level of a long bracket string (number of = characters between brackets).
 * Used for both long strings and multi-line comments.
 * @param state The current lexer state
 * @returns The bracket level (0 for [[, 1 for [=[, etc.), or -1 if not a valid long bracket
 */
const countLongBracketLevel = (state: LexerState): number => {
  let level = 0;
  let offset = 1; // Start after the first [

  while (peek(state, offset) === '=') {
    level++;
    offset++;
  }

  if (peek(state, offset) === '[') return level;
  return -1; // Not a valid long bracket
};

/**
 * Scans the content of a long bracket string or comment.
 * Consumes from the opening bracket to the matching closing bracket.
 * @param state The current lexer state (will be mutated)
 * @param level The bracket level (number of = characters)
 * @returns The complete long bracket content including delimiters
 */
const scanLongBracketContent = (state: LexerState, level: number): string => {
  const startOffset = state.offset;

  // Skip opening [=*[
  advance(state); // [
  for (let i = 0; i < level; i++) advance(state); // =*
  advance(state); // [

  // Scan until closing ]=*]
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
        // Skip closing ]=*]
        advance(state); // ]
        for (let i = 0; i < level; i++) advance(state); // =*
        advance(state); // ]
        return content + state.source.slice(state.offset - level - 2, state.offset);
      }
    }
    advance(state);
  }

  return state.source.slice(startOffset, state.offset);
};

/**
 * Scans a multi-line comment (--[[...]] or --[=[...]=] etc.) into a Comment token.
 * @param state The current lexer state (will be mutated)
 * @param level The bracket level of the comment
 * @returns A Comment token containing the complete comment text
 */
const scanMultiLineComment = (state: LexerState, level: number): Token => {
  const start = currentPosition(state);

  // Skip --
  advance(state);
  advance(state);

  const content = scanLongBracketContent(state, level);
  const value = '--' + content;

  return createToken(TokenKind.Comment, value, start, currentPosition(state));
};

/**
 * Scans a comment (either single-line or multi-line) into a Comment token.
 * Determines the comment type and delegates to the appropriate scanner.
 * @param state The current lexer state (will be mutated)
 * @returns A Comment token
 */
const scanComment = (state: LexerState): Token => {
  // Check if it's a long bracket comment --[=*[
  if (peek(state, 2) === '[') {
    // Save current state to check bracket level
    const savedOffset = state.offset;
    const savedLine = state.line;
    const savedColumn = state.column;

    // Skip --
    state.offset += 2;
    state.column += 2;

    const level = countLongBracketLevel(state);

    // Restore state
    state.offset = savedOffset;
    state.line = savedLine;
    state.column = savedColumn;

    if (level >= 0) return scanMultiLineComment(state, level);
  }

  return scanSingleLineComment(state);
};

/**
 * Scans a numeric literal into a Number token.
 * Handles decimal, hexadecimal (0x), binary (0b), floating point, and exponential notation.
 * Also supports underscore separators in numbers.
 * @param state The current lexer state (will be mutated)
 * @returns A Number token containing the numeric literal
 */
const scanNumber = (state: LexerState): Token => {
  const start = currentPosition(state);
  const startOffset = state.offset;

  // Check for number starting with dot (.5, .123, etc.)
  if (peek(state) === '.') {
    advance(state); // .
    while (isDigit(peek(state)) || peek(state) === '_') {
      advance(state);
    }
    // Exponent part
    if (peek(state) === 'e' || peek(state) === 'E') {
      advance(state); // e
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

  // Check for hex or binary
  if (peek(state) === '0') {
    const next = peek(state, 1);

    if (next === 'x' || next === 'X') {
      advance(state); // 0
      advance(state); // x

      while (isHexDigit(peek(state)) || peek(state) === '_') {
        advance(state);
      }

      const value = state.source.slice(startOffset, state.offset);
      return createToken(TokenKind.Number, value, start, currentPosition(state));
    }

    if (next === 'b' || next === 'B') {
      advance(state); // 0
      advance(state); // b

      while (isBinaryDigit(peek(state)) || peek(state) === '_') {
        advance(state);
      }

      const value = state.source.slice(startOffset, state.offset);
      return createToken(TokenKind.Number, value, start, currentPosition(state));
    }
  }

  // Decimal number
  while (isDigit(peek(state)) || peek(state) === '_') {
    advance(state);
  }

  // Decimal part
  if (peek(state) === '.' && isDigit(peek(state, 1))) {
    advance(state); // .

    while (isDigit(peek(state)) || peek(state) === '_') {
      advance(state);
    }
  }

  // Exponent part
  if (peek(state) === 'e' || peek(state) === 'E') {
    advance(state); // e

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

/**
 * Scans a quoted string literal (single or double quotes) into a String token.
 * Handles escape sequences within the string.
 * @param state The current lexer state (will be mutated)
 * @param quote The quote character (' or ")
 * @returns A String token containing the string literal
 */
const scanString = (state: LexerState, quote: string): Token => {
  const start = currentPosition(state);
  const startOffset = state.offset;

  advance(state); // Opening quote

  while (peek(state) !== '\0' && peek(state) !== quote && isNewline(peek(state)) === false) {
    if (peek(state) === '\\') {
      advance(state); // Backslash
      if (peek(state) !== '\0') advance(state); // Escaped character
    } else {
      advance(state);
    }
  }

  if (peek(state) === quote) {
    advance(state); // Closing quote
  }

  const value = state.source.slice(startOffset, state.offset);
  return createToken(TokenKind.String, value, start, currentPosition(state));
};

/**
 * Scans a long bracket string ([[...]] or [=[...]=] etc.) into a String token.
 * @param state The current lexer state (will be mutated)
 * @param level The bracket level of the string
 * @returns A String token containing the long string
 */
const scanLongString = (state: LexerState, level: number): Token => {
  const start = currentPosition(state);
  const content = scanLongBracketContent(state, level);
  return createToken(TokenKind.String, content, start, currentPosition(state));
};

/**
 * Scans an interpolated string (backtick string with {expr} interpolations) into an InterpolatedString token.
 * @param state The current lexer state (will be mutated)
 * @returns An InterpolatedString token containing the complete string
 */
const scanInterpolatedString = (state: LexerState): Token => {
  const start = currentPosition(state);
  const startOffset = state.offset;

  advance(state); // Opening backtick

  while (peek(state) !== '\0' && peek(state) !== '`') {
    if (peek(state) === '\\') {
      advance(state); // Backslash
      if (peek(state) !== '\0') advance(state); // Escaped character
    } else if (peek(state) === '{') {
      // Handle interpolation - for now just include as part of the string
      // The parser will handle the interpolation expressions
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
    advance(state); // Closing backtick
  }

  const value = state.source.slice(startOffset, state.offset);
  return createToken(TokenKind.InterpolatedString, value, start, currentPosition(state));
};

/**
 * Scans an identifier or keyword into the appropriate token type.
 * Checks if the identifier matches a reserved keyword.
 * @param state The current lexer state (will be mutated)
 * @returns An Identifier token or the appropriate keyword token
 */
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

/**
 * Scans punctuation and operator characters into the appropriate token.
 * Handles both single and multi-character operators.
 * @param state The current lexer state (will be mutated)
 * @returns A token representing the operator or delimiter
 */
const scanPunctuation = (state: LexerState): Token => {
  const start = currentPosition(state);
  const char = peek(state);

  // Check for dot followed by digit (number literal like .5)
  if (char === '.' && isDigit(peek(state, 1))) {
    return scanNumber(state);
  }

  // Two-character operators first
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

  // Single-character operators
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

/**
 * Scans the next token from the source, dispatching to the appropriate scanner based on the current character.
 * @param state The current lexer state (will be mutated)
 * @returns The next token from the source
 */
const scanToken = (state: LexerState): Token => {
  const char = peek(state);

  // Whitespace
  if (isWhitespace(char)) return scanWhitespace(state);

  // Newline
  if (isNewline(char)) return scanNewline(state);

  // Comments
  if (char === '-' && peek(state, 1) === '-') return scanComment(state);

  // Numbers
  if (isDigit(char)) return scanNumber(state);

  // Strings
  if (char === '"' || char === "'") return scanString(state, char);

  // Long strings [=*[
  if (char === '[') {
    const level = countLongBracketLevel(state);
    if (level >= 0) return scanLongString(state, level);
  }

  // Interpolated strings
  if (char === '`') return scanInterpolatedString(state);

  // Identifiers and keywords
  if (isAlpha(char)) return scanIdentifierOrKeyword(state);

  // Punctuation and operators
  return scanPunctuation(state);
};

/**
 * Creates a new Lexer instance for tokenizing Luau source code.
 * @param source The source code string to tokenize
 * @returns A Lexer object with methods for tokenization
 */
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

/**
 * Convenience function to tokenize source code directly into an array of tokens.
 * @param source The source code string to tokenize
 * @returns An array of all tokens including trivia and EOF
 */
export const tokenize = (source: string): Token[] => createLexer(source).tokens();

/**
 * Tokenizes source code and filters out trivia tokens (whitespace, newlines, comments).
 * Useful for parsing where trivia is not needed.
 * @param source The source code string to tokenize
 * @returns An array of non-trivia tokens including EOF
 */
export const tokenizeWithoutTrivia = (source: string): Token[] => {
  const allTokens = tokenize(source);
  return allTokens.filter(
    token =>
      token.kind !== TokenKind.Whitespace && token.kind !== TokenKind.Newline && token.kind !== TokenKind.Comment,
  );
};
