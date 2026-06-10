/**
 * Remote Spy State Management
 * Pure state container and mutators for the remote spy panel.
 */

import type { BlockEntry, IgnoreEntry, ListEntry, RemoteSpyCallEntry, RemoteSpyState } from '@typings/remoteSpy';

const MAX_CALLS = 1000;

const matches = (a: ListEntry, b: ListEntry): boolean => a.type === b.type && a.value === b.value;

const hasEntry = (list: ReadonlyArray<ListEntry>, entry: ListEntry): boolean =>
  list.some(existing => matches(existing, entry));

const withoutEntry = <T extends ListEntry>(list: ReadonlyArray<T>, entry: T): T[] =>
  list.filter(existing => matches(existing, entry) === false);

/**
 * Creates an empty remote spy state.
 * @returns A fresh state with no calls, lists, or selection.
 */
export const createRemoteSpyState = (): RemoteSpyState => ({
  'calls': [],
  'ignoreList': [],
  'blockList': [],
  'paused': false,
  'selectedIndex': -1,
});

/**
 * Checks whether a call matches any ignore entry by path or name.
 * @param call - The intercepted remote call.
 * @param ignoreList - The active ignore entries.
 * @returns True when the call should be hidden from the list.
 */
export const isCallIgnored = (call: RemoteSpyCallEntry, ignoreList: ReadonlyArray<IgnoreEntry>): boolean => {
  const callPath = call.remotePath.join('.');
  for (const entry of ignoreList) {
    if (entry.type === 'path' && callPath === entry.value) return true;
    if (entry.type === 'name' && call.remoteName === entry.value) return true;
  }
  return false;
};

/**
 * Checks whether a call matches any block entry by path or name.
 * @param call - The intercepted remote call.
 * @param blockList - The active block entries.
 * @returns True when the call should be blocked from firing.
 */
export const isCallBlocked = (call: RemoteSpyCallEntry, blockList: ReadonlyArray<BlockEntry>): boolean => {
  const callPath = call.remotePath.join('.');
  for (const entry of blockList) {
    if (entry.type === 'path' && callPath === entry.value) return true;
    if (entry.type === 'name' && call.remoteName === entry.value) return true;
  }
  return false;
};

/**
 * Appends a call to the state, evicting the oldest once the cap is reached.
 * @param state - The state to mutate.
 * @param call - The call to record.
 */
export const addCall = (state: RemoteSpyState, call: RemoteSpyCallEntry): void => {
  state.calls.push(call);
  if (state.calls.length > MAX_CALLS) state.calls.shift();
};

/**
 * Adds an ignore entry unless an identical one already exists.
 * @param state - The state to mutate.
 * @param entry - The ignore entry to add.
 */
export const addIgnore = (state: RemoteSpyState, entry: IgnoreEntry): void => {
  if (hasEntry(state.ignoreList, entry)) return;
  state.ignoreList.push(entry);
};

/**
 * Removes a matching ignore entry.
 * @param state - The state to mutate.
 * @param entry - The ignore entry to remove.
 */
export const removeIgnore = (state: RemoteSpyState, entry: IgnoreEntry): void =>
  void (state.ignoreList = withoutEntry(state.ignoreList, entry));

/**
 * Adds a block entry unless an identical one already exists.
 * @param state - The state to mutate.
 * @param entry - The block entry to add.
 */
export const addBlock = (state: RemoteSpyState, entry: BlockEntry): void => {
  if (hasEntry(state.blockList, entry)) return;
  state.blockList.push(entry);
};

/**
 * Removes a matching block entry.
 * @param state - The state to mutate.
 * @param entry - The block entry to remove.
 */
export const removeBlock = (state: RemoteSpyState, entry: BlockEntry): void =>
  void (state.blockList = withoutEntry(state.blockList, entry));

/**
 * Clears all ignore entries.
 * @param state - The state to mutate.
 */
export const clearIgnores = (state: RemoteSpyState): void => void (state.ignoreList = []);

/**
 * Clears all block entries.
 * @param state - The state to mutate.
 */
export const clearBlocks = (state: RemoteSpyState): void => void (state.blockList = []);

/**
 * Clears all recorded calls and resets the selection.
 * @param state - The state to mutate.
 */
export const clearCalls = (state: RemoteSpyState): void => {
  state.calls = [];
  state.selectedIndex = -1;
};
