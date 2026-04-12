import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { resolveAnnotationToType } from '@workspace/annotationResolver';
import { buildModuleIndex } from '@workspace/moduleIndex';
import { loadSourcemapState } from '@workspace/sourcemap';
import { typeToString } from '@typings/types';

import type { TypeAnnotation } from '@typings/ast';

const makeRef = (name: string): TypeAnnotation =>
  ({ 'kind': 'TypeReference', name, 'module': undefined, 'typeArgs': undefined, 'range': { 'start': { 'line': 0, 'character': 0 }, 'end': { 'line': 0, 'character': 0 } } }) as unknown as TypeAnnotation;

describe('resolveAnnotationToType', () => {
  test('undefined annotation → any', () => {
    expect(resolveAnnotationToType(undefined).kind).toBe('Any');
  });

  test('number primitive', () => {
    const t = resolveAnnotationToType(makeRef('number'));
    expect(t.kind).toBe('Primitive');
    if (t.kind === 'Primitive') expect(t.name).toBe('number');
  });

  test('string primitive', () => {
    const t = resolveAnnotationToType(makeRef('string'));
    expect(t.kind).toBe('Primitive');
    if (t.kind === 'Primitive') expect(t.name).toBe('string');
  });

  test('boolean primitive', () => {
    const t = resolveAnnotationToType(makeRef('boolean'));
    expect(t.kind).toBe('Primitive');
    if (t.kind === 'Primitive') expect(t.name).toBe('boolean');
  });

  test('nil primitive', () => {
    const t = resolveAnnotationToType(makeRef('nil'));
    expect(t.kind).toBe('Primitive');
    if (t.kind === 'Primitive') expect(t.name).toBe('nil');
  });

  test('any keyword → AnyType', () => {
    expect(resolveAnnotationToType(makeRef('any')).kind).toBe('Any');
  });

  test('unknown keyword → UnknownType', () => {
    expect(resolveAnnotationToType(makeRef('unknown')).kind).toBe('Unknown');
  });

  test('unrecognised class/type reference → any', () => {
    // User type aliases, Roblox classes (Part), generics, etc. are out of
    // reach for this lossy converter — they fall back to any.
    expect(resolveAnnotationToType(makeRef('Part')).kind).toBe('Any');
    expect(resolveAnnotationToType(makeRef('MyAlias')).kind).toBe('Any');
  });
});

// End-to-end check: a real file on disk, walked through the same code path
// the language server uses (loadSourcemapState → buildModuleIndex) and
// observed via typeToString output. This catches regressions in the AST
// shape the extractor walks, not just the converter in isolation.
describe('extractModuleExports captures function signatures end-to-end', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'rbxdev-signatures-'));
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { 'recursive': true, 'force': true });
    } catch {
      /* noop */
    }
  });

  const writeFixture = (moduleSource: string): void => {
    writeFileSync(
      path.join(tempDir, 'default.project.json'),
      JSON.stringify({
        'name': 'fixture',
        'tree': {
          '$className': 'DataModel',
          'ReplicatedStorage': {
            '$className': 'ReplicatedStorage',
            'Module': { '$path': 'src/Module.lua' },
          },
        },
      }),
    );
    writeFileSync(
      path.join(tempDir, 'sourcemap.json'),
      JSON.stringify({
        'name': 'fixture',
        'className': 'DataModel',
        'children': [
          {
            'name': 'ReplicatedStorage',
            'className': 'ReplicatedStorage',
            'children': [
              {
                'name': 'Module',
                'className': 'ModuleScript',
                'filePaths': ['src/Module.lua'],
              },
            ],
          },
        ],
      }),
    );
    mkdirSync(path.join(tempDir, 'src'), { 'recursive': true });
    writeFileSync(path.join(tempDir, 'src', 'Module.lua'), moduleSource);
  };

  const loadExports = (): Map<string, { params: string; returnType: string; kind: string }> => {
    const state = loadSourcemapState(tempDir);
    const index = buildModuleIndex(state, tempDir);

    const result = new Map<string, { params: string; returnType: string; kind: string }>();
    for (const [, info] of index) {
      for (const exp of info.exports) {
        if (exp.signature === undefined) {
          result.set(exp.name, { 'params': '', 'returnType': '', 'kind': exp.kind });
          continue;
        }
        const params = exp.signature.params.map(p => `${p.name ?? '?'}: ${typeToString(p.type)}`).join(', ');
        const returnType = typeToString(exp.signature.returnType);
        result.set(exp.name, { params, returnType, 'kind': exp.kind });
      }
    }
    return result;
  };

  test('captures FunctionDeclaration style `function Module.x(a: T): R`', () => {
    writeFixture(`
local Module = {}

function Module.increment(value: number): number
	return value + 1
end

function Module.reset(): number
	return 0
end

return Module
`);
    const exports = loadExports();
    expect(exports.get('increment')?.params).toBe('value: number');
    expect(exports.get('increment')?.returnType).toBe('number');
    expect(exports.get('reset')?.params).toBe('');
    expect(exports.get('reset')?.returnType).toBe('number');
  });

  test('captures table-literal assignment `Module.x = function(a: T): R ... end`', () => {
    writeFixture(`
local Module = {
	greet = function(name: string): string
		return "Hello, " .. name
	end,
	multiply = function(a: number, b: number): number
		return a * b
	end,
}

return Module
`);
    const exports = loadExports();
    expect(exports.get('greet')?.params).toBe('name: string');
    expect(exports.get('greet')?.returnType).toBe('string');
    expect(exports.get('multiply')?.params).toBe('a: number, b: number');
    expect(exports.get('multiply')?.returnType).toBe('number');
  });

  test('captures direct table return `return { foo = function(...) end }`', () => {
    writeFixture(`
return {
	negate = function(value: boolean): boolean
		return not value
	end,
}
`);
    const exports = loadExports();
    expect(exports.get('negate')?.params).toBe('value: boolean');
    expect(exports.get('negate')?.returnType).toBe('boolean');
  });

  test('missing annotations fall back to any, not a synthetic `(): any`', () => {
    writeFixture(`
local Module = {}

function Module.bare(x, y)
	return x + y
end

return Module
`);
    const exports = loadExports();
    const bare = exports.get('bare');
    expect(bare).toBeDefined();
    // Two params recorded with any as their type
    expect(bare?.params).toBe('x: any, y: any');
    expect(bare?.returnType).toBe('any');
  });

  test('return-type-only (`function Module.x(): number`)', () => {
    writeFixture(`
local Module = {}

function Module.getConstant(): number
	return 42
end

return Module
`);
    const exports = loadExports();
    expect(exports.get('getConstant')?.params).toBe('');
    expect(exports.get('getConstant')?.returnType).toBe('number');
  });
});
