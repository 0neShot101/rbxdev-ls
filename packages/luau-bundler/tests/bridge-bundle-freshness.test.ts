import { readFileSync } from 'fs';
import { join } from 'path';

import { describe, expect, test } from 'bun:test';

import { bundle } from '@bundler/bundler';

const root = join(import.meta.dir, '..', '..', '..');
const bundlePath = join(root, 'scripts', 'executor-bridge.lua');

describe('scripts/executor-bridge.lua', () => {
  test('matches a fresh build of the checked-in executor bridge sources', () => {
    const normalize = (text: string): string => text.replace(/\r\n/g, '\n');
    const committed = normalize(readFileSync(bundlePath, 'utf8'));
    const built = normalize(
      bundle({
        'sourceDir': join(root, 'roblox', 'executor-bridge', 'src'),
        'header': 'rbxdev executor bridge',
      }).output,
    );

    expect(committed).toBe(built);
  });

  test('retains the committed socket-adoption dispatch and cleanup hooks', () => {
    const source = readFileSync(bundlePath, 'utf8');

    expect(source).toContain('bridge.dispatch = handleMessage');
    expect(source).toContain('bridge.onClose = onSocketClose');
    expect(source).toContain('gameTree.shutdownAutoRefresh()');
  });
});
