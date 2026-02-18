/**
 * Remote Spy State Management
 * Mirrors interfaces from src/@typings/remoteSpy.ts for the vscode extension build
 */

/** Mirrors RemoteSpyCall from src/@typings/protocol.ts */
export interface RemoteSpyCallEntry {
  readonly remoteName: string;
  readonly remotePath: ReadonlyArray<string>;
  readonly remoteType: string;
  readonly method: string;
  readonly arguments: string;
  readonly code: string;
  readonly timestamp: number;
}

/** Mirrors RemoteSpyIgnoreEntry from src/@typings/remoteSpy.ts */
export interface IgnoreEntry {
  readonly type: 'path' | 'name';
  readonly value: string;
}

/** Mirrors RemoteSpyBlockEntry from src/@typings/remoteSpy.ts */
export interface BlockEntry {
  readonly type: 'path' | 'name';
  readonly value: string;
}

/** Mirrors RemoteSpyState from src/@typings/remoteSpy.ts */
export interface RemoteSpyState {
  calls: RemoteSpyCallEntry[];
  ignoreList: IgnoreEntry[];
  blockList: BlockEntry[];
  paused: boolean;
  selectedIndex: number;
}

const MAX_CALLS = 1000;

export const createRemoteSpyState = (): RemoteSpyState => ({
  'calls': [],
  'ignoreList': [],
  'blockList': [],
  'paused': false,
  'selectedIndex': -1,
});

export const isCallIgnored = (call: RemoteSpyCallEntry, ignoreList: ReadonlyArray<IgnoreEntry>): boolean => {
  const callPath = call.remotePath.join('.');
  for (const entry of ignoreList) {
    if (entry.type === 'path' && callPath === entry.value) return true;
    if (entry.type === 'name' && call.remoteName === entry.value) return true;
  }
  return false;
};

export const isCallBlocked = (call: RemoteSpyCallEntry, blockList: ReadonlyArray<BlockEntry>): boolean => {
  const callPath = call.remotePath.join('.');
  for (const entry of blockList) {
    if (entry.type === 'path' && callPath === entry.value) return true;
    if (entry.type === 'name' && call.remoteName === entry.value) return true;
  }
  return false;
};

export const addCall = (state: RemoteSpyState, call: RemoteSpyCallEntry): void => {
  state.calls.push(call);
  if (state.calls.length > MAX_CALLS) state.calls.shift();
};

export const addIgnore = (state: RemoteSpyState, entry: IgnoreEntry): void => {
  const exists = state.ignoreList.some(e => e.type === entry.type && e.value === entry.value);
  if (exists) return;
  state.ignoreList.push(entry);
};

export const removeIgnore = (state: RemoteSpyState, entry: IgnoreEntry): void => {
  state.ignoreList = state.ignoreList.filter(e => e.type !== entry.type || e.value !== entry.value);
};

export const addBlock = (state: RemoteSpyState, entry: BlockEntry): void => {
  const exists = state.blockList.some(e => e.type === entry.type && e.value === entry.value);
  if (exists) return;
  state.blockList.push(entry);
};

export const removeBlock = (state: RemoteSpyState, entry: BlockEntry): void => {
  state.blockList = state.blockList.filter(e => e.type !== entry.type || e.value !== entry.value);
};

export const clearIgnores = (state: RemoteSpyState): void => {
  state.ignoreList = [];
};

export const clearBlocks = (state: RemoteSpyState): void => {
  state.blockList = [];
};

export const clearCalls = (state: RemoteSpyState): void => {
  state.calls = [];
  state.selectedIndex = -1;
};
