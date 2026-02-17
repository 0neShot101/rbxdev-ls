/// <reference types="@types/bun" />
/// <reference types="@types/node" />

import { execSync } from 'child_process';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const rootDir = join(import.meta.dir, '..');
const pkgDir = join(rootDir, 'packages', 'rbxdev-mcp');
const distMcp = join(rootDir, 'dist', 'mcp.js');
const targetMcp = join(pkgDir, 'mcp.js');

const run = (cmd: string, cwd: string = rootDir): void => {
  execSync(cmd, { 'cwd': cwd, 'stdio': 'inherit' });
};

const step = (name: string, fn: () => void): void => {
  const start = Date.now();
  console.log(`\n▸ ${name}...`);
  try {
    fn();
    const elapsed = Date.now() - start;
    console.log(`  ✓ ${name} (${elapsed}ms)`);
  } catch {
    console.error(`\n  ✗ ${name} failed — aborting publish`);
    process.exit(1);
  }
};

const rootPkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf-8'));
const version: string = rootPkg['version'];

console.log('═══════════════════════════════════════');
console.log('  @oneshot101/rbxdev-mcp Publish');
console.log('═══════════════════════════════════════');
console.log(`  Version: ${version}`);

step('Build MCP server', () => {
  run('bun build src/mcp.ts --outdir dist --target node');
});

step('Copy bundle to package', () => {
  if (existsSync(distMcp) === false) throw new Error('dist/mcp.js not found');
  copyFileSync(distMcp, targetMcp);

  const bytes = readFileSync(targetMcp).length;
  console.log(`  Copied dist/mcp.js → packages/rbxdev-mcp/mcp.js (${(bytes / 1024).toFixed(0)} KB)`);
});

step('Sync version', () => {
  const mcpPkgPath = join(pkgDir, 'package.json');
  const mcpPkg = JSON.parse(readFileSync(mcpPkgPath, 'utf-8'));
  mcpPkg['version'] = version;
  writeFileSync(mcpPkgPath, JSON.stringify(mcpPkg, undefined, 2) + '\n');
  console.log(`  Set version to ${version}`);
});

const dryRun = process.argv.includes('--dry-run');

step(dryRun ? 'Dry run publish' : 'Publish to npm', () => {
  const cmd = dryRun ? 'npm publish --access public --dry-run' : 'npm publish --access public';
  run(cmd, pkgDir);
});

console.log('\n═══════════════════════════════════════');
console.log(`  Published @oneshot101/rbxdev-mcp@${version}`);
console.log('═══════════════════════════════════════\n');
