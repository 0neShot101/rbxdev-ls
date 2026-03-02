import { readFileSync } from 'fs';
import path from 'path';

import { describe, expect, test } from 'bun:test';

import { dispatchRemoteSpyAction } from '../vscode/src/remoteSpyWebviewActions';

describe('Remote Spy Webview - Markup Regression', () => {
  test('webview does not use inline event handlers', () => {
    const filePath = path.join(process.cwd(), 'vscode', 'src', 'remoteSpyWebview.ts');
    const source = readFileSync(filePath, 'utf8');

    expect(/\bonclick\s*=/i.test(source)).toBe(false);
    expect(/\boninput\s*=/i.test(source)).toBe(false);
    expect(/<button[^>]*\bdata-action\s*=\s*"copyCode"/i.test(source)).toBe(true);
    expect(/<button[^>]*\bdata-action\s*=\s*"copyPath"/i.test(source)).toBe(true);
    expect(/<button[^>]*\bdata-action\s*=\s*"copyArgs"/i.test(source)).toBe(true);
  });
});

describe('Remote Spy Webview - Action Dispatch', () => {
  const baseContext = {
    'selectedIndex': 3,
    'paused': false,
    'spyEnabled': false,
    'listsMode': null as 'ignores' | 'blocks' | null,
  };

  test('toggleSpy enables the spy when it is currently disabled', () => {
    const result = dispatchRemoteSpyAction(baseContext, { 'action': 'toggleSpy' });
    expect(result.messages).toEqual([{ 'type': 'toggleSpy', 'enabled': true }]);
  });

  test('togglePause pauses when active and resumes when paused', () => {
    expect(dispatchRemoteSpyAction(baseContext, { 'action': 'togglePause' }).messages).toEqual([{ 'type': 'pause' }]);
    expect(dispatchRemoteSpyAction({ ...baseContext, 'paused': true }, { 'action': 'togglePause' }).messages).toEqual([
      { 'type': 'resume' },
    ]);
  });

  test('clearCalls sends clear message', () => {
    const result = dispatchRemoteSpyAction(baseContext, { 'action': 'clearCalls' });
    expect(result.messages).toEqual([{ 'type': 'clear' }]);
  });

  test('toggleListsPanel opens and closes ignore and block panels', () => {
    expect(
      dispatchRemoteSpyAction(baseContext, { 'action': 'toggleListsPanel', 'listMode': 'ignores' }).nextListsMode,
    ).toBe('ignores');
    expect(
      dispatchRemoteSpyAction(
        { ...baseContext, 'listsMode': 'ignores' },
        { 'action': 'toggleListsPanel', 'listMode': 'ignores' },
      ).nextListsMode,
    ).toBe(null);
    expect(
      dispatchRemoteSpyAction(
        { ...baseContext, 'listsMode': 'ignores' },
        { 'action': 'toggleListsPanel', 'listMode': 'blocks' },
      ).nextListsMode,
    ).toBe('blocks');
  });

  describe('Copy Actions', () => {
    test('copyCode targets the selected call', () => {
      const result = dispatchRemoteSpyAction(baseContext, { 'action': 'copyCode' });
      expect(result.messages).toEqual([{ 'type': 'copyCode', 'index': 3 }]);
    });

    test('copyPath targets the selected call', () => {
      const result = dispatchRemoteSpyAction(baseContext, { 'action': 'copyPath' });
      expect(result.messages).toEqual([{ 'type': 'copyPath', 'index': 3 }]);
    });

    test('copyArgs targets the selected call', () => {
      const result = dispatchRemoteSpyAction(baseContext, { 'action': 'copyArgs' });
      expect(result.messages).toEqual([{ 'type': 'copyArgs', 'index': 3 }]);
    });
  });

  test('ignore and block actions target the selected call', () => {
    expect(dispatchRemoteSpyAction(baseContext, { 'action': 'ignoreByPath' }).messages).toEqual([
      { 'type': 'ignoreByPath', 'index': 3 },
    ]);
    expect(dispatchRemoteSpyAction(baseContext, { 'action': 'ignoreByName' }).messages).toEqual([
      { 'type': 'ignoreByName', 'index': 3 },
    ]);
    expect(dispatchRemoteSpyAction(baseContext, { 'action': 'blockByPath' }).messages).toEqual([
      { 'type': 'blockByPath', 'index': 3 },
    ]);
    expect(dispatchRemoteSpyAction(baseContext, { 'action': 'blockByName' }).messages).toEqual([
      { 'type': 'blockByName', 'index': 3 },
    ]);
  });

  test('selection-dependent actions do nothing when no call is selected', () => {
    const noSelection = { ...baseContext, 'selectedIndex': -1 };

    expect(dispatchRemoteSpyAction(noSelection, { 'action': 'copyCode' }).messages).toEqual([]);
    expect(dispatchRemoteSpyAction(noSelection, { 'action': 'copyPath' }).messages).toEqual([]);
    expect(dispatchRemoteSpyAction(noSelection, { 'action': 'copyArgs' }).messages).toEqual([]);
    expect(dispatchRemoteSpyAction(noSelection, { 'action': 'ignoreByPath' }).messages).toEqual([]);
    expect(dispatchRemoteSpyAction(noSelection, { 'action': 'ignoreByName' }).messages).toEqual([]);
    expect(dispatchRemoteSpyAction(noSelection, { 'action': 'blockByPath' }).messages).toEqual([]);
    expect(dispatchRemoteSpyAction(noSelection, { 'action': 'blockByName' }).messages).toEqual([]);
  });

  test('clear list actions emit their corresponding messages', () => {
    expect(dispatchRemoteSpyAction(baseContext, { 'action': 'clearIgnores' }).messages).toEqual([
      { 'type': 'clearIgnores' },
    ]);
    expect(dispatchRemoteSpyAction(baseContext, { 'action': 'clearBlocks' }).messages).toEqual([
      { 'type': 'clearBlocks' },
    ]);
  });

  test('remove actions preserve the entry payload', () => {
    expect(
      dispatchRemoteSpyAction(baseContext, {
        'action': 'removeIgnore',
        'entryType': 'path',
        'entryValue': 'ReplicatedStorage.Events.ChatEvent',
      }).messages,
    ).toEqual([
      {
        'type': 'removeIgnore',
        'entry': { 'type': 'path', 'value': 'ReplicatedStorage.Events.ChatEvent' },
      },
    ]);

    expect(
      dispatchRemoteSpyAction(baseContext, {
        'action': 'removeBlock',
        'entryType': 'name',
        'entryValue': 'ChatEvent',
      }).messages,
    ).toEqual([
      {
        'type': 'removeBlock',
        'entry': { 'type': 'name', 'value': 'ChatEvent' },
      },
    ]);
  });

  test('remove actions reject invalid entry payloads', () => {
    expect(
      dispatchRemoteSpyAction(baseContext, {
        'action': 'removeIgnore',
        'entryType': 'invalid',
        'entryValue': 'BadEntry',
      }).messages,
    ).toEqual([]);

    expect(
      dispatchRemoteSpyAction(baseContext, {
        'action': 'removeBlock',
        'entryType': 'path',
        'entryValue': null,
      }).messages,
    ).toEqual([]);
  });
});
