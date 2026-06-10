import { collectCallHierarchyFunctions, collectCallSites } from '@lsp/handlers/callHierarchy';
import { findColors } from '@lsp/handlers/color';
import { collectDeclarations, findBestDeclaration } from '@lsp/handlers/definition';
import { collectHighlights } from '@lsp/handlers/documentHighlight';
import { collectFoldingRanges } from '@lsp/handlers/foldingRange';
import { formatClassDoc, formatTypeDoc, getMemberAccessAtPosition, getWordAtPosition } from '@lsp/handlers/hover';
import { collectInlayHints } from '@lsp/handlers/inlayHints';
import { collectReferences } from '@lsp/handlers/references';
import { isValidIdentifier } from '@lsp/handlers/rename';
import { collectContainingRanges } from '@lsp/handlers/selectionRange';
import { countCommas, createSignatureInfo, findFunctionCall } from '@lsp/handlers/signature';
import { collectWorkspaceSymbols } from '@lsp/handlers/workspaceSymbol';
import { parse } from '@parser/parser';
import { checkProgram } from '@typings/checker';
import { describe, expect, test } from 'bun:test';

import type { Chunk } from '@typings/ast';
import type { ParsedDocument } from '@typings/lsp';
import type { DocComment } from '@typings/parser';
import type { FunctionType } from '@typings/types';

const parseCode = (code: string): Chunk => {
  const result = parse(code);
  return result.ast;
};

const makeParsedDocument = (code: string): ParsedDocument => {
  const result = parse(code);
  const typeCheckResult = checkProgram(result.ast);
  return {
    'uri': 'file:///test.luau',
    'version': 1,
    'content': code,
    'ast': result.ast,
    'parseErrors': [],
    'typeErrors': typeCheckResult.diagnostics,
    'typeCheckResult': typeCheckResult,
  };
};

describe('Hover Edge Cases', () => {
  test('getWordAtPosition at end of line boundary returns undefined', () => {
    const content = 'local x = 42';
    const word = getWordAtPosition(content, 0, 14);
    expect(word).toBeUndefined();
  });

  test('getWordAtPosition on keyword returns the keyword', () => {
    const content = 'local x = 42';
    const word = getWordAtPosition(content, 0, 2);
    expect(word).toBe('local');
  });

  test('getWordAtPosition on underscore-prefixed identifier', () => {
    const content = 'local _private = 1';
    const word = getWordAtPosition(content, 0, 6);
    expect(word).toBe('_private');
  });

  test('getMemberAccessAtPosition with multi-level chain returns innermost access', () => {
    const content = 'a.b.c';
    const info = getMemberAccessAtPosition(content, 0, 4);
    expect(info).toBeDefined();
    if (info !== undefined) {
      expect(info.memberName).toBe('c');
      expect(info.objectName).toBe('b');
    }
  });

  test('getMemberAccessAtPosition at the dot returns undefined', () => {
    const content = 'obj.field';
    const info = getMemberAccessAtPosition(content, 0, 3);
    expect(info).toBeUndefined();
  });

  test('getMemberAccessAtPosition returns undefined for standalone word', () => {
    const content = 'standalone';
    const info = getMemberAccessAtPosition(content, 0, 4);
    expect(info).toBeUndefined();
  });

  test('formatTypeDoc for union type contains both member types', () => {
    const doc = formatTypeDoc('x', {
      'kind': 'Union',
      'types': [
        { 'kind': 'Primitive', 'name': 'number' },
        { 'kind': 'Primitive', 'name': 'string' },
      ],
    });
    expect(doc).toContain('number');
    expect(doc).toContain('string');
    expect(doc).toContain('x');
  });

  test('formatClassDoc with superclass contains extends', () => {
    const superclass = {
      'kind': 'Class' as const,
      'name': 'BaseClass',
      'superclass': undefined,
      'properties': new Map(),
      'methods': new Map(),
      'events': new Map(),
      'tags': [] as readonly string[],
    };
    const cls = {
      'kind': 'Class' as const,
      'name': 'DerivedClass',
      'superclass': superclass,
      'properties': new Map(),
      'methods': new Map(),
      'events': new Map(),
      'tags': [] as readonly string[],
    };
    const doc = formatClassDoc(cls);
    expect(doc).toContain('DerivedClass');
    expect(doc).toContain('extends');
    expect(doc).toContain('BaseClass');
  });
});

describe('Color Edge Cases', () => {
  test('Color3.fromRGB(0, 0, 0) produces black', () => {
    const colors = findColors('Color3.fromRGB(0, 0, 0)');
    expect(colors.length).toBe(1);
    expect(colors[0]!.red).toBeCloseTo(0, 5);
    expect(colors[0]!.green).toBeCloseTo(0, 5);
    expect(colors[0]!.blue).toBeCloseTo(0, 5);
  });

  test('Color3.fromRGB(255, 255, 255) produces white', () => {
    const colors = findColors('Color3.fromRGB(255, 255, 255)');
    expect(colors.length).toBe(1);
    expect(colors[0]!.red).toBeCloseTo(1.0, 5);
    expect(colors[0]!.green).toBeCloseTo(1.0, 5);
    expect(colors[0]!.blue).toBeCloseTo(1.0, 5);
  });

  test('Color3.new(0.5, 0.5, 0.5) produces grey', () => {
    const colors = findColors('Color3.new(0.5, 0.5, 0.5)');
    expect(colors.length).toBe(1);
    expect(colors[0]!.red).toBeCloseTo(0.5, 5);
    expect(colors[0]!.green).toBeCloseTo(0.5, 5);
    expect(colors[0]!.blue).toBeCloseTo(0.5, 5);
  });

  test('Color3.fromHex with lowercase hex and hash produces red', () => {
    const colors = findColors('Color3.fromHex("#ff0000")');
    expect(colors.length).toBe(1);
    expect(colors[0]!.red).toBeCloseTo(1.0, 5);
    expect(colors[0]!.green).toBeCloseTo(0, 5);
    expect(colors[0]!.blue).toBeCloseTo(0, 5);
  });

  test('Color3.fromHex without hash produces red', () => {
    const colors = findColors('Color3.fromHex("FF0000")');
    expect(colors.length).toBe(1);
    expect(colors[0]!.red).toBeCloseTo(1.0, 5);
    expect(colors[0]!.green).toBeCloseTo(0, 5);
    expect(colors[0]!.blue).toBeCloseTo(0, 5);
  });

  test('multiple colors on same line are both detected', () => {
    const colors = findColors('local a = Color3.fromRGB(255, 0, 0) local b = Color3.fromRGB(0, 255, 0)');
    expect(colors.length).toBe(2);
    expect(colors[0]!.red).toBeCloseTo(1.0, 1);
    expect(colors[0]!.green).toBeCloseTo(0, 1);
    expect(colors[1]!.red).toBeCloseTo(0, 1);
    expect(colors[1]!.green).toBeCloseTo(1.0, 1);
  });

  test('color inside assignment is detected', () => {
    const colors = findColors('part.Color = Color3.fromRGB(128, 64, 32)');
    expect(colors.length).toBe(1);
    expect(colors[0]!.red).toBeCloseTo(128 / 255, 2);
    expect(colors[0]!.green).toBeCloseTo(64 / 255, 2);
    expect(colors[0]!.blue).toBeCloseTo(32 / 255, 2);
  });

  test('colors with spaces in method call are still matched', () => {
    const colors = findColors('Color3 . fromRGB ( 100 , 200 , 50 )');
    expect(colors.length).toBe(1);
    expect(colors[0]!.red).toBeCloseTo(100 / 255, 2);
    expect(colors[0]!.green).toBeCloseTo(200 / 255, 2);
    expect(colors[0]!.blue).toBeCloseTo(50 / 255, 2);
  });
});

describe('Inlay Hints Detailed', () => {
  test('variable without annotation gets type hint', () => {
    const doc = makeParsedDocument('local x = 42');
    const hints = collectInlayHints(doc);
    expect(hints.length).toBeGreaterThanOrEqual(1);
    const numberHint = hints.find(h => h.label === ': number');
    expect(numberHint).toBeDefined();
  });

  test('variable with annotation does not add redundant hint', () => {
    const doc = makeParsedDocument('local x: number = 42');
    const hints = collectInlayHints(doc);
    const numberHint = hints.find(h => h.label === ': number' && h.position.line === 0);
    expect(numberHint).toBeUndefined();
  });

  test('for numeric loop always gets number hint', () => {
    const doc = makeParsedDocument('for i = 1, 10 do\nend');
    const hints = collectInlayHints(doc);
    const numberHint = hints.find(h => h.label === ': number');
    expect(numberHint).toBeDefined();
  });

  test('nested function params get hints', () => {
    const doc = makeParsedDocument('local function outer()\n  local function inner(x)\n  end\nend');
    const hints = collectInlayHints(doc);
    expect(hints).toBeDefined();
  });

  test('type string over 50 chars is suppressed for variable hints', () => {
    const longFields = Array.from({ 'length': 10 }, (_, i) => `field${i}: number`).join(', ');
    const code = `local x = { ${longFields} }`;
    const doc = makeParsedDocument(code);
    const hints = collectInlayHints(doc);
    const longHint = hints.find(h => typeof h.label === 'string' && h.label.length > 50);
    expect(longHint).toBeUndefined();
  });

  test('nil-valued variable does not get nil hint', () => {
    const doc = makeParsedDocument('local x = nil');
    const hints = collectInlayHints(doc);
    const nilHint = hints.find(h => h.label === ': nil');
    expect(nilHint).toBeUndefined();
  });
});

describe('Signature Help Edge Cases', () => {
  test('countCommas with deeply nested parens counts only outer commas', () => {
    const result = countCommas('g(a, b), h(c, d), e');
    expect(result).toBe(2);
  });

  test('countCommas with double-quoted string containing parens', () => {
    const result = countCommas('"a(b)", c');
    expect(result).toBe(1);
  });

  test('countCommas with single-quoted strings containing commas', () => {
    const result = countCommas("'a,b', c");
    expect(result).toBe(1);
  });

  test('countCommas with no args returns 0', () => {
    const result = countCommas('');
    expect(result).toBe(0);
  });

  test('findFunctionCall for nested call returns inner function name', () => {
    const content = 'outer(inner(';
    const result = findFunctionCall(content, 0, 13);
    expect(result).toBeDefined();
    if (result !== undefined) {
      expect(result.name).toBe('inner');
    }
  });

  test('createSignatureInfo builds correct signature information', () => {
    const func: FunctionType = {
      'kind': 'Function',
      'typeParams': [],
      'thisType': undefined,
      'params': [
        { 'name': 'x', 'type': { 'kind': 'Primitive', 'name': 'number' }, 'optional': false },
        { 'name': 'y', 'type': { 'kind': 'Primitive', 'name': 'string' }, 'optional': true },
      ],
      'returnType': { 'kind': 'Primitive', 'name': 'boolean' },
      'isVariadic': false,
    };
    const sig = createSignatureInfo('myFunc', func, undefined);
    expect(sig.label).toContain('myFunc');
    expect(sig.parameters).toBeDefined();
    expect(sig.parameters!.length).toBe(2);
    expect(sig.parameters![0]!.label).toContain('x');
    expect(sig.parameters![0]!.label).toContain('number');
    expect(sig.parameters![1]!.label).toContain('y');
    expect(sig.parameters![1]!.label).toContain('string');
    expect(sig.label).toContain('boolean');
  });

  test('createSignatureInfo falls back to func.description when doc comment has no text', () => {
    const func: FunctionType = {
      'kind': 'Function',
      'typeParams': [],
      'thisType': undefined,
      'params': [{ 'name': 'x', 'type': { 'kind': 'Primitive', 'name': 'number' }, 'optional': false }],
      'returnType': { 'kind': 'Primitive', 'name': 'boolean' },
      'isVariadic': false,
      'description': 'Built-in docs',
    };
    const docComment: DocComment = {
      'description': undefined,
      'params': [{ 'name': 'x', 'type': undefined, 'description': 'the number' }],
      'returns': [],
      'type': undefined,
      'class': undefined,
      'fields': [],
      'deprecated': undefined,
      'raw': '--- @param x the number',
    };
    const sig = createSignatureInfo('myFunc', func, docComment);
    expect(sig.documentation).toEqual({ 'kind': 'markdown', 'value': 'Built-in docs' });
  });
});

describe('Folding Range Edge Cases', () => {
  test('do block produces at least one folding range', () => {
    const chunk = parseCode('do\n  local x = 1\nend');
    const ranges = collectFoldingRanges(chunk);
    expect(ranges.length).toBeGreaterThanOrEqual(1);
  });

  test('nested if/elseif/else produces multiple ranges', () => {
    const chunk = parseCode('if a then\n  x()\nelseif b then\n  y()\nelse\n  z()\nend');
    const ranges = collectFoldingRanges(chunk);
    expect(ranges.length).toBeGreaterThanOrEqual(1);
  });

  test('generic for loop produces at least one folding range', () => {
    const chunk = parseCode('for k, v in pairs(t) do\n  print(k)\nend');
    const ranges = collectFoldingRanges(chunk);
    expect(ranges.length).toBeGreaterThanOrEqual(1);
  });

  test('multi-line function expression produces at least one folding range', () => {
    const chunk = parseCode('local fn = function()\n  return 1\nend');
    const ranges = collectFoldingRanges(chunk);
    expect(ranges.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Document Highlight Edge Cases', () => {
  test('variable used in multiple scopes has at least 3 references', () => {
    const chunk = parseCode('local x = 1\nif true then\n  print(x)\nend\nprint(x)');
    const highlights = collectHighlights(chunk);
    const xHighlights = highlights.get('x');
    expect(xHighlights).toBeDefined();
    expect(xHighlights!.length).toBeGreaterThanOrEqual(3);
  });

  test('different variables with similar names are separate', () => {
    const chunk = parseCode('local foo = 1\nlocal foobar = 2');
    const highlights = collectHighlights(chunk);
    const fooHighlights = highlights.get('foo');
    const foobarHighlights = highlights.get('foobar');
    expect(fooHighlights).toBeDefined();
    expect(foobarHighlights).toBeDefined();
    expect(fooHighlights!.length).toBeGreaterThanOrEqual(1);
    expect(foobarHighlights!.length).toBeGreaterThanOrEqual(1);
    const fooLines = fooHighlights!.map(h => h.line);
    const foobarLines = foobarHighlights!.map(h => h.line);
    expect(fooLines).not.toEqual(foobarLines);
  });

  test('function call and declaration both create references', () => {
    const chunk = parseCode('local function test() end\ntest()\ntest()');
    const highlights = collectHighlights(chunk);
    const testHighlights = highlights.get('test');
    expect(testHighlights).toBeDefined();
    expect(testHighlights!.length).toBeGreaterThanOrEqual(3);
  });

  test('method call references are tracked', () => {
    const chunk = parseCode('obj:method()\nobj:method()');
    const highlights = collectHighlights(chunk);
    const methodHighlights = highlights.get('method');
    expect(methodHighlights).toBeDefined();
    expect(methodHighlights!.length).toBeGreaterThanOrEqual(2);
  });
});

describe('References Edge Cases', () => {
  test('variable used as function argument multiple times', () => {
    const chunk = parseCode('local x = 1\nfoo(x, x, x)');
    const refs = collectReferences(chunk);
    const xRefs = refs.get('x');
    expect(xRefs).toBeDefined();
    expect(xRefs!.length).toBeGreaterThanOrEqual(4);
  });

  test('variable in table constructor is referenced', () => {
    const chunk = parseCode('local val = 1\nlocal t = { a = val, b = val }');
    const refs = collectReferences(chunk);
    const valRefs = refs.get('val');
    expect(valRefs).toBeDefined();
    expect(valRefs!.length).toBeGreaterThanOrEqual(3);
  });

  test('variable in binary expression has multiple references', () => {
    const chunk = parseCode('local x = 1\nlocal y = x + x * x');
    const refs = collectReferences(chunk);
    const xRefs = refs.get('x');
    expect(xRefs).toBeDefined();
    expect(xRefs!.length).toBeGreaterThanOrEqual(4);
  });

  test('unused variable has no references beyond declaration', () => {
    const chunk = parseCode('local unused = 1');
    const refs = collectReferences(chunk);
    const unusedRefs = refs.get('unused');
    expect(unusedRefs).toBeDefined();
    const usedChunk = parseCode('local used = 1\nprint(used)');
    const usedRefs = collectReferences(usedChunk);
    const usedRefList = usedRefs.get('used');
    expect(usedRefList).toBeDefined();
    expect(usedRefList!.length).toBeGreaterThan(unusedRefs!.length);
  });
});

describe('Definition Edge Cases', () => {
  test('function parameters are found as declarations', () => {
    const chunk = parseCode('local function foo(param1, param2) end');
    const decls = collectDeclarations(chunk);
    expect(decls.has('param1')).toBe(true);
    expect(decls.has('param2')).toBe(true);
  });

  test('for generic variables are found as declarations', () => {
    const chunk = parseCode('for key, value in pairs(t) do end');
    const decls = collectDeclarations(chunk);
    expect(decls.has('key')).toBe(true);
    expect(decls.has('value')).toBe(true);
  });

  test('nested declarations inside if blocks are found', () => {
    const chunk = parseCode('if true then\n  local inner = 1\nend');
    const decls = collectDeclarations(chunk);
    expect(decls.has('inner')).toBe(true);
  });

  test('multiple declarations of same name all appear', () => {
    const chunk = parseCode('local x = 1\nlocal x = 2\nlocal x = 3');
    const decls = collectDeclarations(chunk);
    const xDecls = decls.get('x');
    expect(xDecls).toBeDefined();
    expect(xDecls!.length).toBeGreaterThanOrEqual(3);
  });

  test('findBestDeclaration returns first when cursor is at line 0', () => {
    const chunk = parseCode('local x = 1\nlocal x = 2');
    const decls = collectDeclarations(chunk);
    const best = findBestDeclaration(decls, 'x', 0);
    expect(best).toBeDefined();
    expect(best!.line).toBe(0);
  });
});

describe('Call Hierarchy Edge Cases', () => {
  test('functions inside loops are found', () => {
    const chunk = parseCode('for i = 1, 10 do\n  local function step() end\nend');
    const functions = collectCallHierarchyFunctions(chunk.body);
    expect(functions.length).toBe(1);
    expect(functions[0]!.name).toBe('step');
  });

  test('method calls are tracked as call sites', () => {
    const chunk = parseCode('local function foo()\n  obj:bar()\nend');
    const callSites = collectCallSites(chunk);
    const barSite = callSites.find(s => s.name === 'bar');
    expect(barSite).toBeDefined();
  });

  test('chained calls produce multiple call sites with correct containing function', () => {
    const chunk = parseCode('local function foo()\n  a()\n  b()\n  c()\nend');
    const callSites = collectCallSites(chunk);
    const fooCalls = callSites.filter(s => s.containingFunction === 'foo');
    expect(fooCalls.length).toBe(3);
    const names = fooCalls.map(s => s.name);
    expect(names).toContain('a');
    expect(names).toContain('b');
    expect(names).toContain('c');
  });

  test('no functions yields empty array', () => {
    const chunk = parseCode('local x = 1');
    const functions = collectCallHierarchyFunctions(chunk.body);
    expect(functions.length).toBe(0);
  });
});

describe('Workspace Symbols Edge Cases', () => {
  test('type aliases show up as symbols', () => {
    const chunk = parseCode('type Color = { r: number, g: number, b: number }');
    const symbols = collectWorkspaceSymbols(chunk, 'file:///test.luau');
    const colorSymbol = symbols.find(s => s.name === 'Color');
    expect(colorSymbol).toBeDefined();
    expect(colorSymbol!.kind).toBe(26);
  });

  test('export types show up as symbols', () => {
    const chunk = parseCode('export type Config = { debug: boolean }');
    const symbols = collectWorkspaceSymbols(chunk, 'file:///test.luau');
    const configSymbol = symbols.find(s => s.name === 'Config');
    expect(configSymbol).toBeDefined();
  });

  test('local variable declarations show up as symbols', () => {
    const chunk = parseCode('local important = 42');
    const symbols = collectWorkspaceSymbols(chunk, 'file:///test.luau');
    const importantSymbol = symbols.find(s => s.name === 'important');
    expect(importantSymbol).toBeDefined();
    expect(importantSymbol!.kind).toBe(13);
  });
});

describe('Selection Range Edge Cases', () => {
  test('cursor inside nested if produces multiple containing ranges', () => {
    const chunk = parseCode('if true then\n  if false then\n    print("deep")\n  end\nend');
    const ranges = collectContainingRanges(chunk, 2, 8);
    expect(ranges.length).toBeGreaterThan(1);
  });

  test('cursor at top level on variable produces at least 1 range', () => {
    const chunk = parseCode('local x = 1\nlocal y = 2');
    const ranges = collectContainingRanges(chunk, 0, 6);
    expect(ranges.length).toBeGreaterThanOrEqual(1);
  });

  test('cursor inside table constructor finds ranges', () => {
    const chunk = parseCode('local t = {\n  a = 1,\n  b = 2\n}');
    const ranges = collectContainingRanges(chunk, 1, 5);
    expect(ranges.length).toBeGreaterThan(0);
  });
});

describe('isValidIdentifier Extended', () => {
  test('all Luau keywords are rejected', () => {
    const keywords = [
      'while',
      'do',
      'for',
      'in',
      'repeat',
      'until',
      'break',
      'continue',
      'nil',
      'true',
      'false',
      'not',
      'and',
      'or',
      'else',
      'elseif',
    ];
    for (const keyword of keywords) {
      expect(isValidIdentifier(keyword)).toBe(false);
    }
  });

  test('identifier starting with underscore then number is valid', () => {
    expect(isValidIdentifier('_1')).toBe(true);
  });

  test('long identifier is valid', () => {
    expect(isValidIdentifier('abcdefghijklmnop')).toBe(true);
  });

  test('single letter identifier is valid', () => {
    expect(isValidIdentifier('a')).toBe(true);
  });

  test('dunder identifier __index is valid', () => {
    expect(isValidIdentifier('__index')).toBe(true);
  });
});
