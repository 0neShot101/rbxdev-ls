import { describe, expect, test } from 'bun:test';

import {
  addBlock,
  addCall,
  addIgnore,
  clearBlocks,
  clearCalls,
  clearIgnores,
  createRemoteSpyState,
  isCallBlocked,
  isCallIgnored,
  removeBlock,
  removeIgnore,
} from '../src/remoteSpyState';

import type { RemoteSpyCallEntry } from '../src/types/remoteSpy';

const makeCall = (overrides: Partial<RemoteSpyCallEntry> = {}): RemoteSpyCallEntry => ({
  'remoteName': 'ChatEvent',
  'remotePath': ['ReplicatedStorage', 'Events', 'ChatEvent'],
  'remoteType': 'RemoteEvent',
  'method': 'FireServer',
  'arguments': '"hello"',
  'code': 'remote:FireServer("hello")',
  'timestamp': 0,
  ...overrides,
});

describe('Remote Spy State - createRemoteSpyState', () => {
  test('creates an empty state with no selection', () => {
    expect(createRemoteSpyState()).toEqual({
      'calls': [],
      'ignoreList': [],
      'blockList': [],
      'paused': false,
      'selectedIndex': -1,
    });
  });
});

describe('Remote Spy State - addCall', () => {
  test('appends calls in order', () => {
    const state = createRemoteSpyState();
    addCall(state, makeCall({ 'remoteName': 'First' }));
    addCall(state, makeCall({ 'remoteName': 'Second' }));

    expect(state.calls.map(call => call.remoteName)).toEqual(['First', 'Second']);
  });

  test('evicts the oldest call once the cap of 1000 is exceeded', () => {
    const state = createRemoteSpyState();
    for (let i = 0; i <= 1000; i++) addCall(state, makeCall({ 'remoteName': `call-${i}` }));

    expect(state.calls.length).toBe(1000);
    expect(state.calls[0]?.remoteName).toBe('call-1');
    expect(state.calls[999]?.remoteName).toBe('call-1000');
  });
});

describe('Remote Spy State - isCallIgnored', () => {
  const call = makeCall({ 'remoteName': 'b', 'remotePath': ['a', 'b'] });

  test('matches by joined path', () => {
    expect(isCallIgnored(call, [{ 'type': 'path', 'value': 'a.b' }])).toBe(true);
  });

  test('matches by remote name', () => {
    expect(isCallIgnored(call, [{ 'type': 'name', 'value': 'b' }])).toBe(true);
  });

  test('returns false when nothing matches', () => {
    expect(
      isCallIgnored(call, [
        { 'type': 'path', 'value': 'a.c' },
        { 'type': 'name', 'value': 'c' },
      ]),
    ).toBe(false);
  });
});

describe('Remote Spy State - isCallBlocked', () => {
  const call = makeCall({ 'remoteName': 'b', 'remotePath': ['a', 'b'] });

  test('matches by joined path', () => {
    expect(isCallBlocked(call, [{ 'type': 'path', 'value': 'a.b' }])).toBe(true);
  });

  test('matches by remote name', () => {
    expect(isCallBlocked(call, [{ 'type': 'name', 'value': 'b' }])).toBe(true);
  });

  test('returns false when nothing matches', () => {
    expect(isCallBlocked(call, [{ 'type': 'path', 'value': 'a.b.c' }])).toBe(false);
  });
});

describe('Remote Spy State - ignore list', () => {
  test('addIgnore dedupes identical type and value pairs', () => {
    const state = createRemoteSpyState();
    addIgnore(state, { 'type': 'path', 'value': 'a.b' });
    addIgnore(state, { 'type': 'path', 'value': 'a.b' });

    expect(state.ignoreList).toEqual([{ 'type': 'path', 'value': 'a.b' }]);
  });

  test('addIgnore keeps entries that share a value but differ in type', () => {
    const state = createRemoteSpyState();
    addIgnore(state, { 'type': 'path', 'value': 'a.b' });
    addIgnore(state, { 'type': 'name', 'value': 'a.b' });

    expect(state.ignoreList.length).toBe(2);
  });

  test('removeIgnore removes only the exact match', () => {
    const state = createRemoteSpyState();
    addIgnore(state, { 'type': 'path', 'value': 'a.b' });
    addIgnore(state, { 'type': 'name', 'value': 'a.b' });
    removeIgnore(state, { 'type': 'path', 'value': 'a.b' });

    expect(state.ignoreList).toEqual([{ 'type': 'name', 'value': 'a.b' }]);
  });

  test('clearIgnores empties the list', () => {
    const state = createRemoteSpyState();
    addIgnore(state, { 'type': 'name', 'value': 'ChatEvent' });
    clearIgnores(state);

    expect(state.ignoreList).toEqual([]);
  });
});

describe('Remote Spy State - block list', () => {
  test('addBlock dedupes identical type and value pairs', () => {
    const state = createRemoteSpyState();
    addBlock(state, { 'type': 'name', 'value': 'ChatEvent' });
    addBlock(state, { 'type': 'name', 'value': 'ChatEvent' });

    expect(state.blockList).toEqual([{ 'type': 'name', 'value': 'ChatEvent' }]);
  });

  test('removeBlock removes only the exact match', () => {
    const state = createRemoteSpyState();
    addBlock(state, { 'type': 'path', 'value': 'a.b' });
    addBlock(state, { 'type': 'name', 'value': 'a.b' });
    removeBlock(state, { 'type': 'name', 'value': 'a.b' });

    expect(state.blockList).toEqual([{ 'type': 'path', 'value': 'a.b' }]);
  });

  test('clearBlocks empties the list', () => {
    const state = createRemoteSpyState();
    addBlock(state, { 'type': 'path', 'value': 'a.b' });
    clearBlocks(state);

    expect(state.blockList).toEqual([]);
  });
});

describe('Remote Spy State - clearCalls', () => {
  test('drops all calls and resets the selection', () => {
    const state = createRemoteSpyState();
    addCall(state, makeCall());
    state.selectedIndex = 0;
    clearCalls(state);

    expect(state.calls).toEqual([]);
    expect(state.selectedIndex).toBe(-1);
  });
});
