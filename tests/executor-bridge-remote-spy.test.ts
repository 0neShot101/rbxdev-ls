import { readFileSync } from 'fs';
import path from 'path';

import { describe, expect, test } from 'bun:test';

describe('Executor Bridge Remote Spy Blocking', () => {
  const filePath = path.join(process.cwd(), 'scripts', 'executor-bridge.lua');
  const source = readFileSync(filePath, 'utf8');

  test('stores and acknowledges the remote spy block list', () => {
    expect(source.includes('local remoteSpyBlockedNames = {}')).toBe(true);
    expect(source.includes('local remoteSpyBlockedPaths = {}')).toBe(true);
    expect(source.includes('MESSAGE_HANDLERS.setRemoteSpyBlockList = function(message)')).toBe(true);
    expect(source.includes("rebuildRemoteSpyBlockMaps(message.blocks)")).toBe(true);
    expect(source.includes("sendResult('setRemoteSpyBlockListResult', message.id, true)")).toBe(true);
  });

  test('short-circuits blocked remotes before forwarding to the original namecall', () => {
    expect(source.includes('local blocked, remoteName, remotePath = getRemoteBlockState(self)')).toBe(true);
    expect(source.includes('if blocked then')).toBe(true);
    expect(source.includes('return nil')).toBe(true);
  });

  test('marks blocked remote spy notifications for the UI', () => {
    expect(source.includes('_blocked = blocked == true')).toBe(true);
  });
});
