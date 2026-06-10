import type { Location, Position, Range } from '@typings/workspace';

/** Creates a Position object representing a location in a document. */
export const createPosition = (line: number, character: number): Position => ({
  line,
  character,
});

/** Creates a Range object representing a span between two positions. */
export const createRange = (start: Position, end: Position): Range => ({
  start,
  end,
});

/** Creates a Location object representing a range within a specific document. */
export const createLocation = (uri: string, range: Range): Location => ({
  uri,
  range,
});

/** Checks if position a comes before position b in document order. */
export const positionBefore = (a: Position, b: Position): boolean => {
  if (a.line < b.line) return true;
  if (a.line > b.line) return false;
  return a.character < b.character;
};

/** Checks if position a comes after position b in document order. */
export const positionAfter = (a: Position, b: Position): boolean => positionBefore(b, a);

/** Checks if two positions are equal (same line and character). */
export const positionEqual = (a: Position, b: Position): boolean => a.line === b.line && a.character === b.character;

/** Checks if a position falls within a range (inclusive). */
export const positionInRange = (pos: Position, range: Range): boolean => {
  if (positionBefore(pos, range.start)) return false;
  if (positionAfter(pos, range.end)) return false;
  return true;
};

/** Checks if two ranges overlap (share any common positions). */
export const rangesOverlap = (a: Range, b: Range): boolean => {
  if (positionAfter(a.start, b.end)) return false;
  if (positionBefore(a.end, b.start)) return false;
  return true;
};

/** Checks if one range completely contains another range. */
export const rangeContains = (outer: Range, inner: Range): boolean =>
  positionInRange(inner.start, outer) && positionInRange(inner.end, outer);

/** Converts a character offset in a string to a Position (line and character). */
export const offsetToPosition = (text: string, offset: number): Position => {
  let line = 0;
  let character = 0;

  for (let i = 0; i < offset && i < text.length; i++)
    if (text[i] === '\n') {
      line++;
      character = 0;
    } else character++;

  return { line, character };
};

/** Converts a Position (line and character) to a character offset in a string. */
export const positionToOffset = (text: string, position: Position): number => {
  let offset = 0;
  let line = 0;
  let character = 0;

  while (offset < text.length) {
    if (line === position.line && character === position.character) return offset;

    if (text[offset] === '\n') {
      line++;
      character = 0;
    } else character++;
    offset++;
  }

  return offset;
};
