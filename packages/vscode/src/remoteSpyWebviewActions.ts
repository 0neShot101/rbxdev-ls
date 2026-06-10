import type {
  RemoteSpyActionContext,
  RemoteSpyActionPayload,
  RemoteSpyActionResult,
  RemoteSpyListMode,
  RemoteSpyWebviewMessage,
} from '@typings/remoteSpy';

const createIndexedMessage = (
  type: 'copyCode' | 'copyPath' | 'copyArgs' | 'ignoreByPath' | 'ignoreByName' | 'blockByPath' | 'blockByName',
  selectedIndex: number,
): RemoteSpyWebviewMessage[] => {
  if (selectedIndex < 0) return [];
  return [{ type, 'index': selectedIndex }];
};

const isListMode = (value: string | null | undefined): value is Exclude<RemoteSpyListMode, null> =>
  value === 'ignores' || value === 'blocks';

const isEntryType = (value: string | null | undefined): value is 'name' | 'path' =>
  value === 'name' || value === 'path';

/**
 * Resolves a toolbar/context-menu action into webview messages and the next lists-panel mode.
 * @param context - Current UI state the action operates against.
 * @param payload - The action and any list/entry details it carries.
 * @returns The next panel mode and the messages to post to the webview.
 */
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
      if (isEntryType(payload.entryType) === false || payload.entryValue === undefined || payload.entryValue === null)
        return { 'nextListsMode': context.listsMode, 'messages': [] };
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
