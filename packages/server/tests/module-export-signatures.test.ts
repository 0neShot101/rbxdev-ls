import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  DidChangeTextDocumentNotification,
  DidOpenTextDocumentNotification,
  PublishDiagnosticsNotification,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { createDocumentManager } from '@lsp/documents';
import { setupDiagnosticsHandler } from '@lsp/handlers/diagnostics';
import { createLspHarness } from '@tests/helpers/lsp';
import { resolveAnnotationToType } from '@workspace/annotationResolver';
import { buildModuleIndex } from '@workspace/moduleIndex';
import { loadSourcemapState } from '@workspace/sourcemap';
import { typeToString } from '@analyzer/values';
import type { ExportSignature } from '@tests/types/signatures';
import type { TypeReference } from '@typings/ast';

const origin = { 'offset': 0, 'line': 0, 'column': 0 };

const makeRef = (name: string): TypeReference => ({
  'kind': 'TypeReference',
  name,
  'module': undefined,
  'typeArgs': undefined,
  'range': { 'start': origin, 'end': origin },
});

describe('resolveAnnotationToType', () => {
  test('undefined annotation → any', () => expect(resolveAnnotationToType(undefined).kind).toBe('Any'));

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

  test('any keyword → AnyType', () => expect(resolveAnnotationToType(makeRef('any')).kind).toBe('Any'));

  test('unknown keyword → UnknownType', () => expect(resolveAnnotationToType(makeRef('unknown')).kind).toBe('Unknown'));

  test('unrecognised class or alias reference falls back to any', () => {
    expect(resolveAnnotationToType(makeRef('Part')).kind).toBe('Any');
    expect(resolveAnnotationToType(makeRef('MyAlias')).kind).toBe('Any');
  });
});

describe('extractModuleExports captures function signatures end-to-end via the sourcemap and module index', () => {
  let tempDir: string;

  beforeEach(() => void (tempDir = mkdtempSync(path.join(tmpdir(), 'rbxdev-signatures-'))));

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

  const loadExports = (): Map<string, ExportSignature> => {
    const state = loadSourcemapState(tempDir);
    const index = buildModuleIndex(state, tempDir);

    const result = new Map<string, ExportSignature>();
    for (const [, info] of index)
      for (const moduleExport of info.exports) {
        const signature = moduleExport.signature;
        if (signature === undefined) {
          result.set(moduleExport.name, { 'params': '', 'returnType': '', 'kind': moduleExport.kind });
          continue;
        }
        const params = signature.params.map(p => `${p.name ?? '?'}: ${typeToString(p.type)}`).join(', ');
        const returnType = typeToString(signature.returnType);
        result.set(moduleExport.name, { params, returnType, 'kind': moduleExport.kind });
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

  test('resolves indexed DataModel type exports without losing runtime function signatures', () => {
    writeFixture(`
export type Config = { count: number }
return {
  count = function(value: number): number
    return value
  end,
}
`);
    const manager = createDocumentManager({ 'roblox': undefined, 'sunc': undefined });
    manager.initializeWorkspace(tempDir);
    const doc = TextDocument.create(
      pathToFileURL(path.join(tempDir, 'main.lua')).href,
      'luau',
      1,
      `--!strict
local module = require(game.ReplicatedStorage.Module)
local config: module.Config = { count = 1 }
local value = module.count(config.count)
`,
    );
    const result = manager.parseDocument(doc);
    expect(result.parseErrors).toEqual([]);
    expect(result.typeErrors).toEqual([]);
    expect(result.typeCheckResult?.allSymbols.get('value')).toMatchObject({ 'kind': 'Primitive', 'name': 'number' });
    expect(result.typeCheckResult?.allSymbols.get('config')?.kind).toBe('Table');
  });

  test('resolves transitive file type exports without exposing private aliases', () => {
    mkdirSync(path.join(tempDir, 'core', 'parts'), { 'recursive': true });
    writeFileSync(
      path.join(tempDir, 'core', 'config.lua'),
      `local parts = require('./parts')
type Limit = parts.Limit
export type Config = { enabled: boolean, maxEntries: Limit }
local config = {}
return config
`,
    );
    writeFileSync(
      path.join(tempDir, 'core', 'parts', 'init.luau'),
      `local value = require('../value.luau')
export type Limit = value.Limit
return {}
`,
    );
    writeFileSync(path.join(tempDir, 'core', 'value.luau'), 'export type Limit = number\nreturn {}');

    const manager = createDocumentManager({ 'roblox': undefined, 'sunc': undefined });
    const uri = pathToFileURL(path.join(tempDir, 'main.lua')).href;
    const source = `--!strict
local config = require('core/config')
local function apply(cfg: config.Config): number
  print(cfg.enabled)
  return cfg.maxEntries
end
`;
    const valid = manager.parseDocument(TextDocument.create(uri, 'luau', 1, source));
    expect(valid.parseErrors).toEqual([]);
    expect(valid.typeErrors).toEqual([]);

    const invalid = manager.parseDocument(
      TextDocument.create(
        uri,
        'luau',
        2,
        `${source}
local function bad(cfg: config.Config)
  print(cfg.missing)
  local wrong: string = cfg.maxEntries
end
type Private = config.Limit
`,
      ),
    );
    expect(invalid.parseErrors).toEqual([]);
    expect(invalid.typeErrors.map(d => d.code)).toEqual(['E009', 'E002', 'E010']);
  });

  test('allows calling a file module that returns a function while resolving its type exports', () => {
    writeFileSync(
      path.join(tempDir, 'factory.lua'),
      'export type Result = number\nlocal function factory() return 1 end\nreturn factory',
    );
    const manager = createDocumentManager({ 'roblox': undefined, 'sunc': undefined });
    const result = manager.parseDocument(
      TextDocument.create(
        pathToFileURL(path.join(tempDir, 'main.lua')).href,
        'luau',
        1,
        "--!strict\nlocal factory = require('./factory')\nlocal value: factory.Result = factory()",
      ),
    );
    expect(result.typeErrors).toEqual([]);
  });

  test('publishes new diagnostics for an untouched consumer when an open module changes', async () => {
    const manager = createDocumentManager({ 'roblox': undefined, 'sunc': undefined });
    const harness = createLspHarness(manager);
    setupDiagnosticsHandler(harness.connection, harness.documents, manager);
    const modulePath = path.join(tempDir, 'config.lua');
    const moduleUri = pathToFileURL(modulePath).href;
    const consumerUri = pathToFileURL(path.join(tempDir, 'consumer.lua')).href;
    const diskSource = 'export type Count = number\nreturn {}';
    writeFileSync(modulePath, diskSource);

    const nextConsumerDiagnostics = (expectError: boolean): Promise<ReadonlyArray<string | number | undefined>> => {
      const { promise, resolve } = Promise.withResolvers<ReadonlyArray<string | number | undefined>>();
      const subscription = harness.client.onNotification(PublishDiagnosticsNotification.type, params => {
        if (params.uri !== consumerUri || (params.diagnostics.length > 0) !== expectError) return;
        subscription.dispose();
        resolve(params.diagnostics.map(diagnostic => diagnostic.code));
      });
      return promise;
    };

    try {
      await harness.start();
      await harness.client.sendNotification(DidOpenTextDocumentNotification.type, {
        'textDocument': { 'uri': moduleUri, 'languageId': 'luau', 'version': 1, 'text': diskSource },
      });
      const initial = nextConsumerDiagnostics(false);
      await harness.client.sendNotification(DidOpenTextDocumentNotification.type, {
        'textDocument': {
          'uri': consumerUri,
          'languageId': 'luau',
          'version': 1,
          'text': "--!strict\nlocal config = require('./config')\nlocal value: config.Count = 42",
        },
      });
      expect(await initial).toEqual([]);
      const updated = nextConsumerDiagnostics(true);
      await harness.client.sendNotification(DidChangeTextDocumentNotification.type, {
        'textDocument': { 'uri': moduleUri, 'version': 2 },
        'contentChanges': [{ 'text': 'export type Count = string\nreturn {}' }],
      });
      expect(await updated).toEqual(['E002']);
    } finally {
      harness.dispose();
    }
  });

  test('refreshes cached require consumers after edits, close, and workspace reload', () => {
    const modulePath = path.join(tempDir, 'config.lua');
    const diskSource = 'export type Count = number\nreturn {}';
    const editedSource = 'export type Count = string\nreturn {}';
    writeFileSync(modulePath, diskSource);
    const manager = createDocumentManager({ 'roblox': undefined, 'sunc': undefined });
    manager.initializeWorkspace(tempDir);
    const consumer = TextDocument.create(
      pathToFileURL(path.join(tempDir, 'main.lua')).href,
      'luau',
      1,
      "--!strict\nlocal config = require('./config')\nlocal count: config.Count = 1",
    );
    const moduleUri = pathToFileURL(modulePath).href;

    expect(manager.parseDocument(consumer).typeErrors).toEqual([]);
    manager.parseDocument(TextDocument.create(moduleUri, 'luau', 1, diskSource));
    expect(manager.parseDocument(consumer).typeErrors).toEqual([]);
    manager.parseDocument(TextDocument.create(moduleUri, 'luau', 2, editedSource));
    expect(manager.parseDocument(consumer).typeErrors.map(d => d.code)).toEqual(['E002']);
    manager.removeDocument(moduleUri);
    expect(manager.parseDocument(consumer).typeErrors).toEqual([]);
    writeFileSync(modulePath, editedSource);
    manager.reloadWorkspace();
    expect(manager.parseDocument(consumer).typeErrors.map(d => d.code)).toEqual(['E002']);
  });

  test('terminates cyclic exported type lookups without discarding independent aliases', () => {
    writeFileSync(
      path.join(tempDir, 'a.lua'),
      "local B = require('./b')\nexport type FromB = B.FromA\nexport type Count = number\nreturn {}",
    );
    writeFileSync(path.join(tempDir, 'b.lua'), "local A = require('./a')\nexport type FromA = A.FromB\nreturn {}");
    const manager = createDocumentManager({ 'roblox': undefined, 'sunc': undefined });
    const doc = TextDocument.create(
      pathToFileURL(path.join(tempDir, 'main.lua')).href,
      'luau',
      1,
      "--!strict\nlocal A = require('./a')\nlocal count: A.Count = 'wrong'",
    );
    const result = manager.parseDocument(doc);
    expect(result.parseErrors).toEqual([]);
    expect(result.typeErrors.map(d => d.code)).toEqual(['E002']);
  });
});
