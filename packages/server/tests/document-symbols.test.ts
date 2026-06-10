import { collectCallHierarchyFunctions, collectCallSites } from '@lsp/handlers/callHierarchy';
import { collectCodeLensReferences } from '@lsp/handlers/codeLens';
import { collectDocumentSymbols } from '@lsp/handlers/documentSymbol';
import { collectWorkspaceSymbols } from '@lsp/handlers/workspaceSymbol';
import { parse } from '@parser/parser';
import { describe, expect, test } from 'bun:test';
import { SymbolKind } from 'vscode-languageserver';

import type { Chunk } from '@typings/ast';
import type { DocumentSymbol } from 'vscode-languageserver';

const TEST_URI = 'file:///test.luau';

const parseCode = (code: string): Chunk => parse(code).ast;

const symbolNames = (symbols: ReadonlyArray<DocumentSymbol>): string[] =>
  symbols.flatMap(symbol => [symbol.name, ...symbolNames(symbol.children ?? [])]);

describe('Document Symbols', () => {
  test('collects local functions', () => {
    const symbols = collectDocumentSymbols(parseCode('local function foo() end\nlocal function bar() end'));

    expect(symbols).toEqual([
      {
        'name': 'foo',
        'kind': SymbolKind.Function,
        'range': { 'start': { 'line': 0, 'character': 0 }, 'end': { 'line': 0, 'character': 24 } },
        'selectionRange': { 'start': { 'line': 0, 'character': 15 }, 'end': { 'line': 0, 'character': 18 } },
        'children': [],
      },
      {
        'name': 'bar',
        'kind': SymbolKind.Function,
        'range': { 'start': { 'line': 1, 'character': 0 }, 'end': { 'line': 1, 'character': 24 } },
        'selectionRange': { 'start': { 'line': 1, 'character': 15 }, 'end': { 'line': 1, 'character': 18 } },
        'children': [],
      },
    ]);
  });

  test('collects dotted global function declarations', () => {
    const symbols = collectDocumentSymbols(parseCode('function MyModule.init() end'));

    expect(symbols).toEqual([
      {
        'name': 'MyModule.init',
        'kind': SymbolKind.Function,
        'range': { 'start': { 'line': 0, 'character': 0 }, 'end': { 'line': 0, 'character': 28 } },
        'selectionRange': { 'start': { 'line': 0, 'character': 9 }, 'end': { 'line': 0, 'character': 17 } },
        'children': [],
      },
    ]);
  });

  test('collects method declarations with colon names', () => {
    const symbols = collectDocumentSymbols(parseCode('function MyClass:method() end'));

    expect(symbols).toEqual([
      {
        'name': 'MyClass:method',
        'kind': SymbolKind.Method,
        'range': { 'start': { 'line': 0, 'character': 0 }, 'end': { 'line': 0, 'character': 29 } },
        'selectionRange': { 'start': { 'line': 0, 'character': 9 }, 'end': { 'line': 0, 'character': 16 } },
        'children': [],
      },
    ]);
  });

  test('collects function expressions assigned to locals', () => {
    const symbols = collectDocumentSymbols(parseCode('local myFunc = function() end'));

    expect(symbols).toEqual([
      {
        'name': 'myFunc',
        'kind': SymbolKind.Function,
        'range': { 'start': { 'line': 0, 'character': 0 }, 'end': { 'line': 0, 'character': 29 } },
        'selectionRange': { 'start': { 'line': 0, 'character': 6 }, 'end': { 'line': 0, 'character': 12 } },
        'children': [],
      },
    ]);
  });

  test('collects plain local declarations as variables', () => {
    const symbols = collectDocumentSymbols(parseCode('local x, y = 1, 2'));

    expect(symbols.map(s => ({ 'name': s.name, 'kind': s.kind }))).toEqual([
      { 'name': 'x', 'kind': SymbolKind.Variable },
      { 'name': 'y', 'kind': SymbolKind.Variable },
    ]);
  });

  test('nests parameters and inner functions as children', () => {
    const symbols = collectDocumentSymbols(parseCode('local function outer(a, b)\n  local function inner() end\nend'));

    expect(symbols.length).toBe(1);
    expect(symbols[0]!.name).toBe('outer');
    expect(symbols[0]!.children!.map(c => ({ 'name': c.name, 'kind': c.kind }))).toEqual([
      { 'name': 'a', 'kind': SymbolKind.Variable },
      { 'name': 'b', 'kind': SymbolKind.Variable },
      { 'name': 'inner', 'kind': SymbolKind.Function },
    ]);
  });

  test('collects functions inside if blocks within a function body', () => {
    const code = 'local function wrapper()\n  if true then\n    local function inner() end\n  end\nend';
    const symbols = collectDocumentSymbols(parseCode(code));

    expect(symbols.length).toBe(1);
    expect(symbols[0]!.children!.map(c => c.name)).toEqual(['inner']);
    expect(symbols[0]!.children![0]!.kind).toBe(SymbolKind.Function);
    expect(symbols[0]!.children![0]!.range.start.line).toBe(2);
  });

  test('collects functions inside while loops within a function body', () => {
    const code = 'local function wrapper()\n  while true do\n    local function loopFunc() end\n  end\nend';
    const symbols = collectDocumentSymbols(parseCode(code));

    expect(symbols.length).toBe(1);
    expect(symbols[0]!.children!.map(c => ({ 'name': c.name, 'kind': c.kind }))).toEqual([
      { 'name': 'loopFunc', 'kind': SymbolKind.Function },
    ]);
  });

  test('collects numeric for-loop variables and body locals', () => {
    const code = 'local function wrapper()\n  for i = 1, 10 do\n    local total = 0\n  end\nend';
    const symbols = collectDocumentSymbols(parseCode(code));

    expect(symbols[0]!.children!.map(c => ({ 'name': c.name, 'kind': c.kind }))).toEqual([
      { 'name': 'i', 'kind': SymbolKind.Variable },
      { 'name': 'total', 'kind': SymbolKind.Variable },
    ]);
    expect(symbols[0]!.children![0]!.range).toEqual({
      'start': { 'line': 1, 'character': 6 },
      'end': { 'line': 1, 'character': 7 },
    });
  });

  test('collects generic for-loop variables', () => {
    const code = 'local function wrapper()\n  for key, value in pairs(t) do end\nend';
    const symbols = collectDocumentSymbols(parseCode(code));

    expect(symbols[0]!.children!.map(c => ({ 'name': c.name, 'kind': c.kind }))).toEqual([
      { 'name': 'key', 'kind': SymbolKind.Variable },
      { 'name': 'value', 'kind': SymbolKind.Variable },
    ]);
  });

  test('collects type aliases as type parameters', () => {
    const symbols = collectDocumentSymbols(parseCode('type Point = { x: number }'));

    expect(symbols).toEqual([
      {
        'name': 'Point',
        'kind': SymbolKind.TypeParameter,
        'range': { 'start': { 'line': 0, 'character': 0 }, 'end': { 'line': 0, 'character': 26 } },
        'selectionRange': { 'start': { 'line': 0, 'character': 5 }, 'end': { 'line': 0, 'character': 10 } },
      },
    ]);
  });

  test('prefixes export statement inners with "export "', () => {
    const symbols = collectDocumentSymbols(parseCode('export type Config = { debug: boolean }'));

    expect(symbols.length).toBe(1);
    expect(symbols[0]!.name).toBe('export Config');
    expect(symbols[0]!.kind).toBe(SymbolKind.TypeParameter);
  });

  test('returns zero-based line numbers', () => {
    const code = 'local function first()\nend\n\nlocal function second()\nend';
    const symbols = collectDocumentSymbols(parseCode(code));

    expect(symbols.map(s => ({ 'name': s.name, 'line': s.range.start.line }))).toEqual([
      { 'name': 'first', 'line': 0 },
      { 'name': 'second', 'line': 3 },
    ]);
  });

  test('returns no symbols for an empty file', () => expect(collectDocumentSymbols(parseCode(''))).toEqual([]));
});

describe('Workspace Symbols', () => {
  test('collects top-level declarations as symbol information', () => {
    const symbols = collectWorkspaceSymbols(parseCode('local function foo() end\ntype MyType = number'), TEST_URI);

    expect(symbols).toEqual([
      {
        'name': 'foo',
        'kind': SymbolKind.Function,
        'location': {
          'uri': TEST_URI,
          'range': { 'start': { 'line': 0, 'character': 15 }, 'end': { 'line': 0, 'character': 18 } },
        },
      },
      {
        'name': 'MyType',
        'kind': SymbolKind.TypeParameter,
        'location': {
          'uri': TEST_URI,
          'range': { 'start': { 'line': 1, 'character': 5 }, 'end': { 'line': 1, 'character': 11 } },
        },
      },
    ]);
  });

  test('omits containerName on top-level symbols', () => {
    const symbols = collectWorkspaceSymbols(parseCode('local config = {}'), TEST_URI);

    expect(symbols.length).toBe(1);
    expect(symbols[0]!.containerName).toBeUndefined();
  });

  test('reaches functions nested in top-level control flow', () => {
    const symbols = collectWorkspaceSymbols(parseCode('if true then\n  local function inner() end\nend'), TEST_URI);

    expect(symbols.map(s => ({ 'name': s.name, 'kind': s.kind }))).toEqual([
      { 'name': 'inner', 'kind': SymbolKind.Function },
    ]);
  });

  test('keeps the bare name for exported type aliases', () => {
    const symbols = collectWorkspaceSymbols(parseCode('export type Config = { debug: boolean }'), TEST_URI);

    expect(symbols.map(s => ({ 'name': s.name, 'kind': s.kind }))).toEqual([
      { 'name': 'Config', 'kind': SymbolKind.TypeParameter },
    ]);
  });

  test('uses colon names for method declarations', () => {
    const symbols = collectWorkspaceSymbols(parseCode('function MyClass:method() end'), TEST_URI);

    expect(symbols.map(s => ({ 'name': s.name, 'kind': s.kind }))).toEqual([
      { 'name': 'MyClass:method', 'kind': SymbolKind.Method },
    ]);
  });
});

describe('Symbol Error Recovery', () => {
  const brokenSources = [
    'local function ',
    'function ',
    'local x, = 1',
    'for  in pairs(t) do end',
    'export type ',
    'local',
  ];

  for (const source of brokenSources) {
    test(`document symbols survive ${JSON.stringify(source)}`, () => {
      const chunk = parseCode(source);

      expect(() => collectDocumentSymbols(chunk)).not.toThrow();
      expect(symbolNames(collectDocumentSymbols(chunk))).not.toContain('');
    });

    test(`workspace symbols survive ${JSON.stringify(source)}`, () => {
      const chunk = parseCode(source);

      expect(() => collectWorkspaceSymbols(chunk, TEST_URI)).not.toThrow();
      expect(collectWorkspaceSymbols(chunk, TEST_URI).map(s => s.name)).not.toContain('');
    });
  }
});

describe('Code Lens - Reference Counting', () => {
  test('records every reference to a function', () => {
    const code = 'local function myFunc()\nend\nmyFunc()\nmyFunc()';
    const references = collectCodeLensReferences(parseCode(code));

    expect(references.get('myFunc')!.map(l => l.line)).toEqual([0, 0, 2, 3]);
  });

  test('records every reference to a variable', () => {
    const code = 'local x = 1\nprint(x)\nlocal y = x + 1';
    const references = collectCodeLensReferences(parseCode(code));

    expect(references.get('x')!.map(l => l.line)).toEqual([0, 0, 1, 2]);
  });

  test('records declaration-only variable references', () => {
    const references = collectCodeLensReferences(parseCode('local unused = 42'));
    const locations = references.get('unused')!;

    expect(locations.length).toBeGreaterThanOrEqual(1);
    expect(locations.every(l => l.line === 0)).toBe(true);
  });
});

describe('Call Hierarchy', () => {
  test('finds function calls in a body with their container', () => {
    const code = 'local function foo()\n  bar()\n  baz()\nend';
    const sites = collectCallSites(parseCode(code));

    expect(sites.map(s => ({ 'name': s.name, 'containingFunction': s.containingFunction }))).toEqual([
      { 'name': 'bar', 'containingFunction': 'foo' },
      { 'name': 'baz', 'containingFunction': 'foo' },
    ]);
  });

  test('finds method calls in a body', () => {
    const code = 'local function foo()\n  obj:method()\n  thing:doStuff()\nend';
    const sites = collectCallSites(parseCode(code));

    expect(sites.map(s => s.name)).toEqual(['method', 'doStuff']);
  });

  test('identifies the containing function for call sites', () => {
    const code = 'local function outer()\n  inner()\nend\n\nlocal function inner()\nend';
    const chunk = parseCode(code);
    const functions = collectCallHierarchyFunctions(chunk.body);
    const sites = collectCallSites(chunk);

    expect(functions.map(f => ({ 'name': f.name, 'line': f.range.start.line }))).toEqual([
      { 'name': 'outer', 'line': 0 },
      { 'name': 'inner', 'line': 4 },
    ]);
    expect(sites).toEqual([
      {
        'name': 'inner',
        'range': { 'start': { 'line': 1, 'character': 2 }, 'end': { 'line': 2, 'character': 0 } },
        'containingFunction': 'outer',
      },
    ]);
  });
});
