import { readFileSync } from 'fs';
import path from 'path';

import { describe, expect, test } from 'bun:test';

const extractLuaHandler = (source: string, handlerName: string): string => {
  const headerPattern = new RegExp(`MESSAGE_HANDLERS\\.${handlerName}\\s*=\\s*function\\s*\\(message\\)`);
  const headerMatch = headerPattern.exec(source);
  if (headerMatch === null || headerMatch.index === undefined) return '';

  const bodyStart = headerMatch.index + headerMatch[0].length;
  const nextHandlerMatch = /\nMESSAGE_HANDLERS\./g;
  nextHandlerMatch.lastIndex = bodyStart;
  const nextHandler = nextHandlerMatch.exec(source);
  const bodyEnd = nextHandler?.index ?? source.length;
  return source.slice(bodyStart, bodyEnd);
};

describe('Executor Bridge Remote Spy Blocking', () => {
  const filePath = path.join(import.meta.dir, '..', 'scripts', 'executor-bridge.lua');
  const source = readFileSync(filePath, 'utf8');
  const setRemoteSpyBlockListHandler = extractLuaHandler(source, 'setRemoteSpyBlockList');
  const setRemoteSpyEnabledHandler = extractLuaHandler(source, 'setRemoteSpyEnabled');

  test('stores and acknowledges the remote spy block list', () => {
    expect(/local\s+remoteSpyBlockedNames\s*=\s*\{\}/.test(source)).toBe(true);
    expect(/local\s+remoteSpyBlockedPaths\s*=\s*\{\}/.test(source)).toBe(true);
    expect(setRemoteSpyBlockListHandler).not.toBe('');
    expect(/rebuildRemoteSpyBlockMaps\s*\(\s*message\.blocks\s*\)/.test(setRemoteSpyBlockListHandler)).toBe(true);
    expect(
      /sendResult\s*\(\s*'setRemoteSpyBlockListResult'\s*,\s*message\.id\s*,\s*true\s*\)/.test(
        setRemoteSpyBlockListHandler,
      ),
    ).toBe(true);
  });

  test('short-circuits blocked remotes before forwarding to the original namecall', () => {
    expect(setRemoteSpyEnabledHandler).not.toBe('');
    expect(
      /local\s+blocked\s*,\s*remoteName\s*,\s*remotePath\s*=\s*getRemoteBlockState\s*\(\s*self\s*\)/.test(
        setRemoteSpyEnabledHandler,
      ),
    ).toBe(true);
    const blockedBranchMatch = setRemoteSpyEnabledHandler.match(/if\s+blocked\s+then([\s\S]*?)end/);
    const blockedBranch = blockedBranchMatch?.[1] ?? '';

    expect(blockedBranch).not.toBe('');
    expect(/return\s+nil/.test(blockedBranch)).toBe(true);
    expect(/oldNamecall\s*\(/.test(blockedBranch)).toBe(false);

    const blockedReturnIndex = setRemoteSpyEnabledHandler.indexOf('return nil');
    const forwardCallIndex = setRemoteSpyEnabledHandler.indexOf('return oldNamecall(self, ...)');
    expect(blockedReturnIndex).toBeGreaterThan(-1);
    expect(forwardCallIndex).toBeGreaterThan(-1);
    expect(blockedReturnIndex).toBeLessThan(forwardCallIndex);
  });

  test('marks blocked remote spy notifications for the UI', () => {
    expect(setRemoteSpyEnabledHandler).not.toBe('');
    expect(/_blocked\s*=\s*blocked\s*==\s*true/.test(setRemoteSpyEnabledHandler)).toBe(true);
  });
});
