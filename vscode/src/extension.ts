import * as path from 'path';

import { commands, env, ExtensionContext, OutputChannel, StatusBarAlignment, StatusBarItem, window, workspace } from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient/node';

import { GameTreeDataProvider, type GameTreeItem, type GameTreeNode } from './gameTreeProvider';
import { PropertiesDataProvider, type PropertyEntry, type PropertyItem } from './propertiesProvider';

let client: LanguageClient;
let statusBarItem: StatusBarItem;
let executeButton: StatusBarItem;
let outputChannel: OutputChannel;
let gameTreeProvider: GameTreeDataProvider;
let propertiesProvider: PropertiesDataProvider;
let lastConnectedState: boolean = false;
let lastExecutorName: string | undefined;

type BridgeStatus = 'stopped' | 'waiting' | 'connected' | 'error';

interface ExecutorStatusResponse {
  isRunning: boolean;
  isConnected: boolean;
  executorName?: string;
}

const updateStatusBar = (status: BridgeStatus, executorName?: string): void => {
  switch (status) {
    case 'stopped':
      statusBarItem.text = '$(circle-outline) Roblox';
      statusBarItem.tooltip = 'Executor bridge stopped - Click to start';
      statusBarItem.backgroundColor = undefined;
      break;
    case 'waiting':
      statusBarItem.text = '$(sync~spin) Roblox';
      statusBarItem.tooltip = 'Waiting for executor connection...';
      statusBarItem.backgroundColor = undefined;
      break;
    case 'connected':
      statusBarItem.text = `$(circle-filled) Roblox: ${executorName ?? 'Connected'}`;
      statusBarItem.tooltip = `Connected to ${executorName ?? 'executor'} - Click to disconnect`;
      statusBarItem.backgroundColor = undefined;
      break;
    case 'error':
      statusBarItem.text = '$(error) Roblox';
      statusBarItem.tooltip = 'Executor bridge error - Click to retry';
      statusBarItem.backgroundColor = undefined;
      break;
  }
};

const pollExecutorStatus = async (): Promise<void> => {
  if (client === undefined) return;

  try {
    const response = await client.sendRequest<ExecutorStatusResponse>('custom/executorStatus');

    // Check for connection state changes and show notifications
    if (response.isConnected && lastConnectedState === false) {
      window.showInformationMessage(`Roblox: Connected to ${response.executorName ?? 'executor'}`);
      lastExecutorName = response.executorName;
      commands.executeCommand('setContext', 'rbxdev-ls:bridgeConnected', true);
    } else if (response.isConnected === false && lastConnectedState) {
      window.showWarningMessage(`Roblox: ${lastExecutorName ?? 'Executor'} disconnected`);
      commands.executeCommand('setContext', 'rbxdev-ls:bridgeConnected', false);
      gameTreeProvider.clear();
    }
    lastConnectedState = response.isConnected;

    if (response.isConnected) {
      updateStatusBar('connected', response.executorName);
      lastExecutorName = response.executorName;
    } else if (response.isRunning) {
      updateStatusBar('waiting');
    } else {
      updateStatusBar('stopped');
    }
  } catch {
    if (lastConnectedState) {
      window.showWarningMessage(`Roblox: ${lastExecutorName ?? 'Executor'} disconnected`);
      lastConnectedState = false;
    }
    updateStatusBar('stopped');
  }
};

export function activate(context: ExtensionContext) {
  // Path to the server module (bundled inside extension)
  const serverModule = context.asAbsolutePath(path.join('server', 'index.js'));

  // Server options - run the language server
  const serverOptions: ServerOptions = {
    'run': {
      'module': serverModule,
      'transport': TransportKind.stdio,
    },
    'debug': {
      'module': serverModule,
      'transport': TransportKind.stdio,
      'options': {
        'execArgv': ['--nolazy', '--inspect=6009'],
      },
    },
  };

  // Client options - which documents to sync
  const clientOptions: LanguageClientOptions = {
    'documentSelector': [
      { 'scheme': 'file', 'language': 'lua' },
      { 'scheme': 'file', 'language': 'luau' },
    ],
    'synchronize': {
      'fileEvents': workspace.createFileSystemWatcher('**/*.{lua,luau}'),
    },
  };

  // Create and start the client
  client = new LanguageClient('rbxdev-ls', 'Roblox Luau Language Server', serverOptions, clientOptions);

  // Create Output Channel for Roblox Console
  outputChannel = window.createOutputChannel('Roblox Console');
  context.subscriptions.push(outputChannel);

  // Create Game Tree view (before client starts so it's ready)
  console.log('[rbxdev-ls] Creating Game Tree view...');
  gameTreeProvider = new GameTreeDataProvider();
  const treeView = window.createTreeView('rbxdev-gameTree', {
    'treeDataProvider': gameTreeProvider,
    'showCollapseAll': true,
    'dragAndDropController': gameTreeProvider,
    'canSelectMany': false,
  });
  context.subscriptions.push(treeView);

  // Handle drag-and-drop reparenting
  gameTreeProvider.onReparent(async (sourcePath, targetPath) => {
    try {
      const result = await client.sendRequest<{ success: boolean; error?: string }>(
        'custom/reparentInstance',
        { 'sourcePath': sourcePath, 'targetPath': targetPath }
      );

      if (result.success) {
        window.showInformationMessage(`Moved ${sourcePath[sourcePath.length - 1]} to ${targetPath[targetPath.length - 1]}`);
        // Request updated game tree
        await client.sendRequest('custom/requestGameTree');
      } else {
        window.showErrorMessage(`Move failed: ${result.error ?? 'Unknown error'}`);
      }
    } catch (err) {
      window.showErrorMessage(`Move failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  console.log('[rbxdev-ls] Game Tree view created');

  // Create Properties view
  propertiesProvider = new PropertiesDataProvider();
  const propertiesView = window.createTreeView('rbxdev-properties', {
    'treeDataProvider': propertiesProvider,
  });
  context.subscriptions.push(propertiesView);

  // Handle selection changes in the game tree to show properties
  treeView.onDidChangeSelection(async (e) => {
    if (e.selection.length === 0) {
      propertiesProvider.clear();
      return;
    }

    const selectedItem = e.selection[0];
    if (selectedItem === undefined) return;

    // Request properties from the server
    try {
      const result = await client.sendRequest<{
        success: boolean;
        properties?: PropertyEntry[];
        error?: string;
      }>('custom/requestProperties', { 'path': selectedItem.path });

      if (result.success && result.properties !== undefined) {
        propertiesProvider.setProperties(selectedItem.name, result.properties, selectedItem.path);
      } else {
        propertiesProvider.clear();
      }
    } catch {
      propertiesProvider.clear();
    }
  });

  // Start the client (also starts the server)
  client.start().then(() => {
    // Handle log notifications from executor bridge
    client.onNotification('custom/log', (log: { level: string; message: string; stack?: string; timestamp: number }) => {
      const prefix = log.level === 'error' ? '[ERROR]' : log.level === 'warn' ? '[WARN]' : '[INFO]';
      const timestamp = new Date(log.timestamp * 1000).toLocaleTimeString();
      outputChannel.appendLine(`${timestamp} ${prefix} ${log.message}`);

      if (log.stack !== undefined) {
        outputChannel.appendLine(log.stack);
      }

      if (log.level === 'error') {
        outputChannel.show(true);
      }
    });

    // Handle game tree update notifications
    client.onNotification('custom/gameTreeUpdate', (nodes: GameTreeNode[]) => {
      gameTreeProvider.refresh(nodes);
    });
  });

  // Create status bar item for connection status
  statusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 100);
  statusBarItem.command = 'rbxdev-ls.toggleBridge';
  updateStatusBar('stopped');
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Create execute button
  executeButton = window.createStatusBarItem(StatusBarAlignment.Right, 101);
  executeButton.text = '$(play) Roblox Execute';
  executeButton.tooltip = 'Execute code in Roblox (Ctrl+Shift+E)';
  executeButton.command = 'rbxdev-ls.execute';
  executeButton.show();
  context.subscriptions.push(executeButton);

  // Register commands
  context.subscriptions.push(
    commands.registerCommand('rbxdev-ls.execute', async () => {
      const editor = window.activeTextEditor;
      if (editor === undefined) {
        window.showErrorMessage('No active editor');
        return;
      }

      const code = editor.document.getText();
      try {
        const result = await client.sendRequest<{ success: boolean; result?: string; error?: { message: string } }>(
          'custom/execute',
          { code }
        );

        if (result.success) {
          if (result.result !== undefined) {
            window.showInformationMessage(`Executed: ${result.result}`);
          } else {
            window.showInformationMessage('Code executed successfully');
          }
        } else {
          window.showErrorMessage(`Execution failed: ${result.error?.message ?? 'Unknown error'}`);
        }
      } catch (err) {
        window.showErrorMessage(`Execute failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }),

    commands.registerCommand('rbxdev-ls.executeSelection', async () => {
      const editor = window.activeTextEditor;
      if (editor === undefined) {
        window.showErrorMessage('No active editor');
        return;
      }

      const selection = editor.selection;
      const code = editor.document.getText(selection);

      if (code.trim().length === 0) {
        window.showErrorMessage('No code selected');
        return;
      }

      try {
        const result = await client.sendRequest<{ success: boolean; result?: string; error?: { message: string } }>(
          'custom/execute',
          { code }
        );

        if (result.success) {
          window.showInformationMessage('Selection executed successfully');
        } else {
          window.showErrorMessage(`Execution failed: ${result.error?.message ?? 'Unknown error'}`);
        }
      } catch (err) {
        window.showErrorMessage(`Execute failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }),

    commands.registerCommand('rbxdev-ls.toggleBridge', async () => {
      try {
        await client.sendRequest('custom/toggleBridge');
        await pollExecutorStatus();
      } catch (err) {
        window.showErrorMessage(`Toggle failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }),

    // Game Tree commands
    commands.registerCommand('rbxdev-ls.copyPath', (item: GameTreeItem) => {
      const pathStr = `game.${item.path.join('.')}`;
      env.clipboard.writeText(pathStr);
      window.showInformationMessage(`Copied: ${pathStr}`);
    }),

    commands.registerCommand('rbxdev-ls.insertPath', async (item: GameTreeItem) => {
      const editor = window.activeTextEditor;
      if (editor === undefined) {
        window.showErrorMessage('No active editor');
        return;
      }
      const pathStr = `game.${item.path.join('.')}`;
      await editor.edit(editBuilder => {
        editBuilder.insert(editor.selection.active, pathStr);
      });
    }),

    commands.registerCommand('rbxdev-ls.insertService', async (item: GameTreeItem) => {
      const editor = window.activeTextEditor;
      if (editor === undefined) {
        window.showErrorMessage('No active editor');
        return;
      }
      const serviceName = item.path[0];
      if (serviceName === undefined) return;
      const code = `local ${serviceName} = game:GetService("${serviceName}")\n`;
      await editor.edit(editBuilder => {
        editBuilder.insert(editor.selection.active, code);
      });
    }),

    commands.registerCommand('rbxdev-ls.refreshGameTree', async () => {
      try {
        await client.sendRequest('custom/requestGameTree');
      } catch (err) {
        window.showErrorMessage(`Refresh failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }),

    commands.registerCommand('rbxdev-ls.editProperty', async (item: PropertyItem) => {
      // Show input box with current value
      const newValue = await window.showInputBox({
        'prompt': `Edit ${item.name}`,
        'value': item.value,
        'placeHolder': `Enter new value for ${item.name}`,
      });

      if (newValue === undefined) return; // User cancelled

      try {
        const result = await client.sendRequest<{ success: boolean; error?: string }>(
          'custom/setProperty',
          {
            'path': item.instancePath,
            'property': item.name,
            'value': newValue,
            'valueType': item.valueType,
          }
        );

        if (result.success) {
          window.showInformationMessage(`${item.name} set to ${newValue}`);
          // Refresh properties to show updated value
          const propsResult = await client.sendRequest<{
            success: boolean;
            properties?: PropertyEntry[];
          }>('custom/requestProperties', { 'path': item.instancePath });
          if (propsResult.success && propsResult.properties !== undefined) {
            propertiesProvider.setProperties(item.instancePath[item.instancePath.length - 1] ?? '', propsResult.properties, item.instancePath);
          }
        } else {
          window.showErrorMessage(`Failed to set property: ${result.error ?? 'Unknown error'}`);
        }
      } catch (err) {
        window.showErrorMessage(`Failed to set property: ${err instanceof Error ? err.message : String(err)}`);
      }
    }),

    commands.registerCommand('rbxdev-ls.teleportTo', async (item: GameTreeItem) => {
      try {
        const result = await client.sendRequest<{ success: boolean; error?: string }>(
          'custom/teleportTo',
          { 'path': item.path }
        );

        if (result.success) {
          window.showInformationMessage(`Teleported to ${item.name}`);
        } else {
          window.showErrorMessage(`Teleport failed: ${result.error ?? 'Unknown error'}`);
        }
      } catch (err) {
        window.showErrorMessage(`Teleport failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }),

    commands.registerCommand('rbxdev-ls.deleteInstance', async (item: GameTreeItem) => {
      // Confirm deletion
      const confirm = await window.showWarningMessage(
        `Delete "${item.name}" (${item.className})? This cannot be undone.`,
        { 'modal': true },
        'Delete'
      );

      if (confirm !== 'Delete') return;

      try {
        const result = await client.sendRequest<{ success: boolean; error?: string }>(
          'custom/deleteInstance',
          { 'path': item.path }
        );

        if (result.success) {
          window.showInformationMessage(`Deleted ${item.name}`);
          // Request updated game tree
          await client.sendRequest('custom/requestGameTree');
        } else {
          window.showErrorMessage(`Delete failed: ${result.error ?? 'Unknown error'}`);
        }
      } catch (err) {
        window.showErrorMessage(`Delete failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    })
  );

  // Poll status periodically (500ms for quick disconnect detection)
  const statusInterval = setInterval(() => pollExecutorStatus(), 500);
  context.subscriptions.push({ 'dispose': () => clearInterval(statusInterval) });

  // Initial status poll after client is ready (use timeout as client starts asynchronously)
  setTimeout(() => pollExecutorStatus(), 1000);

  console.log('rbxdev-ls extension activated');
}

export async function deactivate(): Promise<void> {
  if (client) {
    await client.stop();
  }
}
