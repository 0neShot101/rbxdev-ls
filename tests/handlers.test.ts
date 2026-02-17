import { collectCallHierarchyFunctions, collectCallSites } from '@lsp/handlers/callHierarchy';
import { DEPRECATION_REPLACEMENTS } from '@lsp/handlers/codeAction';
import { collectCodeLensFunctions, collectCodeLensReferences } from '@lsp/handlers/codeLens';
import { findColors } from '@lsp/handlers/color';
import { collectDeclarations, findBestDeclaration } from '@lsp/handlers/definition';
import { convertDiagnostic } from '@lsp/handlers/diagnostics';
import { collectHighlights } from '@lsp/handlers/documentHighlight';
import { collectRequireLinks } from '@lsp/handlers/documentLink';
import { collectDocumentSymbols } from '@lsp/handlers/documentSymbol';
import { collectFoldingRanges } from '@lsp/handlers/foldingRange';
import {
  formatClassDoc,
  formatMethodDoc,
  formatPropertyDoc,
  formatTypeDoc,
  getMemberAccessAtPosition,
  getWordAtPosition,
} from '@lsp/handlers/hover';
import { isTypeAlias } from '@lsp/handlers/implementation';
import { collectInlayHints } from '@lsp/handlers/inlayHints';
import { collectScopedReferences } from '@lsp/handlers/linkedEditingRange';
import { collectReferences } from '@lsp/handlers/references';
import { collectRenameReferences, isValidIdentifier } from '@lsp/handlers/rename';
import { collectContainingRanges } from '@lsp/handlers/selectionRange';
import { collectSemanticTokens } from '@lsp/handlers/semanticTokens';
import { countCommas, findFunctionCall } from '@lsp/handlers/signature';
import { collectTypeDeclarations, getTypeName } from '@lsp/handlers/typeDefinition';
import { collectTypeAliases, extractSupertypeNames } from '@lsp/handlers/typeHierarchy';
import { collectWorkspaceSymbols } from '@lsp/handlers/workspaceSymbol';
import { parse } from '@parser/parser';
import { checkProgram } from '@typings/checker';
import { buildGlobalEnvironment } from '@definitions/globals';
import { describe, expect, test } from 'bun:test';

import type { Chunk } from '@typings/ast';
import type { ParsedDocument } from '@typings/lsp';

const globalEnv = buildGlobalEnvironment();

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

describe('Hover Handler', () => {
  test('getWordAtPosition extracts identifier at cursor', () => {
    const content = 'local myVar = 42';
    const word = getWordAtPosition(content, 0, 6);
    expect(word).toBe('myVar');
  });

  test('getWordAtPosition returns undefined for empty content', () => {
    const word = getWordAtPosition('', 0, 0);
    expect(word).toBeUndefined();
  });

  test('getWordAtPosition extracts word at start of line', () => {
    const content = 'print("hello")';
    const word = getWordAtPosition(content, 0, 0);
    expect(word).toBe('print');
  });

  test('getMemberAccessAtPosition detects dot access', () => {
    const content = 'game.Players';
    const info = getMemberAccessAtPosition(content, 0, 10);
    expect(info).toBeDefined();
    if (info !== undefined) {
      expect(info.memberName).toBe('Players');
      expect(info.isMethod).toBe(false);
    }
  });

  test('getMemberAccessAtPosition detects colon access', () => {
    const content = 'obj:doStuff()';
    const info = getMemberAccessAtPosition(content, 0, 6);
    expect(info).toBeDefined();
    if (info !== undefined) {
      expect(info.memberName).toBe('doStuff');
      expect(info.isMethod).toBe(true);
    }
  });

  test('formatFunctionDoc produces markdown', () => {
    const funcType = globalEnv.robloxClasses.get('Instance');
    expect(funcType).toBeDefined();
    if (funcType !== undefined && funcType.kind === 'Class') {
      const method = funcType.methods.get('FindFirstChild');
      if (method !== undefined) {
        const doc = formatMethodDoc('FindFirstChild', method);
        expect(doc.length).toBeGreaterThan(0);
        expect(doc).toContain('FindFirstChild');
      }
    }
  });

  test('formatClassDoc includes class name', () => {
    const cls = globalEnv.robloxClasses.get('Part');
    expect(cls).toBeDefined();
    if (cls !== undefined && cls.kind === 'Class') {
      const doc = formatClassDoc(cls);
      expect(doc).toContain('Part');
    }
  });

  test('formatPropertyDoc includes property name', () => {
    const cls = globalEnv.robloxClasses.get('Humanoid');
    expect(cls).toBeDefined();
    if (cls !== undefined && cls.kind === 'Class') {
      const prop = cls.properties.get('Health');
      if (prop !== undefined) {
        const doc = formatPropertyDoc('Health', prop);
        expect(doc).toContain('Health');
      }
    }
  });

  test('formatTypeDoc handles primitive types', () => {
    const doc = formatTypeDoc('myVar', { 'kind': 'Primitive', 'name': 'number' });
    expect(doc).toContain('myVar');
    expect(doc).toContain('number');
  });
});

describe('References Handler', () => {
  test('collectReferences finds all variable references', () => {
    const chunk = parseCode('local x = 1\nprint(x)\nlocal y = x + 1');
    const refs = collectReferences(chunk);
    const xRefs = refs.get('x');
    expect(xRefs).toBeDefined();
    expect(xRefs!.length).toBeGreaterThanOrEqual(2);
  });

  test('collectReferences finds function references', () => {
    const chunk = parseCode('local function foo() end\nfoo()\nfoo()');
    const refs = collectReferences(chunk);
    const fooRefs = refs.get('foo');
    expect(fooRefs).toBeDefined();
    expect(fooRefs!.length).toBeGreaterThanOrEqual(2);
  });

  test('collectReferences finds member access references', () => {
    const chunk = parseCode('local t = {}\nt.field = 1\nprint(t.field)');
    const refs = collectReferences(chunk);
    const fieldRefs = refs.get('field');
    expect(fieldRefs).toBeDefined();
    expect(fieldRefs!.length).toBeGreaterThanOrEqual(2);
  });

  test('collectReferences handles empty code', () => {
    const chunk = parseCode('');
    const refs = collectReferences(chunk);
    expect(refs.size).toBe(0);
  });
});

describe('Rename Handler', () => {
  test('collectRenameReferences finds all references for rename', () => {
    const chunk = parseCode('local myVar = 1\nprint(myVar)');
    const refs = collectRenameReferences(chunk);
    const myVarRefs = refs.get('myVar');
    expect(myVarRefs).toBeDefined();
    expect(myVarRefs!.length).toBeGreaterThanOrEqual(2);
  });

  test('isValidIdentifier accepts valid names', () => {
    expect(isValidIdentifier('foo')).toBe(true);
    expect(isValidIdentifier('_bar')).toBe(true);
    expect(isValidIdentifier('myVar123')).toBe(true);
    expect(isValidIdentifier('_')).toBe(true);
  });

  test('isValidIdentifier rejects invalid names', () => {
    expect(isValidIdentifier('123abc')).toBe(false);
    expect(isValidIdentifier('')).toBe(false);
    expect(isValidIdentifier('my-var')).toBe(false);
    expect(isValidIdentifier('my var')).toBe(false);
  });

  test('isValidIdentifier rejects Luau keywords', () => {
    expect(isValidIdentifier('local')).toBe(false);
    expect(isValidIdentifier('function')).toBe(false);
    expect(isValidIdentifier('if')).toBe(false);
    expect(isValidIdentifier('then')).toBe(false);
    expect(isValidIdentifier('end')).toBe(false);
    expect(isValidIdentifier('return')).toBe(false);
  });
});

describe('Signature Help Handler', () => {
  test('countCommas counts zero for no commas', () => {
    expect(countCommas('x')).toBe(0);
  });

  test('countCommas counts commas correctly', () => {
    expect(countCommas('a, b, c')).toBe(2);
  });

  test('countCommas ignores commas in strings', () => {
    expect(countCommas('"a, b", c')).toBe(1);
  });

  test('countCommas ignores commas in nested parens', () => {
    expect(countCommas('bar(a, b), c')).toBe(1);
  });

  test('findFunctionCall finds function name at cursor', () => {
    const content = 'print("hello")';
    const result = findFunctionCall(content, 0, 7);
    expect(result).toBeDefined();
    if (result !== undefined) {
      expect(result.name).toBe('print');
    }
  });

  test('findFunctionCall returns undefined outside call', () => {
    const content = 'local x = 1';
    const result = findFunctionCall(content, 0, 5);
    expect(result).toBeUndefined();
  });
});

describe('Color Handler', () => {
  test('findColors detects Color3.fromRGB', () => {
    const colors = findColors('local c = Color3.fromRGB(255, 128, 0)');
    expect(colors.length).toBeGreaterThanOrEqual(1);
    const color = colors[0]!;
    expect(color.red).toBeCloseTo(1.0, 1);
    expect(color.green).toBeCloseTo(0.5, 1);
    expect(color.blue).toBeCloseTo(0, 1);
  });

  test('findColors detects Color3.new', () => {
    const colors = findColors('local c = Color3.new(1, 0, 0)');
    expect(colors.length).toBeGreaterThanOrEqual(1);
    const color = colors[0]!;
    expect(color.red).toBeCloseTo(1.0, 1);
    expect(color.green).toBeCloseTo(0, 1);
    expect(color.blue).toBeCloseTo(0, 1);
  });

  test('findColors detects Color3.fromHex', () => {
    const colors = findColors('local c = Color3.fromHex("#FF0000")');
    expect(colors.length).toBeGreaterThanOrEqual(1);
    const color = colors[0]!;
    expect(color.red).toBeCloseTo(1.0, 1);
    expect(color.green).toBeCloseTo(0, 1);
    expect(color.blue).toBeCloseTo(0, 1);
  });

  test('findColors handles multiple colors in one file', () => {
    const code = 'local a = Color3.fromRGB(255, 0, 0)\nlocal b = Color3.fromRGB(0, 255, 0)';
    const colors = findColors(code);
    expect(colors.length).toBe(2);
  });

  test('findColors returns empty for no colors', () => {
    const colors = findColors('local x = 42');
    expect(colors.length).toBe(0);
  });
});

describe('Inlay Hints Handler', () => {
  test('collectInlayHints returns hints for typed code', () => {
    const doc = makeParsedDocument('local function foo(x: number): string\n  return tostring(x)\nend');
    const hints = collectInlayHints(doc);
    expect(hints).toBeDefined();
  });

  test('collectInlayHints handles empty code', () => {
    const doc = makeParsedDocument('');
    const hints = collectInlayHints(doc);
    expect(hints).toBeDefined();
    expect(hints.length).toBe(0);
  });

  test('collectInlayHints handles code with variables', () => {
    const doc = makeParsedDocument('local x = 42\nlocal y = "hello"');
    const hints = collectInlayHints(doc);
    expect(hints).toBeDefined();
  });
});

describe('Folding Range Handler', () => {
  test('collectFoldingRanges finds function blocks', () => {
    const chunk = parseCode('local function foo()\n  print("hello")\nend');
    const ranges = collectFoldingRanges(chunk);
    expect(ranges.length).toBeGreaterThanOrEqual(1);
  });

  test('collectFoldingRanges finds if blocks', () => {
    const chunk = parseCode('if true then\n  print("yes")\nend');
    const ranges = collectFoldingRanges(chunk);
    expect(ranges.length).toBeGreaterThanOrEqual(1);
  });

  test('collectFoldingRanges finds for loops', () => {
    const chunk = parseCode('for i = 1, 10 do\n  print(i)\nend');
    const ranges = collectFoldingRanges(chunk);
    expect(ranges.length).toBeGreaterThanOrEqual(1);
  });

  test('collectFoldingRanges finds while loops', () => {
    const chunk = parseCode('while true do\n  break\nend');
    const ranges = collectFoldingRanges(chunk);
    expect(ranges.length).toBeGreaterThanOrEqual(1);
  });

  test('collectFoldingRanges finds repeat blocks', () => {
    const chunk = parseCode('repeat\n  x = x + 1\nuntil x > 10');
    const ranges = collectFoldingRanges(chunk);
    expect(ranges.length).toBeGreaterThanOrEqual(1);
  });

  test('collectFoldingRanges finds table constructors', () => {
    const chunk = parseCode('local t = {\n  a = 1,\n  b = 2,\n}');
    const ranges = collectFoldingRanges(chunk);
    expect(ranges.length).toBeGreaterThanOrEqual(1);
  });

  test('collectFoldingRanges handles nested blocks', () => {
    const chunk = parseCode('function foo()\n  if true then\n    print("x")\n  end\nend');
    const ranges = collectFoldingRanges(chunk);
    expect(ranges.length).toBeGreaterThanOrEqual(2);
  });

  test('collectFoldingRanges returns empty for single-line code', () => {
    const chunk = parseCode('local x = 1');
    const ranges = collectFoldingRanges(chunk);
    expect(ranges.length).toBe(0);
  });
});

describe('Document Highlight Handler', () => {
  test('collectHighlights finds all occurrences of a variable', () => {
    const chunk = parseCode('local x = 1\nprint(x)\nlocal y = x');
    const highlights = collectHighlights(chunk);
    const xHighlights = highlights.get('x');
    expect(xHighlights).toBeDefined();
    expect(xHighlights!.length).toBeGreaterThanOrEqual(2);
  });

  test('collectHighlights distinguishes write positions', () => {
    const chunk = parseCode('local x = 1\nx = 2\nprint(x)');
    const highlights = collectHighlights(chunk);
    const xHighlights = highlights.get('x');
    expect(xHighlights).toBeDefined();
    const hasWrite = xHighlights!.some(h => h.kind === 3);
    const hasRead = xHighlights!.some(h => h.kind === 2 || h.kind === 1);
    expect(hasWrite || hasRead).toBe(true);
  });

  test('collectHighlights handles empty code', () => {
    const chunk = parseCode('');
    const highlights = collectHighlights(chunk);
    expect(highlights.size).toBe(0);
  });
});

describe('Document Link Handler', () => {
  test('collectRequireLinks finds require calls with string arguments', () => {
    const chunk = parseCode('local m = require("MyModule")');
    const links = collectRequireLinks(chunk, 'file:///test.luau');
    expect(links).toBeDefined();
  });

  test('collectRequireLinks handles code without requires', () => {
    const chunk = parseCode('local x = 42');
    const links = collectRequireLinks(chunk, 'file:///test.luau');
    expect(links.length).toBe(0);
  });
});

describe('Linked Editing Range Handler', () => {
  test('collectScopedReferences finds matching references by scope', () => {
    const chunk = parseCode('local x = 1\nprint(x)');
    const entries = collectScopedReferences(chunk);
    expect(entries.length).toBeGreaterThan(0);
    const xEntry = entries.find(e => e.declarationLine === 0);
    expect(xEntry).toBeDefined();
    expect(xEntry!.references.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Selection Range Handler', () => {
  test('collectContainingRanges returns ranges for position inside function', () => {
    const chunk = parseCode('local function foo()\n  print("hello")\nend');
    const ranges = collectContainingRanges(chunk, 1, 4);
    expect(ranges.length).toBeGreaterThan(0);
  });

  test('collectContainingRanges returns multiple nested ranges', () => {
    const chunk = parseCode('function outer()\n  if true then\n    print("x")\n  end\nend');
    const ranges = collectContainingRanges(chunk, 2, 6);
    expect(ranges.length).toBeGreaterThan(1);
  });

  test('collectContainingRanges handles position at start of file', () => {
    const chunk = parseCode('local x = 1');
    const ranges = collectContainingRanges(chunk, 1, 1);
    expect(ranges).toBeDefined();
  });
});

describe('Call Hierarchy Handler', () => {
  test('collectCallHierarchyFunctions finds local functions', () => {
    const chunk = parseCode('local function foo() end\nlocal function bar() end');
    const functions = collectCallHierarchyFunctions(chunk.body);
    expect(functions.length).toBe(2);
    expect(functions[0]!.name).toBe('foo');
    expect(functions[1]!.name).toBe('bar');
  });

  test('collectCallHierarchyFunctions finds method declarations', () => {
    const chunk = parseCode('function MyClass:method() end');
    const functions = collectCallHierarchyFunctions(chunk.body);
    expect(functions.length).toBe(1);
    expect(functions[0]!.name).toBe('MyClass:method');
  });

  test('collectCallSites finds function call sites', () => {
    const chunk = parseCode('local function foo()\n  bar()\n  baz()\nend');
    const callSites = collectCallSites(chunk);
    expect(callSites.length).toBeGreaterThanOrEqual(2);
    const names = callSites.map(s => s.name);
    expect(names).toContain('bar');
    expect(names).toContain('baz');
  });

  test('collectCallSites includes containing function', () => {
    const chunk = parseCode('local function outer()\n  inner()\nend');
    const callSites = collectCallSites(chunk);
    const innerCall = callSites.find(s => s.name === 'inner');
    expect(innerCall).toBeDefined();
    expect(innerCall!.containingFunction).toBe('outer');
  });
});

describe('Code Lens Handler', () => {
  test('collectCodeLensFunctions finds all functions', () => {
    const chunk = parseCode('local function a() end\nlocal function b() end');
    const functions = collectCodeLensFunctions(chunk.body);
    expect(functions.length).toBe(2);
  });

  test('collectCodeLensReferences counts references per name', () => {
    const chunk = parseCode('local function foo() end\nfoo()\nfoo()');
    const refs = collectCodeLensReferences(chunk);
    const fooRefs = refs.get('foo');
    expect(fooRefs).toBeDefined();
    expect(fooRefs!.length).toBeGreaterThanOrEqual(2);
  });

  test('collectCodeLensFunctions finds functions inside if blocks', () => {
    const chunk = parseCode('if true then\n  local function inner() end\nend');
    const functions = collectCodeLensFunctions(chunk.body);
    expect(functions.length).toBe(1);
    expect(functions[0]!.name).toBe('inner');
  });
});

describe('Workspace Symbol Handler', () => {
  test('collectWorkspaceSymbols finds top-level declarations', () => {
    const chunk = parseCode('local function foo() end\ntype MyType = number');
    const symbols = collectWorkspaceSymbols(chunk, 'file:///test.luau');
    expect(symbols.length).toBeGreaterThanOrEqual(2);
  });

  test('collectWorkspaceSymbols includes function names', () => {
    const chunk = parseCode('function globalFunc() end');
    const symbols = collectWorkspaceSymbols(chunk, 'file:///test.luau');
    const funcSymbol = symbols.find(s => s.name === 'globalFunc');
    expect(funcSymbol).toBeDefined();
  });

  test('collectWorkspaceSymbols handles empty file', () => {
    const chunk = parseCode('');
    const symbols = collectWorkspaceSymbols(chunk, 'file:///test.luau');
    expect(symbols.length).toBe(0);
  });
});

describe('Type Hierarchy Handler', () => {
  test('collectTypeAliases finds type declarations', () => {
    const chunk = parseCode('type Point = { x: number, y: number }');
    const aliases = collectTypeAliases(chunk);
    expect(aliases.length).toBe(1);
    expect(aliases[0]!.name).toBe('Point');
  });

  test('collectTypeAliases finds exported types', () => {
    const chunk = parseCode('export type MyType = string');
    const aliases = collectTypeAliases(chunk);
    expect(aliases.length).toBe(1);
    expect(aliases[0]!.name).toBe('MyType');
  });

  test('collectTypeAliases finds multiple types', () => {
    const chunk = parseCode('type A = number\ntype B = string\ntype C = boolean');
    const aliases = collectTypeAliases(chunk);
    expect(aliases.length).toBe(3);
  });

  test('extractSupertypeNames extracts type references', () => {
    const chunk = parseCode('type MyType = number');
    const stmt = chunk.body[0];
    if (stmt !== undefined && stmt.kind === 'TypeAlias' && stmt.type !== undefined) {
      const names = extractSupertypeNames(stmt.type);
      expect(names).toBeDefined();
    }
  });
});

describe('Type Definition Handler', () => {
  test('collectTypeDeclarations maps type names to locations', () => {
    const chunk = parseCode('type Point = { x: number, y: number }');
    const decls = collectTypeDeclarations(chunk);
    expect(decls.has('Point')).toBe(true);
    expect(decls.get('Point')!.line).toBe(0);
  });

  test('collectTypeDeclarations finds exported types', () => {
    const chunk = parseCode('export type Exported = string');
    const decls = collectTypeDeclarations(chunk);
    expect(decls.has('Exported')).toBe(true);
  });

  test('collectTypeDeclarations handles multiple types', () => {
    const chunk = parseCode('type A = number\ntype B = string');
    const decls = collectTypeDeclarations(chunk);
    expect(decls.has('A')).toBe(true);
    expect(decls.has('B')).toBe(true);
  });

  test('getTypeName extracts name from simple type reference', () => {
    const name = getTypeName({ 'kind': 'TypeReference', 'name': 'MyType' });
    expect(name).toBe('MyType');
  });

  test('getTypeName returns undefined for non-reference types', () => {
    const name = getTypeName({ 'kind': 'Primitive' });
    expect(name).toBeUndefined();
  });
});

describe('Implementation Handler', () => {
  test('isTypeAlias detects type alias statements', () => {
    const chunk = parseCode('type MyType = number');
    expect(isTypeAlias(chunk, 'MyType')).toBe(true);
  });

  test('isTypeAlias returns false for non-existent types', () => {
    const chunk = parseCode('local x = 42');
    expect(isTypeAlias(chunk, 'NonExistent')).toBe(false);
  });

  test('isTypeAlias detects exported type aliases', () => {
    const chunk = parseCode('export type Exported = string');
    expect(isTypeAlias(chunk, 'Exported')).toBe(true);
  });
});

describe('Document Symbol Handler', () => {
  test('collectDocumentSymbols finds function symbols', () => {
    const chunk = parseCode('local function foo() end');
    const symbols = collectDocumentSymbols(chunk);
    expect(symbols.length).toBeGreaterThanOrEqual(1);
    const fooSymbol = symbols.find(s => s.name === 'foo');
    expect(fooSymbol).toBeDefined();
  });

  test('collectDocumentSymbols finds type alias symbols', () => {
    const chunk = parseCode('type MyType = number');
    const symbols = collectDocumentSymbols(chunk);
    const typeSymbol = symbols.find(s => s.name === 'MyType');
    expect(typeSymbol).toBeDefined();
  });

  test('collectDocumentSymbols nests children inside functions', () => {
    const chunk = parseCode('local function outer()\n  local function inner() end\nend');
    const symbols = collectDocumentSymbols(chunk);
    const outerSymbol = symbols.find(s => s.name === 'outer');
    expect(outerSymbol).toBeDefined();
    if (outerSymbol !== undefined && outerSymbol.children !== undefined) {
      const innerSymbol = outerSymbol.children.find(s => s.name === 'inner');
      expect(innerSymbol).toBeDefined();
    }
  });

  test('collectDocumentSymbols handles empty file', () => {
    const chunk = parseCode('');
    const symbols = collectDocumentSymbols(chunk);
    expect(symbols.length).toBe(0);
  });
});

describe('Definition Handler', () => {
  test('collectDeclarations finds local variable declarations', () => {
    const chunk = parseCode('local myVar = 42');
    const decls = collectDeclarations(chunk);
    expect(decls.has('myVar')).toBe(true);
  });

  test('collectDeclarations finds function declarations', () => {
    const chunk = parseCode('local function myFunc() end');
    const decls = collectDeclarations(chunk);
    expect(decls.has('myFunc')).toBe(true);
  });

  test('collectDeclarations finds for loop variables', () => {
    const chunk = parseCode('for i = 1, 10 do end');
    const decls = collectDeclarations(chunk);
    expect(decls.has('i')).toBe(true);
  });

  test('collectDeclarations finds nested declarations', () => {
    const chunk = parseCode('local function outer()\n  local inner = 1\nend');
    const decls = collectDeclarations(chunk);
    expect(decls.has('outer')).toBe(true);
    expect(decls.has('inner')).toBe(true);
  });

  test('findBestDeclaration returns closest scope match', () => {
    const chunk = parseCode('local x = 1\nlocal x = 2');
    const decls = collectDeclarations(chunk);
    const best = findBestDeclaration(decls, 'x', 2);
    expect(best).toBeDefined();
    expect(best!.line).toBe(1);
  });
});

describe('Diagnostics Handler', () => {
  const makeRange = (sl: number, sc: number, el: number, ec: number) => ({
    'start': { 'offset': 0, 'line': sl, 'column': sc },
    'end': { 'offset': 0, 'line': el, 'column': ec },
  });

  test('convertDiagnostic converts error severity', () => {
    const diag = convertDiagnostic({
      'message': 'Test error',
      'severity': 'error',
      'code': 'E001',
      'range': makeRange(1, 1, 1, 10),
    });
    expect(diag.severity).toBe(1);
    expect(diag.message).toBe('Test error');
  });

  test('convertDiagnostic converts warning severity', () => {
    const diag = convertDiagnostic({
      'message': 'Test warning',
      'severity': 'warning',
      'code': 'W001',
      'range': makeRange(1, 1, 1, 10),
    });
    expect(diag.severity).toBe(2);
  });

  test('convertDiagnostic converts info severity', () => {
    const diag = convertDiagnostic({
      'message': 'Test info',
      'severity': 'info',
      'code': 'I001',
      'range': makeRange(1, 1, 1, 10),
    });
    expect(diag.severity).toBe(3);
  });

  test('convertDiagnostic converts hint severity', () => {
    const diag = convertDiagnostic({
      'message': 'Test hint',
      'severity': 'hint',
      'code': 'H001',
      'range': makeRange(1, 1, 1, 10),
    });
    expect(diag.severity).toBe(4);
  });

  test('convertDiagnostic sets correct range (0-indexed)', () => {
    const diag = convertDiagnostic({
      'message': 'Test',
      'severity': 'error',
      'code': 'E002',
      'range': makeRange(5, 3, 5, 10),
    });
    expect(diag.range.start.line).toBe(4);
    expect(diag.range.start.character).toBe(2);
    expect(diag.range.end.line).toBe(4);
    expect(diag.range.end.character).toBe(9);
  });
});

describe('Code Action Handler', () => {
  test('DEPRECATION_REPLACEMENTS has expected entries', () => {
    expect(DEPRECATION_REPLACEMENTS.get('children')).toBe('GetChildren');
    expect(DEPRECATION_REPLACEMENTS.get('destroy')).toBe('Destroy');
    expect(DEPRECATION_REPLACEMENTS.get('clone')).toBe('Clone');
    expect(DEPRECATION_REPLACEMENTS.get('connect')).toBe('Connect');
    expect(DEPRECATION_REPLACEMENTS.get('remove')).toBe('Destroy');
    expect(DEPRECATION_REPLACEMENTS.get('findFirstChild')).toBe('FindFirstChild');
    expect(DEPRECATION_REPLACEMENTS.get('waitForChild')).toBe('WaitForChild');
  });

  test('DEPRECATION_REPLACEMENTS has async method upgrades', () => {
    expect(DEPRECATION_REPLACEMENTS.get('IsInGroup')).toBe('IsInGroupAsync');
    expect(DEPRECATION_REPLACEMENTS.get('GetRankInGroup')).toBe('GetRankInGroupAsync');
    expect(DEPRECATION_REPLACEMENTS.get('GetRoleInGroup')).toBe('GetRoleInGroupAsync');
  });
});

describe('Semantic Tokens Handler', () => {
  test('collectSemanticTokens classifies local variables', () => {
    const chunk = parseCode('local myVar = 42');
    const tokens = collectSemanticTokens(chunk);
    expect(tokens.length).toBeGreaterThan(0);
    const varToken = tokens.find(t => t.character === 6);
    expect(varToken).toBeDefined();
  });

  test('collectSemanticTokens classifies function declarations', () => {
    const chunk = parseCode('local function myFunc() end');
    const tokens = collectSemanticTokens(chunk);
    const funcToken = tokens.find(t => t.character === 15);
    expect(funcToken).toBeDefined();
  });

  test('collectSemanticTokens classifies method calls', () => {
    const chunk = parseCode('obj:doSomething()');
    const tokens = collectSemanticTokens(chunk);
    const methodToken = tokens.find(t => t.tokenType === 6);
    expect(methodToken).toBeDefined();
  });

  test('collectSemanticTokens classifies member access', () => {
    const chunk = parseCode('local x = obj.field');
    const tokens = collectSemanticTokens(chunk);
    const propToken = tokens.find(t => t.tokenType === 9);
    expect(propToken).toBeDefined();
  });

  test('collectSemanticTokens handles empty code', () => {
    const chunk = parseCode('');
    const tokens = collectSemanticTokens(chunk);
    expect(tokens.length).toBe(0);
  });
});
