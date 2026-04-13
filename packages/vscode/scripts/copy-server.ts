/**
 * Cross-platform script to copy server files into the extension
 */

import { cpSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const vscodeDir = join(import.meta.dir, '..');
const serverPkgDir = join(vscodeDir, '..', 'server');
const mcpPkgDir = join(vscodeDir, '..', 'mcp');
const serverDir = join(vscodeDir, 'server');

if (existsSync(serverDir) === false) {
  mkdirSync(serverDir, { 'recursive': true });
}

cpSync(join(serverPkgDir, 'dist', 'index.js'), join(serverDir, 'index.js'));
console.log('Copied packages/server/dist/index.js -> server/index.js');

cpSync(join(mcpPkgDir, 'dist', 'index.js'), join(serverDir, 'mcp.js'));
console.log('Copied packages/mcp/dist/index.js -> server/mcp.js');

const dataSource = join(serverPkgDir, 'data');
const dataDest = join(serverDir, 'data');

if (existsSync(dataSource)) {
  cpSync(dataSource, dataDest, { 'recursive': true });
  console.log('Copied data/ -> server/data/');
}

console.log('Server files copied successfully');
