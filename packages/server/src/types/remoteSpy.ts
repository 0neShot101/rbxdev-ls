import type { RemoteSpyCall } from '@typings/protocol';

/** Remote matched by instance path or name whose calls are hidden from the spy log. */
export interface RemoteSpyIgnoreEntry {
  readonly type: 'path' | 'name';
  readonly value: string;
}

/** Remote matched by instance path or name whose calls the spy blocks. */
export interface RemoteSpyBlockEntry {
  readonly type: 'path' | 'name';
  readonly value: string;
}

/** Mutable Remote Spy view state: captured calls, ignore/block filters, pause flag, and selection. */
export interface RemoteSpyState {
  calls: RemoteSpyCall[];
  ignoredEntries: RemoteSpyIgnoreEntry[];
  blockedEntries: RemoteSpyBlockEntry[];
  isPaused: boolean;
  selectedIndex: number;
}
