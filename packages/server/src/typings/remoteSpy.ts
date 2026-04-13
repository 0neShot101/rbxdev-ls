import type { RemoteSpyCall } from '@typings/protocol';

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
  ignoredEntries: RemoteSpyIgnoreEntry[];
  blockedEntries: RemoteSpyBlockEntry[];
  isPaused: boolean;
  selectedIndex: number;
}
