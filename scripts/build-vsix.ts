import { execSync } from 'child_process';
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import type { PackageMetadata, VersionBump } from '@scripts/types/build';

const rootDir = join(import.meta.dir, '..');
const vscodeDir = join(rootDir, 'packages', 'vscode');
const serverDir = join(rootDir, 'packages', 'server');
const mcpDir = join(rootDir, 'packages', 'mcp');
const RULE = '\u2550'.repeat(43);

const run = (command: string, cwd: string = rootDir): void => void execSync(command, { cwd, 'stdio': 'inherit' });

const step = (name: string, action: () => void): void => {
  const start = Date.now();
  console.log(`\n\u25b8 ${name}...`);
  try {
    action();
    console.log(`  \u2713 ${name} (${Date.now() - start}ms)`);
  } catch {
    console.error(`\n  \u2717 ${name} failed; aborting build`);
    process.exit(1);
  }
};

const bumpVersion = (version: string, bump: VersionBump): string => {
  const [major = 0, minor = 0, patch = 0] = version.split('.').map(Number);
  if (bump === 'major') return `${major + 1}.0.0`;
  if (bump === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
};

const replaceField = (filePath: string, field: string, value: string): void =>
  writeFileSync(
    filePath,
    readFileSync(filePath, 'utf-8').replace(new RegExp(`"${field}":\\s*"[^"]+"`), `"${field}": "${value}"`),
  );

const isPackageMetadata = (value: unknown): value is PackageMetadata =>
  typeof value === 'object' &&
  value !== null &&
  'version' in value &&
  typeof value.version === 'string' &&
  'displayName' in value &&
  typeof value.displayName === 'string' &&
  'description' in value &&
  typeof value.description === 'string';

const isVersionBump = (value: string): value is VersionBump =>
  value === 'major' || value === 'minor' || value === 'patch';

const readMetadata = (filePath: string): PackageMetadata => {
  const value: unknown = JSON.parse(readFileSync(filePath, 'utf-8'));
  if (isPackageMetadata(value) === false) throw new Error(`${filePath} lacks version, displayName or description`);
  return value;
};

const args = process.argv.slice(2);
const isBeta = args.includes('--beta');
const bump = args.find(isVersionBump) ?? 'patch';

const rootPkg = join(rootDir, 'package.json');
const vscodePkg = join(vscodeDir, 'package.json');
const extension = readMetadata(vscodePkg);
const currentVersion = /"version":\s*"([^"]+)"/.exec(readFileSync(rootPkg, 'utf-8'))?.[1] ?? extension.version;
const rootPkgOriginal = readFileSync(rootPkg, 'utf-8');
const vscodePkgOriginal = readFileSync(vscodePkg, 'utf-8');

const buildPackages = (): void => {
  step('Refresh Roblox API and documentation data', () => run('bun run fetch-definitions'));
  step('Run tests', () => run('bun test', serverDir));
  step('Build language server + MCP server', () => {
    run('bun run build', serverDir);
    run('bun run build', mcpDir);
  });
  step('Bundle VSCode extension', () => run('bun run bundle', vscodeDir));
  step('Copy server files', () => run('bun ./scripts/copy-server.ts', vscodeDir));
};

const reportVsix = (title: string): void => {
  const latest = readdirSync(vscodeDir)
    .filter(file => file.endsWith('.vsix'))
    .sort()
    .at(-1);
  console.log(`\n${RULE}\n  ${title}`);
  if (latest !== undefined) console.log(`  VSIX: packages/vscode/${latest}`);
  console.log(`${RULE}\n`);
};

if (isBeta) {
  const betaVersion = `${currentVersion}-beta.${Math.floor(Date.now() / 1000)}`;
  console.log(`${RULE}\n  rbxdev-ls BETA Build Pipeline\n${RULE}\n  Version: ${betaVersion}`);
  console.log('  Mode:    BETA (no permanent version bump)');

  step('Set beta metadata', () => {
    replaceField(rootPkg, 'version', betaVersion);
    replaceField(vscodePkg, 'version', betaVersion);
    replaceField(vscodePkg, 'displayName', `${extension.displayName} [BETA]`);
    replaceField(vscodePkg, 'description', `BETA BUILD - ${extension.description}`);
  });
  buildPackages();
  step('Package beta VSIX', () => run('npx vsce package --no-dependencies --no-git-tag-version', vscodeDir));
  step('Restore package.json files', () => {
    writeFileSync(rootPkg, rootPkgOriginal);
    writeFileSync(vscodePkg, vscodePkgOriginal);
  });
  reportVsix('BETA build complete! Distribute this file to beta testers.');
} else {
  const newVersion = bumpVersion(currentVersion, bump);
  console.log(
    `${RULE}\n  rbxdev-ls VSIX Build Pipeline\n${RULE}\n  Version: ${currentVersion} \u2192 ${newVersion} (${bump})`,
  );

  step('Bump version', () => {
    replaceField(rootPkg, 'version', newVersion);
    replaceField(vscodePkg, 'version', newVersion);
  });
  step('Type check', () => run('bun run type-check', rootDir));
  buildPackages();
  step('Package VSIX', () => run('npx vsce package --no-dependencies', vscodeDir));
  reportVsix('Build complete!');
}
