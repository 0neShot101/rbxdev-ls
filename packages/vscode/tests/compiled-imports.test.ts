import { join } from 'path';

import { expect, test } from 'bun:test';

const packageRoot = join(import.meta.dir, '..');

test('plain tsc output resolves its internal imports under Node', () => {
  const compiled = Bun.spawnSync([process.execPath, 'run', 'compile'], { 'cwd': packageRoot });

  if (compiled.exitCode !== 0) throw new Error(compiled.stdout.toString() + compiled.stderr.toString());

  const script = `
const { createRequire } = require('node:module');
const { resolve } = require('node:path');
const extensionRequire = createRequire(resolve('out/controllers/remoteSpy.js'));

for (const name of [
  '#extension/controllers/remoteSpy',
  '#extension/remoteSpyState',
  '#extension/remoteSpyWebview',
  '#extension/utils/guards',
]) console.log(extensionRequire.resolve(name));

const state = extensionRequire('#extension/remoteSpyState').createRemoteSpyState();
const guards = extensionRequire('#extension/utils/guards');

if (state.captureSource !== 'game' || guards.isRemoteSpySource('both') !== true)
  throw new Error('Compiled internal modules did not execute correctly');

console.log('compiled modules executed');
`;
  const runtime = Bun.spawnSync(['node', '-e', script], { 'cwd': packageRoot });

  if (runtime.exitCode !== 0) throw new Error(runtime.stdout.toString() + runtime.stderr.toString());

  const output = runtime.stdout.toString().replace(/\\/g, '/');
  expect(output).toContain('/out/controllers/remoteSpy.js');
  expect(output).toContain('/out/remoteSpyState.js');
  expect(output).toContain('/out/remoteSpyWebview.js');
  expect(output).toContain('/out/utils/guards.js');
  expect(output).toContain('compiled modules executed');
});
