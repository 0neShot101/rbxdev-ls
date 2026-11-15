/**
 * Copies the built language server, MCP server and definition data into the extension package. Packaging requires
 * the API dump, both documentation databases and their manifest so a release never ships without docs.
 */

import { cpSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

const REQUIRED_DATA = ['roblox-api.json', 'roblox-docs.json', 'luau-docs.json', 'manifest.json'];
const OPTIONAL_DATA = ['sunc-api.json'];

const vscodeDir = join(import.meta.dir, '..');
const serverPkgDir = join(vscodeDir, '..', 'server');
const mcpPkgDir = join(vscodeDir, '..', 'mcp');
const serverDir = join(vscodeDir, 'server');
const dataSource = join(serverPkgDir, 'data');
const dataDest = join(serverDir, 'data');

const missing = REQUIRED_DATA.filter(file => existsSync(join(dataSource, file)) === false);
if (missing.length > 0)
  throw new Error(
    `Missing definition data in ${dataSource}: ${missing.join(', ')}. Run \`bun run fetch-definitions\` from the repository root first.`,
  );

mkdirSync(serverDir, { 'recursive': true });
cpSync(join(serverPkgDir, 'dist', 'index.js'), join(serverDir, 'index.js'));
console.log('Copied packages/server/dist/index.js -> server/index.js');

cpSync(join(mcpPkgDir, 'dist', 'index.js'), join(serverDir, 'mcp.js'));
console.log('Copied packages/mcp/dist/index.js -> server/mcp.js');

rmSync(dataDest, { 'recursive': true, 'force': true });
mkdirSync(dataDest, { 'recursive': true });
for (const file of [...REQUIRED_DATA, ...OPTIONAL_DATA].filter(name => existsSync(join(dataSource, name))))
  cpSync(join(dataSource, file), join(dataDest, file));
console.log(`Copied definition data -> server/data/`);
