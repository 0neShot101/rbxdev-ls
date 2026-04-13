import { buildGlobalEnvironment } from '@definitions/globals';
import { formatMemberHoverForType, resolveSymbolTypeInDocument } from '@lsp/handlers/hover';
import { parse } from '@parser/parser';
import { checkProgram } from '@typings/checker';
import { describe, expect, test } from 'bun:test';

import type { ParsedDocument } from '@typings/lsp';
import type { ClassType } from '@typings/types';

const globalEnv = buildGlobalEnvironment();

const resolveClass = (name: string): ClassType | undefined => {
  const cls = globalEnv.robloxClasses.get(name);
  return cls !== undefined && cls.kind === 'Class' ? cls : undefined;
};

const makeParsedDocument = (code: string): ParsedDocument => {
  const result = parse(code);
  const classes = new Map<string, ClassType>();
  for (const [name, type] of globalEnv.robloxClasses) {
    if (type.kind === 'Class') classes.set(name, type);
  }
  const typeCheckResult = checkProgram(result.ast, {
    classes,
    'dataTypes': globalEnv.robloxDataTypes,
    'mode': 'nonstrict',
  });
  return {
    'uri': 'file:///test.luau',
    'version': 1,
    'content': code,
    'ast': result.ast,
    'parseErrors': [],
    'typeErrors': typeCheckResult.diagnostics,
    typeCheckResult,
  };
};

describe('resolveSymbolTypeInDocument', () => {
  test('finds a local table literal and returns its TableType', () => {
    const doc = makeParsedDocument(`
local Counter = {
  increment = function(n) return n + 1 end,
  decrement = function(n) return n - 1 end,
  reset = function() return 0 end,
}
`);
    const t = resolveSymbolTypeInDocument(doc, 'Counter');
    expect(t).toBeDefined();
    expect(t?.kind).toBe('Table');
    if (t?.kind === 'Table') {
      expect(t.properties.has('increment')).toBe(true);
      expect(t.properties.has('decrement')).toBe(true);
      expect(t.properties.has('reset')).toBe(true);
    }
  });

  test('returns undefined for an unknown symbol', () => {
    const doc = makeParsedDocument('local x = 1');
    expect(resolveSymbolTypeInDocument(doc, 'Counter')).toBeUndefined();
  });

  test('returns undefined when typeCheckResult is missing', () => {
    const doc = makeParsedDocument('local x = 1');
    const docNoCheck: ParsedDocument = { ...doc, 'typeCheckResult': undefined };
    expect(resolveSymbolTypeInDocument(docNoCheck, 'x')).toBeUndefined();
  });
});

describe('formatMemberHoverForType — user tables (sourcemap scenario)', () => {
  test('returns markdown for an existing property on a TableType', () => {
    const doc = makeParsedDocument(`
local Counter = {
  increment = function(n) return n + 1 end,
}
`);
    const t = resolveSymbolTypeInDocument(doc, 'Counter');
    expect(t).toBeDefined();
    if (t === undefined) return;

    const md = formatMemberHoverForType(t, 'increment', resolveClass);
    expect(md).toBeDefined();
    expect(md).toContain('increment');
    // Should be wrapped in a lua code block (either via formatFunctionDocFull
    // or the plain typeToString fallback).
    expect(md).toContain('```lua');
  });

  test('returns undefined for a missing property on a TableType', () => {
    const doc = makeParsedDocument('local t = { foo = 1 }');
    const t = resolveSymbolTypeInDocument(doc, 't');
    if (t === undefined) throw new Error('expected t in scope');
    expect(formatMemberHoverForType(t, 'bar', resolveClass)).toBeUndefined();
  });

  test('handles a table with a value field', () => {
    const doc = makeParsedDocument('local config = { version = 1, name = "abc" }');
    const t = resolveSymbolTypeInDocument(doc, 'config');
    if (t === undefined) throw new Error('expected config in scope');
    const md = formatMemberHoverForType(t, 'version', resolveClass);
    expect(md).toBeDefined();
    expect(md).toContain('version');
  });
});

describe('formatMemberHoverForType — class-typed locals', () => {
  test('returns a property hover for a typed class local', () => {
    const doc = makeParsedDocument(`
local part: Part = nil :: any
`);
    const t = resolveSymbolTypeInDocument(doc, 'part');
    expect(t).toBeDefined();
    if (t === undefined) return;
    expect(t.kind).toBe('Class');
    if (t.kind !== 'Class') return;

    const md = formatMemberHoverForType(t, 'Position', resolveClass);
    expect(md).toBeDefined();
    expect(md).toContain('Position');
    expect(md).toContain('```lua');
  });

  test('returns a method hover for a typed class local', () => {
    const doc = makeParsedDocument(`
local inst: Instance = nil :: any
`);
    const t = resolveSymbolTypeInDocument(doc, 'inst');
    expect(t).toBeDefined();
    if (t === undefined) return;
    if (t.kind !== 'Class') return;

    const md = formatMemberHoverForType(t, 'FindFirstChild', resolveClass);
    expect(md).toBeDefined();
    expect(md).toContain('FindFirstChild');
  });

  test('walks the class superclass chain', () => {
    // Part inherits from BasePart inherits from PVInstance inherits from Instance.
    // FindFirstChild lives on Instance — should still be found via the chain.
    const doc = makeParsedDocument(`
local p: Part = nil :: any
`);
    const t = resolveSymbolTypeInDocument(doc, 'p');
    if (t === undefined || t.kind !== 'Class') throw new Error('expected Part class in scope');

    const md = formatMemberHoverForType(t, 'FindFirstChild', resolveClass);
    expect(md).toBeDefined();
    expect(md).toContain('FindFirstChild');
  });

  test('returns undefined for an unknown member on a class', () => {
    const doc = makeParsedDocument('local p: Part = nil :: any');
    const t = resolveSymbolTypeInDocument(doc, 'p');
    if (t === undefined || t.kind !== 'Class') throw new Error('expected Part class in scope');
    expect(formatMemberHoverForType(t, 'ThisDoesNotExist', resolveClass)).toBeUndefined();
  });
});

describe('formatMemberHoverForType — non-applicable types', () => {
  test('returns undefined for primitive types', () => {
    const doc = makeParsedDocument('local n = 42');
    const t = resolveSymbolTypeInDocument(doc, 'n');
    expect(t).toBeDefined();
    if (t === undefined) return;
    expect(formatMemberHoverForType(t, 'anything', resolveClass)).toBeUndefined();
  });
});
