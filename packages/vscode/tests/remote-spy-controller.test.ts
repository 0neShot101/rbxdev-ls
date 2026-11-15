import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

import { extensionUri } from '@tests/helpers/remoteSpy';

import type {
  MessageListener,
  RequestHandler,
  SpyCommand,
  SpyHandlers,
  SpyRequest,
  SpyRequestMethod,
  WebviewHarness,
} from '@tests/types/remoteSpy';
import type { RemoteSpyClient, ToWebviewMessage } from '@typings/remoteSpy';

const registeredCommands = new Map<string, SpyCommand>();
const showErrorMessage = mock((_message: string) => undefined);
const showInformationMessage = mock((_message: string) => undefined);
const statusBar = {
  'text': '',
  'tooltip': '',
  'command': '',
  'backgroundColor': undefined,
  'show': () => undefined,
  'dispose': () => undefined,
};

/** Fake of the webview panel the real RemoteSpyPanel creates; records posts and exposes the message listener. */
const webview: WebviewHarness = {
  'created': 0,
  'posted': [],
  'receive': undefined,
  'disposeListeners': [],
};

const createWebviewPanel = () => {
  webview.created += 1;
  return {
    'iconPath': undefined,
    'reveal': () => undefined,
    'webview': {
      'html': '',
      'cspSource': '',
      'postMessage': async (message: ToWebviewMessage) => void webview.posted.push(message),
      'onDidReceiveMessage': (listener: MessageListener) => {
        webview.receive = listener;
        return { 'dispose': () => (webview.receive = undefined) };
      },
    },
    'onDidDispose': (listener: () => void) => {
      webview.disposeListeners.push(listener);
      return { 'dispose': () => undefined };
    },
    'dispose': () => webview.disposeListeners.splice(0).forEach(listener => listener()),
  };
};

void mock.module('vscode', () => ({
  'StatusBarAlignment': { 'Left': 1, 'Right': 2 },
  'ViewColumn': { 'One': 1 },
  'env': { 'clipboard': { 'writeText': async () => undefined } },
  'commands': {
    'registerCommand': (id: string, callback: SpyCommand) => {
      registeredCommands.set(id, callback);
      return { 'dispose': () => void registeredCommands.delete(id) };
    },
  },
  'window': {
    'createOutputChannel': () => ({
      'appendLine': () => undefined,
      'clear': () => undefined,
      'show': () => undefined,
      'dispose': () => undefined,
    }),
    'createStatusBarItem': () => statusBar,
    createWebviewPanel,
    showErrorMessage,
    showInformationMessage,
    'showWarningMessage': () => undefined,
  },
}));

/** Load only after the editor API mock has been registered at this test boundary. */
const { createRemoteSpy } = await import('@extension/controllers/remoteSpy');

const requests: Array<{ method: SpyRequestMethod; params?: SpyRequest }> = [];
let handlers: SpyHandlers = {
  'custom/setRemoteSpyEnabled': () => ({ 'success': true }),
  'custom/setRemoteSpyBlockList': () => ({ 'success': true }),
};
let connected = true;
let subscriptions: Array<{ dispose: () => void }> = [];

/** SAFETY: the controller calls only sendRequest and onNotification, both implemented by this test transport. */
const client = {
  'sendRequest': async (method: SpyRequestMethod, params?: SpyRequest) => {
    requests.push({ method, params });
    const handler = handlers[method];
    if (handler === undefined) throw new Error(`Unexpected request ${method}`);
    return handler(params);
  },
  'onNotification': () => ({ 'dispose': () => undefined }),
} as RemoteSpyClient;

/** Lets the webview message handler, which the panel invokes without awaiting, run its promise chain to completion. */
const settle = (): Promise<void> => {
  const { promise, resolve } = Promise.withResolvers<void>();
  setImmediate(resolve);
  return promise;
};

const runCommand = async (id: string): Promise<void> => {
  const command = registeredCommands.get(id);
  if (command === undefined) throw new Error(`Command ${id} was not registered`);
  return command();
};

/** Creates the controller and opens its panel so webview messages reach the controller. */
const setup = async () => {
  const context = { subscriptions, extensionUri };
  const spy = createRemoteSpy(context, client, { 'isConnected': () => connected });
  await runCommand('rbxdev-ls.showRemoteSpy');
  webview.receive?.({ 'type': 'ready' });
  await settle();
  return spy;
};

const toggleFromWebview = async (enabled: boolean): Promise<void> => {
  if (webview.receive === undefined) throw new Error('Webview message listener was not registered');
  webview.receive({ 'type': 'toggleSpy', enabled });
  await settle();
};

/** Spy state most recently pushed to the webview. */
const panelEnabled = (): boolean | undefined =>
  webview.posted.filter(message => message.type === 'updateState').at(-1)?.state?.spyEnabled;

const enableRequests = () =>
  requests.filter(request => request.method === 'custom/setRemoteSpyEnabled').map(request => request.params);

const acknowledge: RequestHandler = params => ({
  'success': true,
  'enabled': params?.enabled === true,
  'source': params?.source ?? 'game',
});

describe('Remote Spy Controller - enable state', () => {
  beforeEach(() => {
    registeredCommands.clear();
    showErrorMessage.mockClear();
    showInformationMessage.mockClear();
    webview.created = 0;
    webview.posted = [];
    webview.receive = undefined;
    webview.disposeListeners = [];
    requests.length = 0;
    connected = true;
    subscriptions = [];
    handlers = {
      'custom/setRemoteSpyEnabled': acknowledge,
      'custom/setRemoteSpyBlockList': () => ({ 'success': true }),
    };
  });

  test('capture source changes are acknowledged and replayed on reconnect', async () => {
    const spy = await setup();
    await toggleFromWebview(true);

    for (const source of ['executor', 'both', 'game'] as const) {
      webview.receive?.({ 'type': 'setCaptureSource', source });
      await settle();

      expect(enableRequests().at(-1)).toEqual({ 'enabled': true, source });
      expect(webview.posted.at(-1)?.state?.captureSource).toBe(source);
      expect(panelEnabled()).toBe(true);
    }

    webview.receive?.({ 'type': 'setCaptureSource', 'source': 'both' });
    await settle();
    await spy.sync();

    expect(enableRequests().at(-1)).toEqual({ 'enabled': true, 'source': 'both' });
  });

  test('rejected capture-source changes restore the last acknowledged selection', async () => {
    await setup();
    await toggleFromWebview(true);
    handlers['custom/setRemoteSpyEnabled'] = () => ({ 'success': false, 'error': 'checkcaller unavailable' });

    webview.receive?.({ 'type': 'setCaptureSource', 'source': 'executor' });
    await settle();

    expect(webview.posted.at(-1)?.state?.captureSource).toBe('game');
    expect(panelEnabled()).toBe(true);
    expect(showErrorMessage).toHaveBeenCalledWith('Failed to toggle Remote Spy: checkcaller unavailable');
  });

  test('a legacy bridge cannot falsely acknowledge Both mode', async () => {
    await setup();
    handlers['custom/setRemoteSpyEnabled'] = () => ({ 'success': true, 'enabled': false });

    webview.receive?.({ 'type': 'setCaptureSource', 'source': 'both' });
    await settle();

    expect(webview.posted.at(-1)?.state?.captureSource).toBe('game');
    expect(showErrorMessage).toHaveBeenCalledWith(
      'Failed to toggle Remote Spy: This bridge cannot confirm capture sources. Reinject the updated bridge.',
    );
  });

  test('capture-source choice can be configured while disconnected', async () => {
    connected = false;
    await setup();

    webview.receive?.({ 'type': 'setCaptureSource', 'source': 'both' });
    await settle();

    expect(webview.posted.at(-1)?.state?.captureSource).toBe('both');
    expect(requests).toEqual([]);
  });
  afterEach(() => subscriptions.forEach(subscription => subscription.dispose()));

  test('ready handshake sends the current state without a bridge request', async () => {
    await setup();
    expect(panelEnabled()).toBe(false);
    expect(requests).toEqual([]);
  });

  test('webview toggle applies acknowledged enable and disable', async () => {
    await setup();

    await toggleFromWebview(true);
    expect(statusBar.text).toBe('$(eye) Spy ON');
    expect(panelEnabled()).toBe(true);

    await toggleFromWebview(false);
    expect(statusBar.text).toBe('$(eye-closed) Spy OFF');
    expect(panelEnabled()).toBe(false);

    expect(enableRequests()).toEqual([
      { 'enabled': true, 'source': 'game' },
      { 'enabled': false, 'source': 'game' },
    ]);
    expect(showErrorMessage).not.toHaveBeenCalled();
  });

  test('webview toggle follows the state the executor reports, not the requested one', async () => {
    handlers['custom/setRemoteSpyEnabled'] = () => ({ 'success': true, 'enabled': false });
    await setup();

    await toggleFromWebview(true);
    expect(statusBar.text).toBe('$(eye-closed) Spy OFF');
    expect(panelEnabled()).toBe(false);
  });

  test('webview toggle surfaces an unacknowledged enable and keeps the spy off', async () => {
    handlers['custom/setRemoteSpyEnabled'] = () => ({ 'success': false, 'error': 'hookmetamethod unavailable' });
    await setup();

    await toggleFromWebview(true);
    expect(showErrorMessage).toHaveBeenCalledWith('Failed to toggle Remote Spy: hookmetamethod unavailable');
    expect(statusBar.text).toBe('$(eye-closed) Spy OFF');
    expect(panelEnabled()).toBe(false);
  });

  test('webview toggle surfaces a rejected request', async () => {
    handlers['custom/setRemoteSpyEnabled'] = () => {
      throw new Error('Request timed out');
    };
    await setup();

    await toggleFromWebview(true);
    expect(showErrorMessage).toHaveBeenCalledWith('Failed to toggle Remote Spy: Request timed out');
    expect(statusBar.text).toBe('$(eye-closed) Spy OFF');
    expect(panelEnabled()).toBe(false);
  });

  test('webview toggle without an executor reports it and resets the panel', async () => {
    connected = false;
    await setup();

    await toggleFromWebview(true);
    expect(showErrorMessage).toHaveBeenCalledWith('No executor connected');
    expect(enableRequests()).toEqual([]);
    expect(panelEnabled()).toBe(false);
  });

  test('toggle command enables from the reported status and reveals the panel', async () => {
    handlers['custom/getRemoteSpyStatus'] = () => ({ 'isEnabled': false });
    await setup();

    await runCommand('rbxdev-ls.toggleRemoteSpy');
    expect(enableRequests()).toEqual([{ 'enabled': true, 'source': 'game' }]);
    expect(statusBar.text).toBe('$(eye) Spy ON');
    expect(panelEnabled()).toBe(true);
    expect(webview.created).toBe(1);
    expect(showInformationMessage).toHaveBeenCalledWith('Remote Spy enabled - monitoring remote calls');
  });

  test('toggle command disables when the spy is reported enabled', async () => {
    handlers['custom/getRemoteSpyStatus'] = () => ({ 'isEnabled': true });
    await setup();
    await toggleFromWebview(true);

    await runCommand('rbxdev-ls.toggleRemoteSpy');
    expect(enableRequests()).toEqual([
      { 'enabled': true, 'source': 'game' },
      { 'enabled': false, 'source': 'game' },
    ]);
    expect(statusBar.text).toBe('$(eye-closed) Spy OFF');
    expect(panelEnabled()).toBe(false);
    expect(showInformationMessage).not.toHaveBeenCalled();
  });

  test('toggle command surfaces an unacknowledged enable', async () => {
    handlers['custom/getRemoteSpyStatus'] = () => ({ 'isEnabled': false });
    handlers['custom/setRemoteSpyEnabled'] = () => ({ 'success': false });
    await setup();

    await runCommand('rbxdev-ls.toggleRemoteSpy');
    expect(showErrorMessage).toHaveBeenCalledWith('Failed to toggle Remote Spy: Unknown error');
    expect(statusBar.text).toBe('$(eye-closed) Spy OFF');
    expect(panelEnabled()).toBe(false);
    expect(showInformationMessage).not.toHaveBeenCalled();
  });

  test('toggle command surfaces a rejected status request', async () => {
    handlers['custom/getRemoteSpyStatus'] = () => {
      throw new Error('Bridge not running');
    };
    await setup();

    await runCommand('rbxdev-ls.toggleRemoteSpy');
    expect(showErrorMessage).toHaveBeenCalledWith('Failed to toggle Remote Spy: Bridge not running');
    expect(enableRequests()).toEqual([]);
  });

  test('reconnect sync restores an enabled spy and pushes the block list', async () => {
    const spy = await setup();
    await toggleFromWebview(true);
    requests.length = 0;

    await spy.sync();
    expect(requests).toEqual([
      { 'method': 'custom/setRemoteSpyEnabled', 'params': { 'enabled': true, 'source': 'game' } },
      { 'method': 'custom/setRemoteSpyBlockList', 'params': { 'blocks': [] } },
    ]);
    expect(statusBar.text).toBe('$(eye) Spy ON');
    expect(panelEnabled()).toBe(true);
    expect(showErrorMessage).not.toHaveBeenCalled();
  });

  test('reconnect sync resets to disabled when restoring is not acknowledged', async () => {
    const spy = await setup();
    await toggleFromWebview(true);
    handlers['custom/setRemoteSpyEnabled'] = () => ({ 'success': false, 'error': 'Executor lacks hookmetamethod' });

    await spy.sync();
    expect(showErrorMessage).toHaveBeenCalledWith('Failed to restore Remote Spy: Executor lacks hookmetamethod');
    expect(statusBar.text).toBe('$(eye-closed) Spy OFF');
    expect(panelEnabled()).toBe(false);

    handlers['custom/setRemoteSpyEnabled'] = acknowledge;
    await spy.sync();
    expect(enableRequests().at(-1)).toEqual({ 'enabled': false, 'source': 'game' });
  });

  test('reconnect sync resets to disabled when restoring rejects', async () => {
    const spy = await setup();
    await toggleFromWebview(true);
    handlers['custom/setRemoteSpyEnabled'] = () => {
      throw new Error('Request timed out');
    };

    await spy.sync();
    expect(showErrorMessage).toHaveBeenCalledWith('Failed to restore Remote Spy: Request timed out');
    expect(statusBar.text).toBe('$(eye-closed) Spy OFF');
    expect(panelEnabled()).toBe(false);
    expect(requests.at(-1)?.method).toBe('custom/setRemoteSpyBlockList');
  });

  test('reconnect sync adopts the state the executor reports', async () => {
    const spy = await setup();
    await toggleFromWebview(true);
    handlers['custom/setRemoteSpyEnabled'] = () => ({ 'success': true, 'enabled': false });

    await spy.sync();
    expect(statusBar.text).toBe('$(eye-closed) Spy OFF');
    expect(panelEnabled()).toBe(false);
    expect(showErrorMessage).not.toHaveBeenCalled();
  });

  test('reconnect sync of a disabled spy stays quiet when the executor rejects', async () => {
    const spy = await setup();
    handlers['custom/setRemoteSpyEnabled'] = () => {
      throw new Error('Request timed out');
    };

    await spy.sync();
    expect(enableRequests()).toEqual([{ 'enabled': false, 'source': 'game' }]);
    expect(showErrorMessage).not.toHaveBeenCalled();
    expect(statusBar.text).toBe('$(eye-closed) Spy OFF');
  });
});
