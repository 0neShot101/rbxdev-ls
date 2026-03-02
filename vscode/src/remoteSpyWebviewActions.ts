import type { BlockEntry, IgnoreEntry } from './remoteSpyState';

export type RemoteSpyWebviewAction =
  | 'toggleSpy'
  | 'togglePause'
  | 'clearCalls'
  | 'toggleListsPanel'
  | 'copyCode'
  | 'copyPath'
  | 'copyArgs'
  | 'ignoreByPath'
  | 'ignoreByName'
  | 'blockByPath'
  | 'blockByName'
  | 'clearIgnores'
  | 'clearBlocks'
  | 'removeIgnore'
  | 'removeBlock';

export type RemoteSpyListMode = 'ignores' | 'blocks' | null;

export interface RemoteSpyWebviewMessage {
  readonly type:
    | 'selectCall'
    | 'copyCode'
    | 'copyPath'
    | 'copyArgs'
    | 'ignoreByPath'
    | 'ignoreByName'
    | 'blockByPath'
    | 'blockByName'
    | 'clearIgnores'
    | 'clearBlocks'
    | 'pause'
    | 'resume'
    | 'toggleSpy'
    | 'search'
    | 'clear'
    | 'removeIgnore'
    | 'removeBlock';
  readonly index?: number;
  readonly query?: string;
  readonly enabled?: boolean;
  readonly entry?: IgnoreEntry | BlockEntry;
}

export interface RemoteSpyActionContext {
  readonly selectedIndex: number;
  readonly paused: boolean;
  readonly spyEnabled: boolean;
  readonly listsMode: RemoteSpyListMode;
}

export interface RemoteSpyActionPayload {
  readonly action: RemoteSpyWebviewAction;
  readonly listMode?: string | null;
  readonly entryType?: string | null;
  readonly entryValue?: string | null;
}

export interface RemoteSpyActionResult {
  readonly nextListsMode: RemoteSpyListMode;
  readonly messages: ReadonlyArray<RemoteSpyWebviewMessage>;
}

const createIndexedMessage = (
  type: 'copyCode' | 'copyPath' | 'copyArgs' | 'ignoreByPath' | 'ignoreByName' | 'blockByPath' | 'blockByName',
  selectedIndex: number,
): RemoteSpyWebviewMessage[] => {
  if (selectedIndex < 0) return [];
  return [{ type, 'index': selectedIndex }];
};

const isListMode = (value: string | null | undefined): value is Exclude<RemoteSpyListMode, null> =>
  value === 'ignores' || value === 'blocks';

const isEntryType = (value: string | null | undefined): value is 'name' | 'path' => value === 'name' || value === 'path';

export const dispatchRemoteSpyAction = (
  context: RemoteSpyActionContext,
  payload: RemoteSpyActionPayload,
): RemoteSpyActionResult => {
  switch (payload.action) {
    case 'toggleSpy':
      return {
        'nextListsMode': context.listsMode,
        'messages': [{ 'type': 'toggleSpy', 'enabled': context.spyEnabled === false }],
      };
    case 'togglePause':
      return {
        'nextListsMode': context.listsMode,
        'messages': [{ 'type': context.paused ? 'resume' : 'pause' }],
      };
    case 'clearCalls':
      return {
        'nextListsMode': context.listsMode,
        'messages': [{ 'type': 'clear' }],
      };
    case 'toggleListsPanel': {
      const nextListsMode =
        isListMode(payload.listMode) && context.listsMode !== payload.listMode ? payload.listMode : null;
      return { nextListsMode, 'messages': [] };
    }
    case 'copyCode':
    case 'copyPath':
    case 'copyArgs':
    case 'ignoreByPath':
    case 'ignoreByName':
    case 'blockByPath':
    case 'blockByName':
      return {
        'nextListsMode': context.listsMode,
        'messages': createIndexedMessage(payload.action, context.selectedIndex),
      };
    case 'clearIgnores':
      return {
        'nextListsMode': context.listsMode,
        'messages': [{ 'type': 'clearIgnores' }],
      };
    case 'clearBlocks':
      return {
        'nextListsMode': context.listsMode,
        'messages': [{ 'type': 'clearBlocks' }],
      };
    case 'removeIgnore':
    case 'removeBlock': {
      if (isEntryType(payload.entryType) === false || payload.entryValue === undefined || payload.entryValue === null) {
        return { 'nextListsMode': context.listsMode, 'messages': [] };
      }
      return {
        'nextListsMode': context.listsMode,
        'messages': [
          {
            'type': payload.action,
            'entry': {
              'type': payload.entryType,
              'value': payload.entryValue,
            },
          },
        ],
      };
    }
  }
};
