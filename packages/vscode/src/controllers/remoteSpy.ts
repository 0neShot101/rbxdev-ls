import { commands, env, StatusBarAlignment, window } from 'vscode';

import type { ExtensionContext } from 'vscode';
import type { RemoteSpyCollaborators, RemoteSpyController } from '@typings/controllers';
import type {
  FromWebviewMessage,
  RemoteSpyClient,
  RemoteSpySource,
  RemoteSpyStatus,
  SpyEnableOutcome,
} from '@typings/remoteSpy';
import { RemoteSpyPanel } from '#extension/remoteSpyWebview';
import {
  addBlock,
  addCall,
  addIgnore,
  clearBlocks,
  clearCalls,
  clearIgnores,
  createRemoteSpyState,
  isCallIgnored,
  removeBlock,
  removeIgnore,
} from '#extension/remoteSpyState';

/**
 * Creates the remote spy controller: spy state, panel, log channel, status bar, commands and notifications.
 * @param context - Extension context that owns the spy resources and commands.
 * @param client - Language client used to reach the bridge server.
 * @param collaborators - Bridge connection reader.
 * @returns An operation that pushes the spy state to a newly connected client.
 */
export const createRemoteSpy = (
  context: Pick<ExtensionContext, 'subscriptions' | 'extensionUri'>,
  client: RemoteSpyClient,
  { isConnected }: RemoteSpyCollaborators,
): RemoteSpyController => {
  const remoteSpyState = createRemoteSpyState();
  let remoteSpyEnabled = false;

  const remoteSpyChannel = window.createOutputChannel('Roblox Remote Spy');
  context.subscriptions.push(remoteSpyChannel);

  const recentCalls = () =>
    remoteSpyState.calls
      .slice(-20)
      .reverse()
      .map(call => ({
        'label': call.remoteName,
        'description': call.method,
        'detail': call.code.includes('\n') ? (call.code.split('\n').pop() ?? call.code) : call.code,
        'luaCode': call.code,
      }));

  const remoteSpyPanel = new RemoteSpyPanel(context);
  context.subscriptions.push({ 'dispose': () => remoteSpyPanel.dispose() });

  const pushBlockList = async (): Promise<void> => {
    try {
      await client.sendRequest('custom/setRemoteSpyBlockList', {
        'blocks': remoteSpyState.blockList,
      });
    } catch {
      /* noop */
    }
  };

  const pushSpyState = (controlSettled = false): void =>
    remoteSpyPanel.sendFullState(remoteSpyState, remoteSpyEnabled, controlSettled);

  const remoteSpyStatusBar = window.createStatusBarItem(StatusBarAlignment.Right, 99);
  remoteSpyStatusBar.text = '$(eye-closed) Spy OFF';
  remoteSpyStatusBar.tooltip = 'Toggle Remote Spy';
  remoteSpyStatusBar.command = 'rbxdev-ls.toggleRemoteSpy';
  remoteSpyStatusBar.show();
  context.subscriptions.push(remoteSpyStatusBar);

  /**
   * Records the executor-acknowledged spy state and refreshes the status bar and panel from it.
   * @param enabled - Spy state the executor reported.
   */
  const applySpyEnabled = (enabled: boolean, source = remoteSpyState.captureSource): void => {
    if (source !== remoteSpyState.captureSource && source !== 'both') {
      const selected = remoteSpyState.calls[remoteSpyState.selectedIndex];

      if (selected?.source !== source) remoteSpyState.selectedIndex = -1;
    }

    remoteSpyEnabled = enabled;
    remoteSpyState.captureSource = source;
    remoteSpyStatusBar.text = enabled ? '$(eye) Spy ON' : '$(eye-closed) Spy OFF';
    remoteSpyStatusBar.backgroundColor = undefined;
    pushSpyState(true);
  };

  /**
   * Asks the executor to enable or disable the spy without touching local state.
   * @param enabled - Requested spy state.
   * @returns The acknowledged state, or why the executor did not acknowledge it.
   */
  const requestSpyEnabled = async (
    enabled: boolean,
    source = remoteSpyState.captureSource,
  ): Promise<SpyEnableOutcome> => {
    try {
      const result = await client.sendRequest('custom/setRemoteSpyEnabled', { enabled, source });

      if (result.success) {
        if (result.source === undefined && source !== 'game')
          return {
            'acknowledged': false,
            'reason': 'This bridge cannot confirm capture sources. Reinject the updated bridge.',
          };

        return { 'acknowledged': true, 'enabled': result.enabled ?? enabled, 'source': result.source ?? 'game' };
      }
      return { 'acknowledged': false, 'reason': result.error ?? 'Unknown error' };
    } catch (error) {
      return { 'acknowledged': false, 'reason': error instanceof Error ? error.message : String(error) };
    }
  };

  /**
   * Toggles the spy for a user action: applies the acknowledged state, or reports the failure and
   * re-sends the unchanged state so the panel drops any optimistic toggle.
   * @param enabled - Requested spy state.
   * @returns Whether the executor acknowledged the request.
   */
  const setSpyEnabled = async (enabled: boolean, source?: RemoteSpySource): Promise<boolean> => {
    const outcome = await requestSpyEnabled(enabled, source);
    if (outcome.acknowledged) {
      applySpyEnabled(outcome.enabled, outcome.source);
      return true;
    }

    window.showErrorMessage(`Failed to toggle Remote Spy: ${outcome.reason}`);
    pushSpyState(true);
    return false;
  };

  /**
   * Restores the spy state and block list on a newly connected executor. A failed restore resets the
   * spy to disabled, since the fresh executor is not spying.
   */
  const syncSpyState = async (): Promise<void> => {
    const restoring = remoteSpyEnabled;
    const outcome = await requestSpyEnabled(restoring);
    if (outcome.acknowledged) applySpyEnabled(outcome.enabled, outcome.source);
    else {
      applySpyEnabled(false);
      if (restoring) window.showErrorMessage(`Failed to restore Remote Spy: ${outcome.reason}`);
    }

    await pushBlockList();
  };

  const callAt = (index?: number) => (index === undefined ? undefined : remoteSpyState.calls[index]);

  remoteSpyPanel.onMessage(async (message: FromWebviewMessage) => {
    switch (message.type) {
      case 'setCaptureSource':
        if (message.source === undefined) return;

        if (isConnected() === false) {
          applySpyEnabled(remoteSpyEnabled, message.source);
          return;
        }

        await setSpyEnabled(remoteSpyEnabled, message.source);
        break;
      case 'copyReturns': {
        const call = callAt(message.index);
        if (call?.returnStatus !== 'returned') return;

        await env.clipboard.writeText(call.returns ?? '');
        break;
      }
      case 'ready':
        pushSpyState();
        break;
      case 'toggleSpy':
        if (isConnected() === false) {
          pushSpyState(true);
          return window.showErrorMessage('No executor connected');
        }

        await setSpyEnabled(message.enabled === true);
        break;
      case 'pause':
        remoteSpyState.paused = true;
        pushSpyState();
        break;
      case 'resume':
        remoteSpyState.paused = false;
        pushSpyState();
        break;
      case 'clear':
        clearCalls(remoteSpyState);
        remoteSpyPanel.clear();
        break;
      case 'selectCall':
        if (message.index !== undefined) remoteSpyState.selectedIndex = message.index;
        break;
      case 'copyCode': {
        const call = callAt(message.index);
        if (call === undefined) return;
        await env.clipboard.writeText(call.code);
        window.showInformationMessage(`Copied: ${call.remoteName}`);
        break;
      }
      case 'copyPath': {
        const call = callAt(message.index);
        if (call === undefined) return;
        const remotePath = call.remotePath.join('.');
        await env.clipboard.writeText(remotePath);
        window.showInformationMessage(`Copied path: ${remotePath}`);
        break;
      }
      case 'copyArgs': {
        const call = callAt(message.index);
        if (call === undefined) return;
        await env.clipboard.writeText(call.arguments);
        window.showInformationMessage(`Copied arguments`);
        break;
      }
      case 'ignoreByPath': {
        const call = callAt(message.index);
        if (call === undefined) return;
        addIgnore(remoteSpyState, { 'type': 'path', 'value': call.remotePath.join('.') });
        pushSpyState();
        break;
      }
      case 'ignoreByName': {
        const call = callAt(message.index);
        if (call === undefined) return;
        addIgnore(remoteSpyState, { 'type': 'name', 'value': call.remoteName });
        pushSpyState();
        break;
      }
      case 'blockByPath': {
        const call = callAt(message.index);
        if (call === undefined) return;
        addBlock(remoteSpyState, { 'type': 'path', 'value': call.remotePath.join('.') });
        pushSpyState();
        await pushBlockList();
        break;
      }
      case 'blockByName': {
        const call = callAt(message.index);
        if (call === undefined) return;
        addBlock(remoteSpyState, { 'type': 'name', 'value': call.remoteName });
        pushSpyState();
        await pushBlockList();
        break;
      }
      case 'clearIgnores':
        clearIgnores(remoteSpyState);
        pushSpyState();
        break;
      case 'clearBlocks':
        clearBlocks(remoteSpyState);
        pushSpyState();
        await pushBlockList();
        break;
      case 'removeIgnore':
        if (message.entry !== undefined) {
          removeIgnore(remoteSpyState, message.entry);
          pushSpyState();
        }
        break;
      case 'removeBlock':
        if (message.entry !== undefined) {
          removeBlock(remoteSpyState, message.entry);
          pushSpyState();
          await pushBlockList();
        }
        break;
    }
  });

  client.onNotification('custom/remoteSpy', call => {
    const updating = call.id !== undefined && remoteSpyState.calls.some(entry => entry.id === call.id);

    if (updating === false && (call.returnStatus === 'returned' || call.returnStatus === 'unavailable')) return;
    if (updating === false && remoteSpyState.paused === true) return;
    if (updating === false && isCallIgnored(call, remoteSpyState.ignoreList)) return;

    addCall(remoteSpyState, call);
    const callIndex = remoteSpyState.calls.length - 1;

    if (updating) pushSpyState();
    else remoteSpyPanel.addCall(call, callIndex);

    const timestamp = new Date(call.timestamp * 1000).toLocaleTimeString();
    remoteSpyChannel.appendLine('─'.repeat(60));
    remoteSpyChannel.appendLine(`[${timestamp}] ${call.method} → ${call.remoteName} (${call.remoteType})`);
    remoteSpyChannel.appendLine('');
    remoteSpyChannel.appendLine(call.code);
    if (call.returnStatus === 'returned')
      remoteSpyChannel.appendLine(`Returned (${call.returnCount ?? 0}): ${call.returns ?? ''}`);
    remoteSpyChannel.appendLine('');
  });

  context.subscriptions.push(
    commands.registerCommand('rbxdev-ls.toggleRemoteSpy', async () => {
      if (isConnected() === false) return window.showErrorMessage('No executor connected');

      let status: RemoteSpyStatus;
      try {
        status = await client.sendRequest('custom/getRemoteSpyStatus');
      } catch (error) {
        return window.showErrorMessage(
          `Failed to toggle Remote Spy: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      if ((await setSpyEnabled(status.isEnabled === false)) && remoteSpyEnabled) {
        remoteSpyPanel.show(remoteSpyState, remoteSpyEnabled);
        window.showInformationMessage('Remote Spy enabled - monitoring remote calls');
      }
    }),

    commands.registerCommand('rbxdev-ls.setRemoteSpyFilter', async () => {
      const filter = await window.showInputBox({
        'title': 'Remote Spy Filter',
        'prompt': 'Enter a filter pattern (empty to show all)',
        'placeHolder': 'e.g., Chat, Event, Server',
      });

      if (filter === undefined) return;

      try {
        const result = await client.sendRequest('custom/setRemoteSpyFilter', { 'filter': filter });

        if (result.success)
          window.showInformationMessage(
            filter === '' ? 'Remote Spy filter cleared' : `Remote Spy filter set to: ${filter}`,
          );
        else window.showErrorMessage(`Failed to set filter: ${result.error ?? 'Unknown error'}`);
      } catch (error) {
        window.showErrorMessage(`Filter error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }),

    commands.registerCommand('rbxdev-ls.clearRemoteSpyOutput', () => remoteSpyChannel.clear()),
    commands.registerCommand('rbxdev-ls.showRemoteSpy', () => remoteSpyPanel.show(remoteSpyState, remoteSpyEnabled)),
    commands.registerCommand('rbxdev-ls.openRemoteSpy', () => remoteSpyPanel.show(remoteSpyState, remoteSpyEnabled)),
    commands.registerCommand('rbxdev-ls.showRemoteSpyLog', () => remoteSpyChannel.show(true)),

    commands.registerCommand('rbxdev-ls.copyLastRemoteCall', async () => {
      if (remoteSpyState.calls.length === 0) return window.showWarningMessage('No remote calls captured yet');

      const selected = await window.showQuickPick(recentCalls(), {
        'title': 'Copy Remote Call',
        'placeHolder': 'Select a remote call to copy',
      });

      if (selected === undefined) return;

      await env.clipboard.writeText(selected.luaCode);
      window.showInformationMessage(`Copied: ${selected.label}`);
    }),

    commands.registerCommand('rbxdev-ls.insertLastRemoteCall', async () => {
      const editor = window.activeTextEditor;
      if (editor === undefined) return window.showErrorMessage('No active editor');

      if (remoteSpyState.calls.length === 0) return window.showWarningMessage('No remote calls captured yet');

      const selected = await window.showQuickPick(recentCalls(), {
        'title': 'Insert Remote Call',
        'placeHolder': 'Select a remote call to insert',
      });

      if (selected === undefined) return;

      await editor.edit(editBuilder => editBuilder.insert(editor.selection.active, selected.luaCode));
    }),

    commands.registerCommand('rbxdev-ls.copyQuickRemote', async () => {
      if (remoteSpyState.calls.length === 0) return window.showWarningMessage('No remote calls captured yet');

      const call = remoteSpyState.calls[remoteSpyState.calls.length - 1];
      if (call === undefined) return;

      await env.clipboard.writeText(call.code);
      window.showInformationMessage(`Copied: ${call.remoteName}`);
    }),
  );

  return { 'sync': syncSpyState };
};
