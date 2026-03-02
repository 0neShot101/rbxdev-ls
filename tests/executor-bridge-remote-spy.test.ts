import { readFileSync } from 'fs';
import path from 'path';

import { describe, expect, test } from 'bun:test';

describe('Executor Bridge Remote Spy Blocking', () => {
  const filePath = path.join(process.cwd(), 'scripts', 'executor-bridge.lua');
  const source = readFileSync(filePath, 'utf8');

  test('stores and acknowledges the remote spy block list', () => {
    expect(/local\s+remoteSpyBlockedNames\s*=\s*\{\}/.test(source)).toBe(true);
    expect(/local\s+remoteSpyBlockedPaths\s*=\s*\{\}/.test(source)).toBe(true);
    expect(/MESSAGE_HANDLERS\.setRemoteSpyBlockList\s*=\s*function\s*\(message\)/.test(source)).toBe(true);
    expect(/rebuildRemoteSpyBlockMaps\s*\(\s*message\.blocks\s*\)/.test(source)).toBe(true);
    expect(/sendResult\s*\(\s*'setRemoteSpyBlockListResult'\s*,\s*message\.id\s*,\s*true\s*\)/.test(source)).toBe(
      true,
    );
  });

  test('short-circuits blocked remotes before forwarding to the original namecall', () => {
    expect(/local\s+blocked\s*,\s*remoteName\s*,\s*remotePath\s*=\s*getRemoteBlockState\s*\(\s*self\s*\)/.test(source)).toBe(
      true,
    );
    expect(/if\s+blocked\s+then[\s\S]*?return\s+nil/.test(source)).toBe(true);
  });

  test('marks blocked remote spy notifications for the UI', () => {
    expect(/_blocked\s*=\s*blocked\s*==\s*true/.test(source)).toBe(true);
  });
});
