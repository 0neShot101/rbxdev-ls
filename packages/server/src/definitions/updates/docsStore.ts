import { readOptional } from '@definitions/updates/storage';
import { decodeJson, isDocsEntry } from '@definitions/updates/validate';
import { isString } from '@utils/guards';

import type { DocsDatabase, DocsEntry, DocsSource } from '@typings/docs';

const LF = 10;
const QUOTE = 34;
const COMMA = 44;
const BACKSLASH = 92;
const HEAD = '{\n';
const TAIL = '\n}\n';

/**
 * Serialises a documentation database in the `sorted-lines` layout: valid JSON with one `"key":value` entry per line,
 * ordered by key in UTF-16 code unit order. `JSON.stringify` never emits a raw newline, so each entry is one line.
 * @param database - Validated documentation database.
 */
export const serializeDocs = (database: DocsDatabase): Buffer => {
  const lines = Object.keys(database)
    .sort()
    .map(key => `${JSON.stringify(key)}:${JSON.stringify(database[key])}`);
  return Buffer.from(`${HEAD}${lines.join(',\n')}${TAIL}`, 'utf-8');
};

/**
 * Wraps a fully decoded database as a keyed source.
 * @param database - Decoded documentation database.
 */
export const docsSource = (database: DocsDatabase): DocsSource => new Map(Object.entries(database));

/**
 * Opens a `sorted-lines` docs file for keyed lookup. The file is read once; each lookup binary-searches its lines,
 * then parses and validates only the matching entry, so no lookup ever parses the whole database. A missing file or
 * one without the layout's framing yields `undefined`; a corrupt entry is reported as absent.
 * @param path - Docs file written by `serializeDocs`.
 * @param preloaded - Contents of that file when the caller has already read them.
 */
export const openDocsStore = (path: string, preloaded?: Buffer): DocsSource | undefined => {
  const buffer = preloaded ?? readOptional(path);
  if (buffer === undefined) return undefined;
  const bodyEnd = buffer.length - TAIL.length;
  if (bodyEnd <= HEAD.length || buffer[HEAD.length] !== QUOTE) return undefined;
  if (buffer.toString('latin1', 0, HEAD.length) !== HEAD || buffer.toString('latin1', bodyEnd) !== TAIL)
    return undefined;

  const entries = new Map<string, DocsEntry | undefined>();

  const closingQuote = (lineStart: number): number => {
    let index = lineStart + 1;
    while (index < bodyEnd && buffer[index] !== QUOTE) index += buffer[index] === BACKSLASH ? 2 : 1;
    return index;
  };

  const find = (symbol: string): DocsEntry | undefined => {
    let low = HEAD.length;
    let high = bodyEnd;
    while (low < high) {
      const middle = (low + high) >>> 1;
      const lineStart = buffer.lastIndexOf(LF, middle - 1) + 1;
      const lineEnd = buffer.indexOf(LF, lineStart);
      const keyEnd = closingQuote(lineStart);
      const literal = buffer.toString('utf-8', lineStart, keyEnd + 1);
      const key = literal.includes('\\') ? decodeJson(literal, isString) : literal.slice(1, -1);
      if (key === undefined) return undefined;
      if (key === symbol) {
        const valueEnd = buffer[lineEnd - 1] === COMMA ? lineEnd - 1 : lineEnd;
        return decodeJson(buffer.toString('utf-8', keyEnd + 2, valueEnd), isDocsEntry);
      }
      if (key < symbol) low = lineEnd + 1;
      else high = lineStart - 1;
    }
    return undefined;
  };

  return {
    'get': symbol => {
      if (entries.has(symbol) === false) entries.set(symbol, find(symbol));
      return entries.get(symbol);
    },
  };
};
