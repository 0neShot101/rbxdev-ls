/**
 * Cross-platform script to copy server files into the extension
 */

import { cpSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const vscodeDir = join(import.meta.dir, '..');
const rootDir = join(vscodeDir, '..');
const serverDir = join(vscodeDir, 'server');

// Ensure server directory exists
if (!existsSync(serverDir)) {
  mkdirSync(serverDir, { recursive: true });
}

// Copy the bundled server
cpSync(join(rootDir, 'dist', 'index.js'), join(serverDir, 'index.js'));
console.log('Copied dist/index.js -> server/index.js');

// Copy the data directory
const dataSource = join(rootDir, 'data');
const dataDest = join(serverDir, 'data');

if (existsSync(dataSource)) {
  cpSync(dataSource, dataDest, { recursive: true });
  console.log('Copied data/ -> server/data/');
}

console.log('Server files copied successfully');
