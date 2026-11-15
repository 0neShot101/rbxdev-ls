import { expect, mock, test } from 'bun:test';

import { createRemoteSpyState } from '@extension/remoteSpyState';
import { extensionUri } from '@tests/helpers/remoteSpy';

import type { ToWebviewMessage } from '@typings/remoteSpy';

const posted: ToWebviewMessage[][] = [];
const closers: Array<() => void> = [];
const delivered = Promise.withResolvers<void>();
void mock.module('vscode', () => ({
  'ViewColumn': { 'One': 1 },
  'window': {
    'createWebviewPanel': () => {
      const messages: ToWebviewMessage[] = [];
      posted.push(messages);
      let close = (): void => {};
      return {
        'webview': {
          'html': '',
          'cspSource': 'test',
          'postMessage': (message: ToWebviewMessage) => {
            messages.push(message);
            if (message.type === 'addCall' && message.call?.remoteName === 'NewEvent') delivered.resolve();
          },
          'onDidReceiveMessage': () => ({ 'dispose': () => {} }),
        },
        'reveal': () => {},
        'onDidDispose': (callback: () => void) => {
          close = callback;
          closers.push(callback);
          return { 'dispose': () => {} };
        },
        'dispose': () => close(),
      };
    },
  },
}));

/** Load after installing the VS Code mock; this fixture tests the module boundary. */
const { RemoteSpyPanel } = await import('@extension/remoteSpyWebview');

test('closing during a pending batch does not stall calls after reopening', async () => {
  const panel = new RemoteSpyPanel({ extensionUri });
  const state = createRemoteSpyState();
  const call = {
    'remoteName': 'Event',
    'remotePath': ['ReplicatedStorage', 'Event'],
    'remoteType': 'RemoteEvent',
    'method': 'FireServer',
    'arguments': '',
    'code': '',
    'timestamp': 0,
  };
  try {
    panel.show(state, true);
    panel.addCall(call, 0);
    closers[0]?.();
    panel.show(state, true);
    panel.addCall({ ...call, 'remoteName': 'ClearedEvent' }, 0);
    panel.clear();
    panel.addCall({ ...call, 'remoteName': 'SnapshottedEvent' }, 0);
    panel.sendFullState(state, true);
    panel.addCall({ ...call, 'remoteName': 'NewEvent' }, 1);
    await delivered.promise;
    expect(posted[0]).toEqual([]);
    const additions = posted[1]?.filter(message => message.type === 'addCall');
    expect(additions).toEqual([{ 'type': 'addCall', 'call': { ...call, 'remoteName': 'NewEvent', 'index': 1 } }]);
  } finally {
    panel.dispose();
  }
});
