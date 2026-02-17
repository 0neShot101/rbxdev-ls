/// <reference types="@types/bun" />
/// <reference types="@types/node" />

import { execSync } from 'child_process';
import { existsSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';

const rootDir = join(import.meta.dir, '..');
const vscodeDir = join(rootDir, 'vscode');

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
    console.error(`\n  ✗ ${name} failed — aborting build`);
    process.exit(1);
  }
};

const bumpVersion = (version: string, type: 'major' | 'minor' | 'patch'): string => {
  const parts = version.split('.').map(Number);
  const major = parts[0] ?? 0;
  const minor = parts[1] ?? 0;
  const patch = parts[2] ?? 0;

  if (type === 'major') return `${major + 1}.0.0`;
  if (type === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
};

const updatePackageVersion = (filePath: string, newVersion: string): void => {
  const content = readFileSync(filePath, 'utf-8');
  const updated = content.replace(/"version":\s*"[^"]+"/, `"version": "${newVersion}"`);
  writeFileSync(filePath, updated);
};

const arg = process.argv[2];
const validBumps = ['major', 'minor', 'patch'] as const;
const bumpType =
  arg !== undefined && validBumps.includes(arg as (typeof validBumps)[number])
    ? (arg as (typeof validBumps)[number])
    : 'patch';

const rootPkg = join(rootDir, 'package.json');
const vscodePkg = join(vscodeDir, 'package.json');
const rootContent = JSON.parse(readFileSync(rootPkg, 'utf-8'));
const currentVersion: string = rootContent['version'];

const newVersion = bumpVersion(currentVersion, bumpType);

console.log('═══════════════════════════════════════');
console.log('  rbxdev-ls VSIX Build Pipeline');
console.log('═══════════════════════════════════════');
console.log(`  Version: ${currentVersion} → ${newVersion} (${bumpType})`);

step('Bump version', () => {
  updatePackageVersion(rootPkg, newVersion);
  updatePackageVersion(vscodePkg, newVersion);
  console.log(`  Updated package.json: ${newVersion}`);
  console.log(`  Updated vscode/package.json: ${newVersion}`);
});

step('Run tests', () => {
  run('bun test');
});

step('Type check', () => {
  run('bun run type-check');
});

step('Build language server + MCP server', () => {
  run('bun build src/index.ts src/mcp.ts --outdir dist --target node');
});

step('Build VSCode extension', () => {
  run('tsc -p ./', vscodeDir);
});

step('Copy server files', () => {
  run('bun ./scripts/copy-server.ts', vscodeDir);
});

step('Clean stale output files', () => {
  const outDir = join(vscodeDir, 'out');
  if (existsSync(outDir)) {
    const staleFiles = ['assetManagerProvider.js', 'docPreviewWebview.js'];
    for (const file of staleFiles) {
      const filePath = join(outDir, file);
      if (existsSync(filePath)) {
        unlinkSync(filePath);
        console.log(`  Removed stale file: out/${file}`);
      }
      const mapPath = join(outDir, file.replace('.js', '.js.map'));
      if (existsSync(mapPath)) {
        unlinkSync(mapPath);
      }
    }
  }
});

step('Package VSIX', () => {
  run('npx vsce package', vscodeDir);
});

const vsixFiles = readdirSync(vscodeDir)
  .filter(f => f.endsWith('.vsix'))
  .sort();
const latest = vsixFiles[vsixFiles.length - 1];

console.log('\n═══════════════════════════════════════');
console.log('  Build complete!');
if (latest !== undefined) {
  console.log(`  VSIX: vscode/${latest}`);
}
console.log('═══════════════════════════════════════\n');
