/// <reference types="@types/bun" />
/// <reference types="@types/node" />

import { execSync } from 'child_process';
import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const rootDir = join(import.meta.dir, '..');
const vscodeDir = join(rootDir, 'vscode');

const run = (cmd: string, cwd: string = rootDir): void => {
  execSync(cmd, { 'cwd': cwd, 'stdio': 'inherit' });
};

const step = (name: string, fn: () => void): void => {
  const start = Date.now();
  console.log(`\n\u25b8 ${name}...`);
  try {
    fn();
    const elapsed = Date.now() - start;
    console.log(`  \u2713 ${name} (${elapsed}ms)`);
  } catch {
    console.error(`\n  \u2717 ${name} failed \u2014 aborting build`);
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

const updatePackageField = (filePath: string, field: string, value: string): void => {
  const content = readFileSync(filePath, 'utf-8');
  const pattern = new RegExp(`"${field}":\\s*"[^"]+"`);
  const updated = content.replace(pattern, `"${field}": "${value}"`);
  writeFileSync(filePath, updated);
};

const args = process.argv.slice(2);
const isBeta = args.includes('--beta');
const validBumps = ['major', 'minor', 'patch'] as const;
const bumpArg = args.find(a => validBumps.includes(a as (typeof validBumps)[number]));
const bumpType =
  bumpArg !== undefined && validBumps.includes(bumpArg as (typeof validBumps)[number])
    ? (bumpArg as (typeof validBumps)[number])
    : 'patch';

const rootPkg = join(rootDir, 'package.json');
const vscodePkg = join(vscodeDir, 'package.json');
const rootContent = JSON.parse(readFileSync(rootPkg, 'utf-8'));
const vscodeContent = JSON.parse(readFileSync(vscodePkg, 'utf-8'));
const currentVersion: string = rootContent['version'];
const originalDisplayName: string = vscodeContent['displayName'];
const originalDescription: string = vscodeContent['description'];

const rootPkgOriginal = readFileSync(rootPkg, 'utf-8');
const vscodePkgOriginal = readFileSync(vscodePkg, 'utf-8');

const restorePackageFiles = (): void => {
  writeFileSync(rootPkg, rootPkgOriginal);
  writeFileSync(vscodePkg, vscodePkgOriginal);
};

if (isBeta) {
  const betaNum = Math.floor(Date.now() / 1000);
  const betaVersion = `${currentVersion}-beta.${betaNum}`;

  console.log('\u2550'.repeat(43));
  console.log('  rbxdev-ls BETA Build Pipeline');
  console.log('\u2550'.repeat(43));
  console.log(`  Version: ${betaVersion}`);
  console.log(`  Mode:    BETA (no permanent version bump)`);

  step('Set beta metadata', () => {
    updatePackageVersion(rootPkg, betaVersion);
    updatePackageVersion(vscodePkg, betaVersion);
    updatePackageField(vscodePkg, 'displayName', `${originalDisplayName} [BETA]`);
    updatePackageField(vscodePkg, 'description', `BETA BUILD - ${originalDescription}`);
    console.log(`  Version: ${betaVersion}`);
    console.log(`  Display: ${originalDisplayName} [BETA]`);
  });

  step('Run tests', () => {
    run('bun test');
  });

  step('Build language server + MCP server', () => {
    run('bun build src/index.ts src/mcp.ts --outdir dist --target node');
  });

  step('Bundle VSCode extension', () => {
    run('bun run bundle', vscodeDir);
  });

  step('Copy server files', () => {
    run('bun ./scripts/copy-server.ts', vscodeDir);
  });

  step('Package beta VSIX', () => {
    run('npx vsce package --no-dependencies --no-git-tag-version', vscodeDir);
  });

  step('Restore package.json files', () => {
    restorePackageFiles();
    console.log('  Reverted package.json and vscode/package.json');
  });

  const vsixFiles = readdirSync(vscodeDir)
    .filter(f => f.endsWith('.vsix'))
    .sort();
  const latest = vsixFiles[vsixFiles.length - 1];

  console.log('\n' + '\u2550'.repeat(43));
  console.log('  BETA build complete!');
  if (latest !== undefined) {
    console.log(`  VSIX: vscode/${latest}`);
    console.log(`  Distribute this file to beta testers.`);
  }
  console.log('\u2550'.repeat(43) + '\n');
} else {
  const newVersion = bumpVersion(currentVersion, bumpType);

  console.log('\u2550'.repeat(43));
  console.log('  rbxdev-ls VSIX Build Pipeline');
  console.log('\u2550'.repeat(43));
  console.log(`  Version: ${currentVersion} \u2192 ${newVersion} (${bumpType})`);

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

  step('Bundle VSCode extension', () => {
    run('bun run bundle', vscodeDir);
  });

  step('Copy server files', () => {
    run('bun ./scripts/copy-server.ts', vscodeDir);
  });

  step('Package VSIX', () => {
    run('npx vsce package --no-dependencies', vscodeDir);
  });

  const vsixFiles = readdirSync(vscodeDir)
    .filter(f => f.endsWith('.vsix'))
    .sort();
  const latest = vsixFiles[vsixFiles.length - 1];

  console.log('\n' + '\u2550'.repeat(43));
  console.log('  Build complete!');
  if (latest !== undefined) {
    console.log(`  VSIX: vscode/${latest}`);
  }
  console.log('\u2550'.repeat(43) + '\n');
}
