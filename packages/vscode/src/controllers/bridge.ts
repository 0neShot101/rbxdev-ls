import { commands, StatusBarAlignment, window, workspace } from 'vscode';

import type { Disposable, ExtensionContext } from 'vscode';
import type { LanguageClient } from 'vscode-languageclient/node';
import type { BridgeStatus, ExecutorStatusResponse } from '@typings/bridge';
import type { BridgeChangeListener, BridgeCollaborators, BridgeController } from '@typings/controllers';

/**
 * Creates the bridge controller: status polling, status bar, bridge toggling and auto-refresh.
 * @param context - Extension context that owns the status bar, listeners and commands.
 * @param client - Language client used to reach the bridge server.
 * @param collaborators - Debug logger.
 * @returns Connection state readers, the status poller and change subscription.
 */
export const createBridge = (
  context: ExtensionContext,
  client: LanguageClient,
  { log }: BridgeCollaborators,
): BridgeController => {
  let lastConnected: boolean = false;
  let lastExecutorName: string | undefined;
  let lastClientType: string | undefined;
  let isPollingExecutorStatus = false;
  const listeners = new Set<BridgeChangeListener>();

  const emit = (isConnected: boolean): void => {
    for (const listener of listeners) listener(isConnected);
  };

  const statusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 100);

  const resetBridgeUiState = (): void => {
    commands.executeCommand('setContext', 'rbxdev-ls:bridgeConnected', false);
    commands.executeCommand('setContext', 'rbxdev-ls:clientType', undefined);
    lastClientType = undefined;
    emit(false);
  };

  const updateStatusBar = (status: BridgeStatus, executorName?: string, clientType?: string): void => {
    switch (status) {
      case 'stopped':
        statusBarItem.text = '$(circle-outline) Roblox';
        statusBarItem.tooltip = 'Bridge stopped - Click to start';
        statusBarItem.backgroundColor = undefined;
        break;
      case 'waiting':
        statusBarItem.text = '$(sync~spin) Roblox';
        statusBarItem.tooltip = 'Waiting for connection...';
        statusBarItem.backgroundColor = undefined;
        break;
      case 'connected': {
        const label = clientType === 'studio' ? 'Studio' : (executorName ?? 'Connected');
        statusBarItem.text = `$(circle-filled) Roblox: ${label}`;
        statusBarItem.tooltip = `Connected to ${clientType === 'studio' ? 'Roblox Studio' : (executorName ?? 'client')} - Click to disconnect`;
        statusBarItem.backgroundColor = undefined;
        break;
      }
      case 'error':
        statusBarItem.text = '$(error) Roblox';
        statusBarItem.tooltip = 'Bridge error - Click to retry';
        statusBarItem.backgroundColor = undefined;
        break;
    }
  };

  const applyAutoRefreshSetting = async (): Promise<void> => {
    const config = workspace.getConfiguration('rbxdev-ls');
    const enabled = config.get<boolean>('autoRefreshGameTree.enabled', false);
    const rawInterval = config.get<number>('autoRefreshGameTree.intervalMs', 5000);
    const intervalMs = Math.max(2000, Math.floor(rawInterval));
    try {
      await client.sendRequest('custom/setAutoRefresh', { enabled, intervalMs });
    } catch (error) {
      log(`[rbxdev-ls] setAutoRefresh request failed: ${String(error)}`);
    }
  };

  const pollExecutorStatus = async (): Promise<void> => {
    if (isPollingExecutorStatus === true) return;

    isPollingExecutorStatus = true;

    try {
      const response = await client.sendRequest<ExecutorStatusResponse>('custom/executorStatus');

      const currentClientType = response.clientType ?? undefined;

      if (response.isConnected && lastConnected === false) {
        const label = currentClientType === 'studio' ? 'Roblox Studio' : (response.executorName ?? 'client');
        window.showInformationMessage(`Roblox: Connected to ${label}`);
        lastExecutorName = response.executorName;
        lastClientType = currentClientType;
        commands.executeCommand('setContext', 'rbxdev-ls:bridgeConnected', true);
        commands.executeCommand('setContext', 'rbxdev-ls:clientType', currentClientType ?? 'executor');
        emit(true);
        void applyAutoRefreshSetting();
      } else if (response.isConnected === false && lastConnected) {
        const label = lastClientType === 'studio' ? 'Roblox Studio' : (lastExecutorName ?? 'Client');
        window.showWarningMessage(`Roblox: ${label} disconnected`);
        resetBridgeUiState();
      }
      lastConnected = response.isConnected;

      if (response.isConnected) {
        updateStatusBar('connected', response.executorName, currentClientType);
        lastExecutorName = response.executorName;
        lastClientType = currentClientType;
      } else if (response.isRunning) updateStatusBar('waiting');
      else updateStatusBar('stopped');
    } catch {
      if (lastConnected === true) {
        window.showWarningMessage(`Roblox: ${lastExecutorName ?? 'Executor'} disconnected`);
        lastConnected = false;
      }
      updateStatusBar('stopped');
      resetBridgeUiState();
    } finally {
      isPollingExecutorStatus = false;
    }
  };

  context.subscriptions.push(
    workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('rbxdev-ls.autoRefreshGameTree')) void applyAutoRefreshSetting();
    }),
  );

  statusBarItem.command = 'rbxdev-ls.toggleBridge';
  updateStatusBar('stopped');
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  context.subscriptions.push(
    commands.registerCommand('rbxdev-ls.toggleBridge', async () => {
      try {
        await client.sendRequest('custom/toggleBridge');
        await pollExecutorStatus();
      } catch (error) {
        window.showErrorMessage(`Toggle failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }),
  );

  const onChange = (listener: BridgeChangeListener): Disposable => {
    listeners.add(listener);
    return { 'dispose': () => void listeners.delete(listener) };
  };

  return {
    'isConnected': () => lastConnected,
    'clientType': () => lastClientType,
    'poll': pollExecutorStatus,
    onChange,
  };
};
