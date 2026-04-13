import { readFileSync } from 'fs';
import path from 'path';

import { describe, expect, test } from 'bun:test';

const srcDir = path.join(import.meta.dir, '..', '..', '..', 'roblox', 'executor-bridge', 'src');
const remoteSpySource = readFileSync(path.join(srcDir, 'handlers', 'remoteSpy.luau'), 'utf8');
const stateSource = readFileSync(path.join(srcDir, 'state.luau'), 'utf8');
const allSource = remoteSpySource + stateSource;

describe('Executor Bridge Remote Spy Blocking', () => {
  test('stores and acknowledges the remote spy block list', () => {
    expect(/remoteSpyBlockedNames\s*=\s*\{\}/.test(allSource)).toBe(true);
    expect(/remoteSpyBlockedPaths\s*=\s*\{\}/.test(allSource)).toBe(true);
    expect(/rebuildRemoteSpyBlockMaps/.test(remoteSpySource)).toBe(true);
    expect(/sendResult/.test(remoteSpySource)).toBe(true);
  });

  test('short-circuits blocked remotes before forwarding to the original namecall', () => {
    expect(/getRemoteBlockState/.test(remoteSpySource)).toBe(true);
    expect(/return\s+nil/.test(remoteSpySource)).toBe(true);
    expect(/oldNamecall\s*\(/.test(remoteSpySource)).toBe(true);

    const blockedReturnIndex = remoteSpySource.indexOf('return nil');
    const forwardCallIndex = remoteSpySource.indexOf('oldNamecall(self');
    expect(blockedReturnIndex).toBeGreaterThan(-1);
    expect(forwardCallIndex).toBeGreaterThan(-1);
    expect(blockedReturnIndex).toBeLessThan(forwardCallIndex);
  });

  test('marks blocked remote spy notifications for the UI', () => {
    expect(/_blocked\s*=/.test(remoteSpySource)).toBe(true);
  });
});
