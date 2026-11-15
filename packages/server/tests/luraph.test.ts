import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { CompletionItemTag, MarkupContent } from 'vscode-languageserver';

import { checkProgram } from '@analyzer/checker';
import { typeToString } from '@analyzer/values';
import { createExecutorBridge } from '@executor/server';
import { createDocumentManager } from '@lsp/documents';
import { setupCompletionHandler } from '@lsp/handlers/completion';
import { setupHoverHandler } from '@lsp/handlers/hover';
import { setupSignatureHelpHandler } from '@lsp/handlers/signature';
import { parse } from '@parser/parser';
import { createLspHarness } from '@tests/helpers/lsp';

import type { Position } from 'vscode-languageserver';

const manager = createDocumentManager({ 'roblox': undefined, 'sunc': undefined });
const bridge = createExecutorBridge(() => undefined);
const harness = createLspHarness(manager);

setupCompletionHandler(harness.connection, harness.documents, manager, bridge);
setupHoverHandler(harness.connection, manager, bridge);
setupSignatureHelpHandler(harness.connection, manager);

beforeAll(() => harness.start());
afterAll(() => harness.dispose());

const hoverText = async (source: string, word: string): Promise<string> => {
  const uri = await harness.open(source);
  const hover = await harness.hover(uri, { 'line': 0, 'character': source.indexOf(word) + 1 });

  if (hover === null || MarkupContent.is(hover.contents) === false) throw new Error('Expected markdown hover');
  return hover.contents.value;
};

describe('Luraph v14 and v15 definitions', () => {
  test('registers v15 macros, aliases, attributes, and all existing v14 wrappers', () => {
    const symbols = manager.globalEnv.env.globalScope.symbols;

    for (const name of [
      'LPH_ASSUME',
      'LPH_OPAQUE',
      'LPH_ENCSTR',
      'LPH_STRENC',
      'LPH_ENCBUF',
      'LPH_BUFENC',
      'LPH_ENCNUM',
      'LPH_NUMENC',
      'LPH_CRASH',
      'LPH_STACKALLOC',
      'LPH_PRECHECK',
      'LPH_REWRITE',
      'LPH_OBFUSCATED',
      'LPH_LINE',
      'LPH_ATTRIBUTES',
      'ENCRYPT',
      'VM',
      'PRESET',
      'OPTIMIZE',
      'TRANSFORM',
      'EXTRACT',
      'ERROR_HANDLING',
      'INLINE',
      'UNROLL',
      'NO_UPVALUES',
      'NONE',
      'OPAL',
      'ONYX',
      'FAST',
      'BALANCED',
      'SECURE',
      'GLOBALS',
      'CONSTANTS',
      'CONTROL_FLOW',
      'REWRITE_NAMECALLS',
      'LPH_ENCFUNC',
      'LPH_FUNCENC',
      'LPH_JIT',
      'LPH_JIT_MAX',
      'LPH_NO_VIRTUALIZE',
      'LPH_NO_UPVALUES',
    ])
      expect(symbols.has(name)).toBe(true);

    for (const [name, alias] of [
      ['LPH_ENCSTR', 'LPH_STRENC'],
      ['LPH_ENCBUF', 'LPH_BUFENC'],
      ['LPH_ENCNUM', 'LPH_NUMENC'],
      ['LPH_ENCFUNC', 'LPH_FUNCENC'],
    ]) {
      if (name === undefined || alias === undefined) throw new Error('Missing alias pair');
      expect(symbols.get(name)?.type).toEqual(symbols.get(alias)?.type);
    }
  });

  test('infers macro results and stack proxy properties without executing the obfuscator', () => {
    const source = `
local assumed = LPH_ASSUME(7, 7)
local predicate = LPH_OPAQUE(true)

local text = LPH_ENCSTR('value')
local encrypted = LPH_STRENC('value', 1234, 1234)
local bytes = LPH_ENCBUF('value')
local aliasBytes = LPH_BUFENC('value', 1234, 1234)
local number = LPH_ENCNUM(7, { [7] = 7 })
local aliasNumber = LPH_NUMENC(7)

local rewritten = LPH_REWRITE(assumed + number, { preset = 'FAST', budget = 'small' })
local stack = LPH_STACKALLOC(8, 0)
stack[0] = 7

local packed = stack:pack()
local count = packed.n
stack:clear()

LPH_PRECHECK(function()
  return { 1, 2 }
end, { 1, 2 })

local function plain()
  LPH_ATTRIBUTES(VM(NONE), TRANSFORM(EXTRACT(GLOBALS, CONSTANTS), CONTROL_FLOW, REWRITE_NAMECALLS))
end

local function virtualized()
  LPH_ATTRIBUTES(VM(ONYX), PRESET(SECURE), ERROR_HANDLING(false), INLINE(false), NO_UPVALUES)
end

for index = 1, 3 do
  LPH_ATTRIBUTES(UNROLL(false))
  print(index)
end
`;
    const parsed = parse(source);
    expect(parsed.errors).toEqual([]);

    const result = checkProgram(parsed.ast, { 'globals': manager.globalEnv, 'mode': 'strict' });
    expect(result.diagnostics.filter(diagnostic => diagnostic.severity === 'error')).toEqual([]);

    for (const [name, expected] of [
      ['assumed', 'number'],
      ['predicate', 'boolean'],
      ['text', 'string'],
      ['encrypted', 'string'],
      ['bytes', 'buffer'],
      ['aliasBytes', 'buffer'],
      ['number', 'number'],
      ['aliasNumber', 'number'],
      ['rewritten', 'number'],
      ['count', 'number'],
    ]) {
      if (name === undefined || expected === undefined) throw new Error('Missing expected local type');
      const type = result.allSymbols.get(name);
      expect(type === undefined ? 'missing' : typeToString(type)).toBe(expected);
    }
  });

  test('keeps v14 calls accepted and explains v15-only deprecations', () => {
    const parsed = parse(`
local encrypted = LPH_FUNCENC(function() end, 'key', 'runtime key')
local fast = LPH_JIT(function() end)
local faster = LPH_JIT_MAX(function() end)
local plain = LPH_NO_VIRTUALIZE(function() end)
local wrapped = LPH_NO_UPVALUES(function() end)
`);
    expect(parsed.errors).toEqual([]);
    const result = checkProgram(parsed.ast, { 'globals': manager.globalEnv, 'mode': 'strict' });
    expect(result.diagnostics.filter(diagnostic => diagnostic.severity === 'error')).toEqual([]);

    for (const name of [
      'LPH_ENCFUNC',
      'LPH_FUNCENC',
      'LPH_JIT',
      'LPH_JIT_MAX',
      'LPH_NO_VIRTUALIZE',
      'LPH_NO_UPVALUES',
    ]) {
      const deprecated = manager.globalEnv.env.globalScope.symbols.get(name)?.docComment?.deprecated;
      expect(deprecated).toContain('v15 usage only');
      expect(deprecated).toContain('still supported in v14');
    }

    expect(manager.globalEnv.env.globalScope.symbols.get('LPH_ENCSTR')?.docComment?.deprecated).toBeUndefined();
  });

  test('completion lists contain current macros and explicit legacy deprecation tags', async () => {
    const uri = await harness.open('LPH_');
    const completion = await harness.complete(uri, { 'line': 0, 'character': 4 });

    for (const name of ['LPH_ASSUME', 'LPH_ENCBUF', 'LPH_ATTRIBUTES', 'LPH_STACKALLOC', 'LPH_REWRITE'])
      expect(completion.items.some(item => item.label === name)).toBe(true);

    const legacy = completion.items.find(item => item.label === 'LPH_FUNCENC');
    expect(legacy?.tags).toContain(CompletionItemTag.Deprecated);
    expect(completion.items.find(item => item.label === 'LPH_ENCBUF')?.tags).toBeUndefined();

    if (legacy === undefined) throw new Error('Missing v14 alias completion');
    const resolved = await harness.resolve(legacy);
    expect(resolved.documentation).toMatchObject({
      'kind': 'markdown',
      'value': expect.stringContaining('still supported in v14'),
    });

    const attributeUri = await harness.open('PRE');
    const attributes = await harness.complete(attributeUri, { 'line': 0, 'character': 3 });
    expect(attributes.items.some(item => item.label === 'PRESET')).toBe(true);

    const stackUri = await harness.open('local values = LPH_STACKALLOC(8)\nvalues:');
    const methods = await harness.complete(stackUri, { 'line': 1, 'character': 7 });

    for (const name of ['pack', 'unpack', 'clear']) expect(methods.items.some(item => item.label === name)).toBe(true);
  });

  test('hover explains attribute tokens, new macros, and v14 migration notes', async () => {
    expect(await hoverText("LPH_ENCBUF('value')", 'LPH_ENCBUF')).toContain('Luau targets only');
    expect(await hoverText('LPH_ATTRIBUTES(VM(NONE))', 'NONE')).toContain('non-virtualized');
    expect(await hoverText('LPH_ATTRIBUTES(VM(ONYX))', 'VM')).toContain('OPAL');
    expect(await hoverText('LPH_JIT(function() end)', 'LPH_JIT')).toContain('still supported in v14');
  });

  test('signature help includes optional v15 parameters and deprecated v14 guidance', async () => {
    const source = "LPH_ENCSTR('value', ";
    const uri = await harness.open(source);
    const signature = await harness.signature(uri, { 'line': 0, 'character': source.length });

    expect(signature?.activeParameter).toBe(1);
    expect(signature?.signatures[0]?.label).toContain('key?');
    expect(signature?.signatures[0]?.label).toContain('expression?');
    expect(signature?.signatures[0]?.documentation).toMatchObject({
      'kind': 'markdown',
      'value': expect.stringContaining('v14 accepts one argument only'),
    });

    const legacySource = 'LPH_FUNCENC(';
    const legacyUri = await harness.open(legacySource);
    const legacy = await harness.signature(legacyUri, { 'line': 0, 'character': legacySource.length });
    expect(legacy?.signatures[0]?.documentation).toMatchObject({
      'kind': 'markdown',
      'value': expect.stringContaining('**@deprecated**'),
    });
  });
});

test('stack unpack results remain usable as scalar values', () => {
  const parsed = parse(`
local values = LPH_STACKALLOC(1)
values[1] = 7

local first: number = values:unpack()
local inferred = values:unpack()
local sum = inferred + 1
`);

  expect(parsed.errors).toEqual([]);
  const result = checkProgram(parsed.ast, { 'globals': manager.globalEnv, 'mode': 'strict' });
  expect(result.diagnostics.filter(diagnostic => diagnostic.severity === 'error')).toEqual([]);
});

test('local VM functions take precedence over attribute globals in editor features', async () => {
  const source = `local function VM(path: string): string
  return path
end

VM('module')
`;
  const hover = await hoverText(source, 'VM');
  expect(hover).toContain('path: string');
  expect(hover).not.toContain('OPAL');

  const signatureSource = source + 'VM(';
  const signatureUri = await harness.open(signatureSource);
  const signature = await harness.signature(signatureUri, { 'line': 5, 'character': 3 });
  expect(signature?.signatures[0]?.label).toContain('path: string');
  expect(signature?.signatures[0]?.label).not.toContain('type: any');

  const completionUri = await harness.open(source + 'VM');
  const completion = await harness.complete(completionUri, { 'line': 5, 'character': 2 });
  const matches = completion.items.filter(item => item.label === 'VM');
  expect(matches).toHaveLength(1);
  expect(matches[0]?.insertText).toContain('path');
});

const positionOf = (source: string, marker: string, advance = 1): Position => {
  const start = source.indexOf(marker);
  if (start < 0) throw new Error('Missing source marker');

  const lines = source.slice(0, start + advance).split('\n');
  return { 'line': lines.length - 1, 'character': lines[lines.length - 1]?.length ?? 0 };
};

test('nested local attributes use their lexical binding only after declaration and inside scope', async () => {
  const source = `local function outer()
  VM(NONE)

  local function VM(path: string): string
    return path
  end

  VM('nested')
end

VM(ONYX)
`;
  const uri = await harness.open(source);

  for (const [marker, local] of [
    ['VM(NONE)', false],
    ["VM('nested')", true],
    ['VM(ONYX)', false],
  ] as const) {
    const hover = await harness.hover(uri, positionOf(source, marker));
    if (hover === null || MarkupContent.is(hover.contents) === false) throw new Error('Missing scoped hover');

    expect(hover.contents.value.includes('path: string')).toBe(local);
    expect(hover.contents.value.includes('OPAL')).toBe(local === false);

    const signature = await harness.signature(uri, positionOf(source, marker, 3));
    expect(signature?.signatures[0]?.label.includes('path: string')).toBe(local);

    const completion = await harness.complete(uri, positionOf(source, marker, 2));
    const matches = completion.items.filter(item => item.label === 'VM');
    expect(matches).toHaveLength(1);
    expect(matches[0]?.insertText?.includes('path')).toBe(local);
  }
});

test('do-block redeclarations retain the correct type at each use', async () => {
  const source = `do
  local VM = function(first: string): string
    return first
  end

  VM('first')

  local VM = function(second: number): number
    return second
  end

  VM(7)
end

VM(NONE)
`;
  const uri = await harness.open(source);

  const first = await harness.signature(uri, positionOf(source, "VM('first')", 3));
  const second = await harness.signature(uri, positionOf(source, 'VM(7)', 3));
  const outside = await harness.signature(uri, positionOf(source, 'VM(NONE)', 3));

  expect(first?.signatures[0]?.label).toContain('first: string');
  expect(second?.signatures[0]?.label).toContain('second: number');
  expect(outside?.signatures[0]?.label).toContain('type: any');
});

test('function parameters and sibling conditional branches do not leak local attribute bindings', async () => {
  const source = `local function run(VM: (value: number) -> number)
  VM(5)
end

if true then
  local function VM(branch: string): string
    return branch
  end

  VM('branch')
else
  VM(NONE)
end

VM(ONYX)
`;
  const uri = await harness.open(source);
  const parameter = await harness.signature(uri, positionOf(source, 'VM(5)', 3));
  const branch = await harness.signature(uri, positionOf(source, "VM('branch')", 3));
  const sibling = await harness.signature(uri, positionOf(source, 'VM(NONE)', 3));
  const outside = await harness.signature(uri, positionOf(source, 'VM(ONYX)', 3));

  expect(parameter?.signatures[0]?.label).toContain('value: number');
  expect(branch?.signatures[0]?.label).toContain('branch: string');
  expect(sibling?.signatures[0]?.label).toContain('type: any');
  expect(outside?.signatures[0]?.label).toContain('type: any');

  const boundary = await harness.hover(uri, positionOf(source, 'VM(NONE)', 0));
  if (boundary === null || MarkupContent.is(boundary.contents) === false)
    throw new Error('Missing branch-boundary hover');
  expect(boundary.contents.value).toContain('OPAL');
});

test('unfinished functions still resolve nested locals at the end-of-file insertion point', async () => {
  const source = `local function outer()
  local function VM(path: string): string
    return path
  end

  VM(`;
  const uri = await harness.open(source);
  const signature = await harness.signature(uri, positionOf(source, '  VM(', 5));

  expect(signature?.signatures[0]?.label).toContain('path: string');
});

test('global function declarations inside an installer remain visible after installation', async () => {
  const source = `local function install()
  function VM(value: string): string
    return value
  end
end

install()
VM('installed')
`;
  const uri = await harness.open(source);
  const signature = await harness.signature(uri, positionOf(source, "VM('installed')", 3));

  expect(signature?.signatures[0]?.label).toContain('value: string');
});

test('loop variables complete in empty bodies but not their iterator expressions', async () => {
  for (const source of ['for index = 1, 3 do\n  \nend', 'for index in pairs({}) do\n  \nend']) {
    const uri = await harness.open(source);
    const body = await harness.complete(uri, { 'line': 1, 'character': 2 });
    expect(body.items.some(item => item.label === 'index')).toBe(true);

    const header = await harness.complete(uri, { 'line': 0, 'character': source.indexOf(' do') });
    expect(header.items.some(item => item.label === 'index')).toBe(false);
  }
});

test('then locals are excluded from blank lines in empty else bodies', async () => {
  const source = `if true then
  local function VM(path: string): string
    return path
  end
else
  
end`;
  const uri = await harness.open(source);
  const completion = await harness.complete(uri, { 'line': 5, 'character': 2 });
  const matches = completion.items.filter(item => item.label === 'VM');

  expect(matches).toHaveLength(1);
  expect(matches[0]?.insertText).not.toContain('path');
  expect(matches[0]?.insertText).toContain('type');
});
