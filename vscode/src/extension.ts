import * as path from 'path';

import { commands, ExtensionContext, StatusBarAlignment, StatusBarItem, window, workspace } from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient/node';

let client: LanguageClient;
let statusBarItem: StatusBarItem;
let executeButton: StatusBarItem;
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
    } else if (response.isConnected === false && lastConnectedState) {
      window.showWarningMessage(`Roblox: ${lastExecutorName ?? 'Executor'} disconnected`);
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

  // Start the client (also starts the server)
  client.start();

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
