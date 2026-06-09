#!/usr/bin/env node

/**
 * CLI entry point for the Luau bundler.
 *
 * @example
 *   luau-bundler --src src --out dist/out.lua
 *   luau-bundler --project default.project.json --out dist/out.lua
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';

import { bundle, resolveRojoProject } from './bundler';

const args = process.argv.slice(2);

/**
 * Extracts the value following a --flag from the argument list.
 * @param name - The flag name without the leading --.
 * @returns The flag's value, or undefined if the flag is absent.
 */
const getArg = (name: string): string | undefined => {
  const index = args.indexOf(`--${name}`);
  if (index === -1 || index + 1 >= args.length) return undefined;
  return args[index + 1];
};

const projectFile = getArg('project');
let sourceDir = getArg('src');
const outputPath = getArg('out');
const entry = getArg('entry') ?? 'init';
const header = getArg('header');

if (projectFile !== undefined) {
  const resolved = resolveRojoProject(resolve(projectFile));
  if (resolved === undefined) {
    console.error(`Could not read Rojo project or missing tree.$path: ${projectFile}`);
    process.exit(1);
  }
  sourceDir = resolved.sourceDir;
  console.log(`Rojo project: ${resolved.name} (source: ${sourceDir})`);
}

if (sourceDir === undefined || outputPath === undefined) {
  console.error('Usage: luau-bundler --src <dir> --out <file> [--entry <name>] [--header <text>]');
  console.error('       luau-bundler --project <rojo.project.json> --out <file> [--entry <name>]');
  process.exit(1);
}

const resolvedSrc = resolve(sourceDir);
const resolvedOut = resolve(outputPath);

if (existsSync(resolvedSrc) === false) {
  console.error(`Source directory not found: ${resolvedSrc}`);
  process.exit(1);
}

console.log(`Bundling ${resolvedSrc} ...`);

const result = bundle({
  'sourceDir': resolvedSrc,
  entry,
  ...(header !== undefined ? { header } : {}),
});

const outDir = dirname(resolvedOut);
if (existsSync(outDir) === false) mkdirSync(outDir, { 'recursive': true });
writeFileSync(resolvedOut, result.output, 'utf-8');

const sizeKb = (Buffer.byteLength(result.output, 'utf-8') / 1024).toFixed(1);
console.log(`  ${result.moduleCount} modules bundled in ${result.elapsedMs.toFixed(1)}ms`);
console.log(`  Output: ${resolvedOut} (${sizeKb} KB)`);
