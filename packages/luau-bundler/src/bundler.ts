/**
 * Core Luau module bundler.
 *
 * Collects all .lua/.luau source files from a directory, wraps each in a
 * module loader, generates a require shim, and produces a single
 * self-contained Lua file that works with loadstring().
 *
 * Based on work by Expo (https://codeberg.org/Expo).
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { dirname, join, relative } from 'path';

import type { BundleResult, BundlerOptions, RojoProject } from '@bundler/types/bundler';

/**
 * Reads a Rojo default.project.json and returns the resolved source directory.
 * @param projectPath - Absolute path to the .project.json file.
 * @returns The resolved source directory, or undefined if the project has no $path.
 */
export const resolveRojoProject = (projectPath: string): { sourceDir: string; name: string } | undefined => {
  if (existsSync(projectPath) === false) return undefined;

  const project: RojoProject = JSON.parse(readFileSync(projectPath, 'utf-8'));
  const treePath = project.tree.$path;
  if (treePath === undefined) return undefined;

  return { 'sourceDir': join(dirname(projectPath), treePath), 'name': project.name };
};

/**
 * Recursively collects all .lua/.luau files under a directory, sorted for deterministic output.
 * @param dir - The root directory to walk.
 * @returns Sorted array of absolute file paths.
 */
const walkDir = (dir: string): string[] => {
  const results: string[] = [];

  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) results.push(...walkDir(full));
    else if (/\.luau?$/.test(entry)) results.push(full);
  }

  return results.sort();
};

/**
 * Generates all equivalent require paths for a given file path.
 *
 * A file at "handlers/execute.luau" can be required as
 * "handlers/execute.luau" or "handlers/execute". A file at
 * "handlers/init.luau" can also be required as "handlers".
 *
 * @param filePath - The relative file path to generate aliases for.
 * @returns Array of all valid require strings for this file.
 */
const getAliases = (filePath: string): string[] => {
  const aliases = new Set<string>();
  aliases.add(filePath);
  aliases.add(filePath.replace(/\.luau?$/, ''));

  if (/\/init\.luau?$/.test(filePath)) aliases.add(filePath.replace(/\.luau?$/, '').replace(/\/init$/, ''));

  return [...aliases];
};

/**
 * Quotes a module path as a single-quoted Lua string.
 * @param value - Module path or alias.
 * @returns An escaped Lua string literal.
 */
const quote = (value: string): string =>
  `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r/g, '\\r').replace(/\n/g, '\\n')}'`;

/**
 * Emits the require shim that modules use to load each other at runtime.
 * Falls back to the original require for built-in modules (e.g. game services).
 * @param lines - The output line buffer to append to.
 * @param passVarargs - Whether to capture and forward varargs.
 */
const emitRequireShim = (lines: string[], passVarargs: boolean): void => {
  if (passVarargs) lines.push('  local _vararg = { ... }');
  lines.push('  local _modules = {}');
  lines.push('');
  lines.push('  local require = function(path)');
  lines.push('    if _modules[path] == nil then');
  lines.push('      local fallback');
  lines.push('      pcall(function()');
  lines.push('        fallback = oldRequire(path)');
  lines.push('      end)');
  lines.push("      if typeof(fallback) ~= 'nil' then");
  lines.push('        return fallback');
  lines.push('      end');
  lines.push("      error('[bundler] module not found: ' .. path)");
  lines.push('    end');
  lines.push('');
  lines.push('    local mod = _modules[path]');
  lines.push('    if mod.cached then');
  lines.push('      return mod.value');
  lines.push('    end');
  lines.push('');
  lines.push('    mod.value = mod.load()');
  lines.push('    mod.cached = true');
  lines.push('    return mod.value');
  lines.push('  end');
};

/**
 * Emits a single module definition block into the output lines.
 * @param lines - The output line buffer to append to.
 * @param moduleId - The module identifier used as the require key.
 * @param source - The raw Lua source code of the module.
 * @param passVarargs - Whether to wrap the module body in a vararg closure.
 */
const emitModule = (lines: string[], moduleId: string, source: string, passVarargs: boolean): void => {
  lines.push(`  _modules[${quote(moduleId)}] = {`);
  lines.push('    cached = false,');
  lines.push('    value = nil,');
  lines.push('    load = function()');

  if (passVarargs) {
    lines.push('      return (function(...)');
    for (const line of source.split('\n')) lines.push(line === '' ? '' : '        ' + line);
    lines.push('      end)(unpack(_vararg))');
  } else for (const line of source.split('\n')) lines.push(line === '' ? '' : '      ' + line);

  lines.push('    end,');
  lines.push('  }');
};

/**
 * Bundles all Luau source files in a directory into a single self-contained Lua string.
 * @param options - Bundler configuration (source directory, entry point, header, varargs).
 * @returns The bundled output, module count, and elapsed time.
 */
export const bundle = (options: BundlerOptions): BundleResult => {
  const start = performance.now();
  const { sourceDir, entry = 'init', header, passVarargs = true } = options;

  const files = walkDir(sourceDir).map(f => relative(sourceDir, f).replace(/\\/g, '/'));
  const lines: string[] = [];

  if (header !== undefined)
    for (const line of header.split('\n')) lines.push(`--[[ ${line.replace(/\](?=\])/g, '] ')} ]]--`);

  lines.push('');
  lines.push('return (function(oldRequire, ...)');

  emitRequireShim(lines, passVarargs);
  lines.push('');

  for (const file of files) {
    emitModule(lines, file, readFileSync(join(sourceDir, file), 'utf-8'), passVarargs);
    lines.push('');
  }

  for (const file of files)
    for (const alias of getAliases(file))
      if (alias !== file) lines.push(`  _modules[${quote(alias)}] = _modules[${quote(file)}]`);

  lines.push('');
  lines.push(`  return require(${quote(entry)})`);
  lines.push('end)(require or function()');
  lines.push('end, ...)');

  const output = lines.join('\n');

  return { output, 'moduleCount': files.length, 'elapsedMs': performance.now() - start };
};
