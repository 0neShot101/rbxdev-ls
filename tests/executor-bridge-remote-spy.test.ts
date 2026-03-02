import { readFileSync } from 'fs';
import path from 'path';

import { describe, expect, test } from 'bun:test';

describe('Executor Bridge Remote Spy Blocking', () => {
  const filePath = path.join(import.meta.dir, '..', 'scripts', 'executor-bridge.lua');
  const source = readFileSync(filePath, 'utf8');
  const setRemoteSpyBlockListHandlerMatch = source.match(
    /MESSAGE_HANDLERS\.setRemoteSpyBlockList\s*=\s*function\s*\(message\)([\s\S]*?)\nend/,
  );
  const setRemoteSpyEnabledHandlerMatch = source.match(
    /MESSAGE_HANDLERS\.setRemoteSpyEnabled\s*=\s*function\s*\(message\)([\s\S]*?)\nend/,
  );
  const setRemoteSpyBlockListHandler = setRemoteSpyBlockListHandlerMatch?.[1] ?? '';
  const setRemoteSpyEnabledHandler = setRemoteSpyEnabledHandlerMatch?.[1] ?? '';

  test('stores and acknowledges the remote spy block list', () => {
    expect(/local\s+remoteSpyBlockedNames\s*=\s*\{\}/.test(source)).toBe(true);
    expect(/local\s+remoteSpyBlockedPaths\s*=\s*\{\}/.test(source)).toBe(true);
    expect(setRemoteSpyBlockListHandlerMatch).toBeTruthy();
    expect(/rebuildRemoteSpyBlockMaps\s*\(\s*message\.blocks\s*\)/.test(setRemoteSpyBlockListHandler)).toBe(true);
    expect(
      /sendResult\s*\(\s*'setRemoteSpyBlockListResult'\s*,\s*message\.id\s*,\s*true\s*\)/.test(
        setRemoteSpyBlockListHandler,
      ),
    ).toBe(true);
  });

  test('short-circuits blocked remotes before forwarding to the original namecall', () => {
    expect(setRemoteSpyEnabledHandlerMatch).toBeTruthy();
    expect(
      /local\s+blocked\s*,\s*remoteName\s*,\s*remotePath\s*=\s*getRemoteBlockState\s*\(\s*self\s*\)/.test(
        setRemoteSpyEnabledHandler,
      ),
    ).toBe(true);
    expect(/if\s+blocked\s+then[\s\S]*?return\s+nil/.test(setRemoteSpyEnabledHandler)).toBe(true);
  });

  test('marks blocked remote spy notifications for the UI', () => {
    expect(setRemoteSpyEnabledHandlerMatch).toBeTruthy();
    expect(/_blocked\s*=\s*blocked\s*==\s*true/.test(setRemoteSpyEnabledHandler)).toBe(true);
  });
});
