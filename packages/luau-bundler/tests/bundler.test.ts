import { parse } from '@parser/parser';
import { afterAll, describe, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { bundle, resolveRojoProject } from '../src/bundler';

const packageRoot = join(import.meta.dir, '..');
const fixtures = join(import.meta.dir, 'fixtures');
const basicDir = join(fixtures, 'basic');
const rojoDir = join(fixtures, 'rojo');

const tmpDir = mkdtempSync(join(tmpdir(), 'luau-bundler-test-'));

afterAll(() => rmSync(tmpDir, { 'recursive': true, 'force': true }));

/**
 * Parses Lua source with the server's Luau parser and returns the error count.
 * @param source - The Lua source to parse.
 * @returns Number of parse errors.
 */
const parseErrorCount = (source: string): number => parse(source).errors.length;

describe('bundle output validity', () => {
  test('produces parseable Luau with passVarargs true', () => {
    const result = bundle({ 'sourceDir': basicDir, 'passVarargs': true });
    expect(result.output.length).toBeGreaterThan(0);
    expect(parseErrorCount(result.output)).toBe(0);
  });

  test('produces parseable Luau with passVarargs false', () => {
    const result = bundle({ 'sourceDir': basicDir, 'passVarargs': false });
    expect(result.output.length).toBeGreaterThan(0);
    expect(parseErrorCount(result.output)).toBe(0);
  });
});

describe('module registry', () => {
  const { output, moduleCount } = bundle({ 'sourceDir': basicDir });

  test('registers every fixture file by relative path', () => {
    expect(output).toContain('_modules["init.luau"] = {');
    expect(output).toContain('_modules["util.luau"] = {');
    expect(output).toContain('_modules["nested/helper.luau"] = {');
    expect(output).toContain('_modules["nested/sub/init.luau"] = {');
  });

  test('emits extension-stripped aliases', () => {
    expect(output).toContain('_modules["init"] = _modules["init.luau"]');
    expect(output).toContain('_modules["util"] = _modules["util.luau"]');
    expect(output).toContain('_modules["nested/helper"] = _modules["nested/helper.luau"]');
    expect(output).toContain('_modules["nested/sub/init"] = _modules["nested/sub/init.luau"]');
  });

  test('emits init-collapsed alias for nested init.luau', () =>
    expect(output).toContain('_modules["nested/sub"] = _modules["nested/sub/init.luau"]'));

  test('moduleCount matches the number of fixture files', () => expect(moduleCount).toBe(4));
});

describe('entry resolution', () => {
  test('defaults to init', () => {
    const { output } = bundle({ 'sourceDir': basicDir });
    expect(output).toContain('return require("init")');
  });

  test('respects a custom entry', () => {
    const { output } = bundle({ 'sourceDir': basicDir, 'entry': 'util' });
    expect(output).toContain('return require("util")');
    expect(output).not.toContain('return require("init")');
  });
});

describe('header', () => {
  test('emits header lines as leading comments', () => {
    const { output } = bundle({ 'sourceDir': basicDir, 'header': 'rbxdev bridge\nv1.0' });
    const lines = output.split('\n');
    expect(lines[0]).toBe('-- rbxdev bridge');
    expect(lines[1]).toBe('-- v1.0');
    expect(parseErrorCount(output)).toBe(0);
  });

  test('omits comments when no header is given', () => {
    const { output } = bundle({ 'sourceDir': basicDir });
    expect(output.startsWith('--')).toBe(false);
  });
});

describe('resolveRojoProject', () => {
  test('returns undefined for a missing file', () =>
    expect(resolveRojoProject(join(rojoDir, 'does-not-exist.project.json'))).toBeUndefined());

  test('resolves sourceDir and name from tree.$path', () => {
    const resolved = resolveRojoProject(join(rojoDir, 'default.project.json'));
    expect(resolved).toBeDefined();
    expect(resolved?.name).toBe('bridge-demo');
    expect(resolved?.sourceDir).toBe(join(rojoDir, 'src'));
  });

  test('returns undefined when tree.$path is missing', () =>
    expect(resolveRojoProject(join(rojoDir, 'no-path.project.json'))).toBeUndefined());
});

describe('require shim', () => {
  const { output } = bundle({ 'sourceDir': basicDir });

  test('wraps the oldRequire fallback in pcall', () =>
    expect(output).toContain('pcall(function() fallback = oldRequire(path) end)'));

  test('closes with the oldRequire-injecting tail', () =>
    expect(output.endsWith('end)(require or function() end, ...)')).toBe(true));
});

describe('determinism', () => {
  test('two bundles of the same source are identical', () => {
    const first = bundle({ 'sourceDir': basicDir });
    const second = bundle({ 'sourceDir': basicDir });
    expect(first.output).toBe(second.output);
    expect(first.moduleCount).toBe(second.moduleCount);
  });
});

describe('cli', () => {
  test('bundles a fixture directory to a parseable output file', () => {
    const outFile = join(tmpDir, 'out.lua');
    const result = Bun.spawnSync(['bun', 'src/cli.ts', '--src', basicDir, '--out', outFile, '--entry', 'init'], {
      'cwd': packageRoot,
    });

    expect(result.exitCode).toBe(0);
    expect(existsSync(outFile)).toBe(true);
    expect(parseErrorCount(readFileSync(outFile, 'utf-8'))).toBe(0);
  });

  test('exits with code 1 when no arguments are given', () => {
    const result = Bun.spawnSync(['bun', 'src/cli.ts'], { 'cwd': packageRoot });
    expect(result.exitCode).toBe(1);
  });
});
