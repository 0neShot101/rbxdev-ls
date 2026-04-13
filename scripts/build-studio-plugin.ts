/// <reference types="@types/bun" />
/// <reference types="@types/node" />

import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const rootDir = join(import.meta.dir, '..');
const pluginDir = join(rootDir, 'roblox', 'studio-plugin');
const distDir = join(pluginDir, 'dist');
const projectFile = join(pluginDir, 'default.project.json');
const outputFile = join(distDir, 'rbxdev-studio-bridge.rbxm');

const step = (name: string, fn: () => void): void => {
  const start = Date.now();
  console.log(`\u25b8 ${name}...`);
  try {
    fn();
    const elapsed = Date.now() - start;
    console.log(`  \u2713 ${name} (${elapsed}ms)`);
  } catch (err) {
    console.error(`  \u2717 ${name} failed:`, err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
};

console.log('\u2550'.repeat(43));
console.log('  rbxdev Studio Plugin Build');
console.log('\u2550'.repeat(43));

step('Validate project file', () => {
  if (existsSync(projectFile) === false) throw new Error('roblox/studio-plugin/default.project.json not found');
});

step('Build .rbxm with Rojo', () => {
  if (existsSync(distDir) === false) mkdirSync(distDir, { 'recursive': true });
  execSync(`rojo build "${projectFile}" -o "${outputFile}"`, { 'cwd': rootDir, 'stdio': 'inherit' });
});

console.log('\n' + '\u2550'.repeat(43));
console.log('  Build complete!');
console.log(`  Plugin: roblox/studio-plugin/dist/rbxdev-studio-bridge.rbxm`);
console.log('  Install: drop into your Studio plugins folder');
console.log('\u2550'.repeat(43) + '\n');
