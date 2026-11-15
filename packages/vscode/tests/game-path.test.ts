import { describe, expect, test } from 'bun:test';

import { escapeLuaString, formatGamePath, stripMarker, stripMarkers, toLuaLookup } from '@extension/utils/gamePath';

describe('escapeLuaString', () => {
  test('escapes quotes, backslashes and control characters', () => {
    expect(escapeLuaString('say "hi"')).toBe('say \\"hi\\"');
    expect(escapeLuaString('C:\\path')).toBe('C:\\\\path');
    expect(escapeLuaString('a\nb\rc\td')).toBe('a\\nb\\rc\\td');
  });

  test('escapes NUL bytes as a decimal escape', () => expect(escapeLuaString('a\0b')).toBe('a\\000b'));

  test('escapes backslashes before introducing escape sequences', () => expect(escapeLuaString('\\n')).toBe('\\\\n'));
});

describe('duplicate-name markers', () => {
  test('stripMarker removes the NUL marker and its index', () => {
    expect(stripMarker('Part\u00003')).toBe('Part');
    expect(stripMarker('Part')).toBe('Part');
  });

  test('stripMarkers and formatGamePath drop markers from every segment', () => {
    const segments = ['Workspace', 'Model\u00001', 'Part\u00002'];
    expect(stripMarkers(segments)).toEqual(['Workspace', 'Model', 'Part']);
    expect(formatGamePath(segments)).toBe('game.Workspace.Model.Part');
  });
});

describe('toLuaLookup', () => {
  test('returns nil for an empty path', () => expect(toLuaLookup([])).toBe('nil'));

  test('builds an escaped GetService/FindFirstChild chain', () =>
    expect(toLuaLookup(['Workspace', 'My "Part"', 'line\nbreak'])).toBe(
      'game:GetService("Workspace"):FindFirstChild("My \\"Part\\""):FindFirstChild("line\\nbreak")',
    ));

  test('escapes NUL bytes left in unstripped segments', () =>
    expect(toLuaLookup(['Workspace', 'Part\u00002'])).toBe(
      'game:GetService("Workspace"):FindFirstChild("Part\\0002")',
    ));
});
