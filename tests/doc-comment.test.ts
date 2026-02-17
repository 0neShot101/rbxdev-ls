import { collectDocComments, formatDocCommentForDisplay, parseDocComment } from '@parser/docComment';
import { isLineIgnored, parseIgnoreDirectives } from '@typings/ignoreDirectives';
import { describe, expect, test } from 'bun:test';

import type { Comment } from '@typings/ast';

const makeComment = (value: string, line: number): Comment => ({
  'kind': 'Comment',
  'value': value,
  'isBlock': false,
  'range': {
    'start': { 'line': line, 'column': 1, 'offset': 0 },
    'end': { 'line': line, 'column': value.length, 'offset': 0 },
  },
});

describe('parseDocComment', () => {
  test('parses simple description', () => {
    const result = parseDocComment('--- This is a description');
    expect(result).toBeDefined();
    expect(result?.description).toBe('This is a description');
  });

  test('parses multi-line description', () => {
    const result = parseDocComment('--- Line one\n--- Line two');
    expect(result).toBeDefined();
    expect(result?.description).toBe('Line one\nLine two');
  });

  test('returns undefined for non-doc comment', () => {
    const result = parseDocComment('-- regular comment');
    expect(result).toBeUndefined();
  });

  test('returns undefined for empty string', () => {
    const result = parseDocComment('');
    expect(result).toBeUndefined();
  });

  test('parses @param with name, type, and description', () => {
    const result = parseDocComment('--- @param x number The x value');
    expect(result).toBeDefined();
    expect(result?.params.length).toBe(1);
    expect(result?.params[0]?.name).toBe('x');
    expect(result?.params[0]?.type).toBe('number');
    expect(result?.params[0]?.description).toBe('The x value');
  });

  test('parses @param with name only', () => {
    const result = parseDocComment('--- @param x');
    expect(result).toBeDefined();
    expect(result?.params.length).toBe(1);
    expect(result?.params[0]?.name).toBe('x');
    expect(result?.params[0]?.type).toBeUndefined();
    expect(result?.params[0]?.description).toBeUndefined();
  });

  test('parses @param with union type', () => {
    const result = parseDocComment('--- @param x number | string A value');
    expect(result).toBeDefined();
    expect(result?.params.length).toBe(1);
    expect(result?.params[0]?.name).toBe('x');
    expect(result?.params[0]?.type).toBe('number | string');
    expect(result?.params[0]?.description).toBe('A value');
  });

  test('parses @return with type and description', () => {
    const result = parseDocComment('--- @return string The result');
    expect(result).toBeDefined();
    expect(result?.returns.length).toBe(1);
    expect(result?.returns[0]?.type).toBe('string');
    expect(result?.returns[0]?.description).toBe('The result');
  });

  test('parses @return with type only', () => {
    const result = parseDocComment('--- @return number');
    expect(result).toBeDefined();
    expect(result?.returns.length).toBe(1);
    expect(result?.returns[0]?.type).toBe('number');
    expect(result?.returns[0]?.description).toBeUndefined();
  });

  test('parses @type tag', () => {
    const result = parseDocComment('--- @type number');
    expect(result).toBeDefined();
    expect(result?.type).toBe('number');
  });

  test('parses @class tag', () => {
    const result = parseDocComment('--- @class MyClass');
    expect(result).toBeDefined();
    expect(result?.class).toBe('MyClass');
  });

  test('parses @field tag', () => {
    const result = parseDocComment('--- @field name string The name');
    expect(result).toBeDefined();
    expect(result?.fields.length).toBe(1);
    expect(result?.fields[0]?.name).toBe('name');
    expect(result?.fields[0]?.type).toBe('string');
    expect(result?.fields[0]?.description).toBe('The name');
  });

  test('parses @deprecated with message', () => {
    const result = parseDocComment('--- @deprecated Use newMethod instead');
    expect(result).toBeDefined();
    expect(result?.deprecated).toBe('Use newMethod instead');
  });

  test('parses @deprecated without message', () => {
    const result = parseDocComment('--- @deprecated');
    expect(result).toBeDefined();
    expect(result?.deprecated).toBe('Deprecated');
  });

  test('parses full doc comment with all tags combined', () => {
    const input = [
      '--- A utility function.',
      '--- @param x number The x value',
      '--- @param y string The y label',
      '--- @return boolean Whether it succeeded',
      '--- @type Function',
      '--- @class Utilities',
      '--- @field count number How many times called',
      '--- @deprecated Use newUtil instead',
    ].join('\n');

    const result = parseDocComment(input);
    expect(result).toBeDefined();
    expect(result?.description).toBe('A utility function.');
    expect(result?.params.length).toBe(2);
    expect(result?.params[0]?.name).toBe('x');
    expect(result?.params[1]?.name).toBe('y');
    expect(result?.returns.length).toBe(1);
    expect(result?.returns[0]?.type).toBe('boolean');
    expect(result?.type).toBe('Function');
    expect(result?.class).toBe('Utilities');
    expect(result?.fields.length).toBe(1);
    expect(result?.fields[0]?.name).toBe('count');
    expect(result?.deprecated).toBe('Use newUtil instead');
    expect(result?.raw).toBe(input);
  });

  test('parses empty doc comment with just triple dash', () => {
    const result = parseDocComment('---');
    expect(result).toBeDefined();
    expect(result?.description).toBeUndefined();
    expect(result?.params.length).toBe(0);
    expect(result?.returns.length).toBe(0);
    expect(result?.fields.length).toBe(0);
    expect(result?.type).toBeUndefined();
    expect(result?.class).toBeUndefined();
    expect(result?.deprecated).toBeUndefined();
  });

  test('skips blank lines between description lines', () => {
    const result = parseDocComment('--- Line 1\n---\n--- Line 2');
    expect(result).toBeDefined();
    expect(result?.description).toBe('Line 1\nLine 2');
  });
});

describe('collectDocComments', () => {
  test('parses single doc comment', () => {
    const result = collectDocComments(['--- Hello world']);
    expect(result).toBeDefined();
    expect(result?.description).toBe('Hello world');
  });

  test('joins multiple doc comments', () => {
    const result = collectDocComments(['--- Line one', '--- Line two']);
    expect(result).toBeDefined();
    expect(result?.description).toBe('Line one\nLine two');
  });

  test('filters out non-doc comments', () => {
    const result = collectDocComments(['-- regular', '--- doc']);
    expect(result).toBeDefined();
    expect(result?.description).toBe('doc');
  });

  test('returns undefined for empty array', () => {
    const result = collectDocComments([]);
    expect(result).toBeUndefined();
  });

  test('returns undefined when all comments are non-doc', () => {
    const result = collectDocComments(['-- regular', '-- also regular']);
    expect(result).toBeUndefined();
  });
});

describe('formatDocCommentForDisplay', () => {
  test('formats description only', () => {
    const result = formatDocCommentForDisplay({
      'description': 'A simple description',
      'params': [],
      'returns': [],
      'type': undefined,
      'class': undefined,
      'fields': [],
      'deprecated': undefined,
      'raw': '',
    });
    expect(result).toBe('A simple description\n');
  });

  test('formats deprecated only', () => {
    const result = formatDocCommentForDisplay({
      'description': undefined,
      'params': [],
      'returns': [],
      'type': undefined,
      'class': undefined,
      'fields': [],
      'deprecated': 'Use something else',
      'raw': '',
    });
    expect(result).toBe('**@deprecated** Use something else\n');
  });

  test('formats params', () => {
    const result = formatDocCommentForDisplay({
      'description': undefined,
      'params': [{ 'name': 'x', 'type': 'number', 'description': 'The value' }],
      'returns': [],
      'type': undefined,
      'class': undefined,
      'fields': [],
      'deprecated': undefined,
      'raw': '',
    });
    expect(result).toBe('@param `x`: number - The value');
  });

  test('formats returns', () => {
    const result = formatDocCommentForDisplay({
      'description': undefined,
      'params': [],
      'returns': [{ 'type': 'string', 'description': 'The result' }],
      'type': undefined,
      'class': undefined,
      'fields': [],
      'deprecated': undefined,
      'raw': '',
    });
    expect(result).toBe('@return string - The result');
  });

  test('formats full doc with correct order', () => {
    const result = formatDocCommentForDisplay({
      'description': 'Does something cool',
      'params': [{ 'name': 'a', 'type': 'number', 'description': 'First arg' }],
      'returns': [{ 'type': 'boolean', 'description': 'Success' }],
      'type': undefined,
      'class': undefined,
      'fields': [],
      'deprecated': 'Old API',
      'raw': '',
    });
    const lines = result.split('\n');
    expect(lines[0]).toBe('**@deprecated** Old API');
    expect(lines[1]).toBe('');
    expect(lines[2]).toBe('Does something cool');
    expect(lines[3]).toBe('');
    expect(lines[4]).toBe('@param `a`: number - First arg');
    expect(lines[5]).toBe('@return boolean - Success');
  });

  test('formats empty doc as empty string', () => {
    const result = formatDocCommentForDisplay({
      'description': undefined,
      'params': [],
      'returns': [],
      'type': undefined,
      'class': undefined,
      'fields': [],
      'deprecated': undefined,
      'raw': '',
    });
    expect(result).toBe('');
  });
});

describe('parseIgnoreDirectives', () => {
  test('@rbxls-ignore ignores next line', () => {
    const comments = [makeComment('-- @rbxls-ignore', 1)];
    const state = parseIgnoreDirectives(comments, 10);
    expect(isLineIgnored(state, 2)).toBe(true);
    expect(isLineIgnored(state, 1)).toBe(false);
  });

  test('@rbxls-ignore-line ignores same line', () => {
    const comments = [makeComment('-- @rbxls-ignore-line', 3)];
    const state = parseIgnoreDirectives(comments, 10);
    expect(isLineIgnored(state, 3)).toBe(true);
    expect(isLineIgnored(state, 4)).toBe(false);
  });

  test('@rbxls-disable-next-line ignores next line', () => {
    const comments = [makeComment('-- @rbxls-disable-next-line', 5)];
    const state = parseIgnoreDirectives(comments, 10);
    expect(isLineIgnored(state, 6)).toBe(true);
    expect(isLineIgnored(state, 5)).toBe(false);
  });

  test('@rbxls-disable and @rbxls-enable creates ignored range', () => {
    const comments = [makeComment('-- @rbxls-disable', 2), makeComment('-- @rbxls-enable', 5)];
    const state = parseIgnoreDirectives(comments, 10);
    expect(isLineIgnored(state, 1)).toBe(false);
    expect(isLineIgnored(state, 2)).toBe(true);
    expect(isLineIgnored(state, 3)).toBe(true);
    expect(isLineIgnored(state, 4)).toBe(true);
    expect(isLineIgnored(state, 5)).toBe(true);
    expect(isLineIgnored(state, 6)).toBe(false);
  });

  test('unterminated @rbxls-disable ignores to end of file', () => {
    const comments = [makeComment('-- @rbxls-disable', 3)];
    const state = parseIgnoreDirectives(comments, 10);
    for (let line = 3; line <= 10; line++) {
      expect(isLineIgnored(state, line)).toBe(true);
    }
    expect(isLineIgnored(state, 2)).toBe(false);
  });

  test('no directives results in no ignored lines', () => {
    const state = parseIgnoreDirectives([], 10);
    for (let line = 1; line <= 10; line++) {
      expect(isLineIgnored(state, line)).toBe(false);
    }
  });

  test('multiple @rbxls-ignore directives ignore multiple lines', () => {
    const comments = [makeComment('-- @rbxls-ignore', 1), makeComment('-- @rbxls-ignore', 4)];
    const state = parseIgnoreDirectives(comments, 10);
    expect(isLineIgnored(state, 2)).toBe(true);
    expect(isLineIgnored(state, 5)).toBe(true);
    expect(isLineIgnored(state, 3)).toBe(false);
    expect(isLineIgnored(state, 6)).toBe(false);
  });

  test('regular comment without directive does not ignore any lines', () => {
    const comments = [makeComment('-- just a regular comment', 3)];
    const state = parseIgnoreDirectives(comments, 10);
    for (let line = 1; line <= 10; line++) {
      expect(isLineIgnored(state, line)).toBe(false);
    }
  });

  test('isLineIgnored returns false for non-ignored line', () => {
    const comments = [makeComment('-- @rbxls-ignore', 1)];
    const state = parseIgnoreDirectives(comments, 10);
    expect(isLineIgnored(state, 7)).toBe(false);
  });

  test('isLineIgnored returns true for ignored line', () => {
    const comments = [makeComment('-- @rbxls-ignore', 1)];
    const state = parseIgnoreDirectives(comments, 10);
    expect(isLineIgnored(state, 2)).toBe(true);
  });

  test('code after @rbxls-enable is not ignored', () => {
    const comments = [makeComment('-- @rbxls-disable', 2), makeComment('-- @rbxls-enable', 4)];
    const state = parseIgnoreDirectives(comments, 10);
    expect(isLineIgnored(state, 2)).toBe(true);
    expect(isLineIgnored(state, 3)).toBe(true);
    expect(isLineIgnored(state, 4)).toBe(true);
    expect(isLineIgnored(state, 5)).toBe(false);
    expect(isLineIgnored(state, 6)).toBe(false);
    expect(isLineIgnored(state, 7)).toBe(false);
  });
});
