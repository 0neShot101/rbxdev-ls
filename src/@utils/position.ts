/**
 * Position and Range utilities for source locations
 */

export interface Position {
  readonly line: number;
  readonly character: number;
}

export interface Range {
  readonly start: Position;
  readonly end: Position;
}

export interface Location {
  readonly uri: string;
  readonly range: Range;
}

/**
 * Creates a Position object representing a location in a document
 * @param line - The zero-based line number
 * @param character - The zero-based character offset within the line
 * @returns A Position object with the specified line and character
 */
export const createPosition = (line: number, character: number): Position => ({
  line,
  character,
});

/**
 * Creates a Range object representing a span between two positions
 * @param start - The starting position of the range
 * @param end - The ending position of the range
 * @returns A Range object with the specified start and end positions
 */
export const createRange = (start: Position, end: Position): Range => ({
  start,
  end,
});

/**
 * Creates a Location object representing a range within a specific document
 * @param uri - The URI of the document
 * @param range - The range within the document
 * @returns A Location object with the specified URI and range
 */
export const createLocation = (uri: string, range: Range): Location => ({
  uri,
  range,
});

/**
 * Checks if position a comes before position b in document order
 * @param a - The first position to compare
 * @param b - The second position to compare
 * @returns True if position a is before position b, false otherwise
 */
export const positionBefore = (a: Position, b: Position): boolean => {
  if (a.line < b.line) return true;
  if (a.line > b.line) return false;
  return a.character < b.character;
};

/**
 * Checks if position a comes after position b in document order
 * @param a - The first position to compare
 * @param b - The second position to compare
 * @returns True if position a is after position b, false otherwise
 */
export const positionAfter = (a: Position, b: Position): boolean => positionBefore(b, a);

/**
 * Checks if two positions are equal (same line and character)
 * @param a - The first position to compare
 * @param b - The second position to compare
 * @returns True if both positions have the same line and character, false otherwise
 */
export const positionEqual = (a: Position, b: Position): boolean => a.line === b.line && a.character === b.character;

/**
 * Checks if a position falls within a range (inclusive)
 * @param pos - The position to check
 * @param range - The range to check against
 * @returns True if the position is within the range, false otherwise
 */
export const positionInRange = (pos: Position, range: Range): boolean => {
  if (positionBefore(pos, range.start)) return false;
  if (positionAfter(pos, range.end)) return false;
  return true;
};

/**
 * Checks if two ranges overlap (share any common positions)
 * @param a - The first range to check
 * @param b - The second range to check
 * @returns True if the ranges overlap, false otherwise
 */
export const rangesOverlap = (a: Range, b: Range): boolean => {
  if (positionAfter(a.start, b.end)) return false;
  if (positionBefore(a.end, b.start)) return false;
  return true;
};

/**
 * Checks if one range completely contains another range
 * @param outer - The potentially containing range
 * @param inner - The potentially contained range
 * @returns True if the outer range fully contains the inner range, false otherwise
 */
export const rangeContains = (outer: Range, inner: Range): boolean =>
  positionInRange(inner.start, outer) && positionInRange(inner.end, outer);

/**
 * Converts a character offset in a string to a Position (line and character)
 * @param text - The text content to calculate position within
 * @param offset - The zero-based character offset from the start of the text
 * @returns A Position representing the line and character at the given offset
 */
export const offsetToPosition = (text: string, offset: number): Position => {
  let line = 0;
  let character = 0;

  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === '\n') {
      line++;
      character = 0;
    } else {
      character++;
    }
  }

  return { line, character };
};

/**
 * Converts a Position (line and character) to a character offset in a string
 * @param text - The text content to calculate offset within
 * @param position - The position to convert to an offset
 * @returns The zero-based character offset corresponding to the position
 */
export const positionToOffset = (text: string, position: Position): number => {
  let offset = 0;
  let line = 0;
  let character = 0;

  while (offset < text.length) {
    if (line === position.line && character === position.character) return offset;

    if (text[offset] === '\n') {
      line++;
      character = 0;
    } else {
      character++;
    }
    offset++;
  }

  return offset;
};
