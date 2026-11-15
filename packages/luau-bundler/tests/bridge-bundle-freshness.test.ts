/**
 * Freshness guard for the published bridge bootstrap.
 *
 * `scripts/executor-bridge.lua` is what users load with `loadstring(...)`, so a
 * stale copy ships old bridge code to every client while the sources look
 * correct. The bundle is deterministic, so the committed file must equal a
 * fresh build of `roblox/executor-bridge/src` with the same header used by
 * `bun run build:bridge`.
 *
 * Fix a failure with: bun run build:bridge
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { describe, expect, test } from 'bun:test';

import { bundle } from '@bundler/index';

const repoRoot = join(import.meta.dir, '..', '..', '..');
const bundlePath = join(repoRoot, 'scripts', 'executor-bridge.lua');

describe('scripts/executor-bridge.lua', () => {
  test('matches a fresh build of roblox/executor-bridge/src', () => {
    const normalizeLineEndings = (text: string): string => text.replace(/\r\n/g, '\n');
    const committed = normalizeLineEndings(readFileSync(bundlePath, 'utf8'));
    const built = normalizeLineEndings(
      bundle({
        'sourceDir': join(repoRoot, 'roblox', 'executor-bridge', 'src'),
        'header': 'rbxdev executor bridge',
      }).output,
    );

    expect(committed).toBe(built);
  });

  test('carries the socket-adoption hooks the reload path depends on', () => {
    const committed = readFileSync(bundlePath, 'utf8');

    expect(committed).toContain('state.bindHandlers(handleMessage, onSocketClose)');
    expect(committed).toContain('bridge.dispatch = handleMessage');
    expect(committed).toContain('bridge.onClose = onSocketClose');
    expect(committed).toContain('bridge.onClose');
    expect(committed).toContain('gameTree.shutdownAutoRefresh()');
  });
});
