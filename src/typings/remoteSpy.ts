import type { RemoteSpyCall } from './protocol';

export interface RemoteSpyIgnoreEntry {
  readonly type: 'path' | 'name';
  readonly value: string;
}

export interface RemoteSpyBlockEntry {
  readonly type: 'path' | 'name';
  readonly value: string;
}

export interface RemoteSpyState {
  calls: RemoteSpyCall[];
  ignoreList: RemoteSpyIgnoreEntry[];
  blockList: RemoteSpyBlockEntry[];
  paused: boolean;
  selectedIndex: number;
}
