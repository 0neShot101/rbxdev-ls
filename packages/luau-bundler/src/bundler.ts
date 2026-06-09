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

import type { BundleResult, BundlerOptions, RojoProject } from './types/bundler';

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
 * Emits the require shim that modules use to load each other at runtime.
 * Falls back to the original require for built-in modules (e.g. game services).
 * @param lines - The output line buffer to append to.
 * @param passVarargs - Whether to capture and forward varargs.
 */
const emitRequireShim = (lines: string[], passVarargs: boolean): void => {
  if (passVarargs) lines.push('local _vararg = {...}');
  lines.push('local _modules = {}');
  lines.push('');
  lines.push('local require = function(path)');
  lines.push('\tif _modules[path] == nil then');
  lines.push('\t\tlocal fallback');
  lines.push('\t\tpcall(function() fallback = oldRequire(path) end)');
  lines.push('\t\tif typeof(fallback) ~= "nil" then return fallback end');
  lines.push("\t\terror('[bundler] module not found: ' .. path)");
  lines.push('\tend');
  lines.push('\tlocal mod = _modules[path]');
  lines.push('\tif mod.cached then return mod.value end');
  lines.push('\tmod.value = mod.load()');
  lines.push('\tmod.cached = true');
  lines.push('\treturn mod.value');
  lines.push('end');
};

/**
 * Emits a single module definition block into the output lines.
 * @param lines - The output line buffer to append to.
 * @param moduleId - The module identifier used as the require key.
 * @param source - The raw Lua source code of the module.
 * @param passVarargs - Whether to wrap the module body in a vararg closure.
 */
const emitModule = (lines: string[], moduleId: string, source: string, passVarargs: boolean): void => {
  lines.push(`_modules["${moduleId}"] = {`);
  lines.push('\tcached = false,');
  lines.push('\tvalue = nil,');
  lines.push('\tload = function()');

  if (passVarargs) {
    lines.push('\t\treturn (function(...)');
    for (const line of source.split('\n')) lines.push(line === '' ? '' : '\t\t\t' + line);
    lines.push('\t\tend)(unpack(_vararg))');
  } else {
    for (const line of source.split('\n')) lines.push(line === '' ? '' : '\t\t' + line);
  }

  lines.push('\tend,');
  lines.push('}');
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

  if (header !== undefined) for (const line of header.split('\n')) lines.push(`-- ${line}`);

  lines.push('');
  lines.push('return (function(oldRequire, ...)');

  emitRequireShim(lines, passVarargs);
  lines.push('');

  for (const file of files) {
    emitModule(lines, file, readFileSync(join(sourceDir, file), 'utf-8'), passVarargs);
    lines.push('');
  }

  for (const file of files)
    for (const alias of getAliases(file)) if (alias !== file) lines.push(`_modules["${alias}"] = _modules["${file}"]`);

  lines.push('');
  lines.push(`return require("${entry}")`);
  lines.push('end)(require or function() end, ...)');

  const output = lines.join('\n');

  return { output, 'moduleCount': files.length, 'elapsedMs': performance.now() - start };
};
