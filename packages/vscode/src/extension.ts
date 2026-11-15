import * as path from 'path';
import { workspace } from 'vscode';
import { LanguageClient, TransportKind } from 'vscode-languageclient/node';

import { createBridge } from '#extension/controllers/bridge';
import { createConsole } from '#extension/controllers/console';
import { createExecution } from '#extension/controllers/execute';
import { createGameTree } from '#extension/controllers/gameTree';
import { registerMcpSetup } from '#extension/controllers/mcpSetup';
import { createProperties } from '#extension/controllers/properties';
import { createRemoteSpy } from '#extension/controllers/remoteSpy';
import { registerSaveCommands } from '#extension/controllers/save';
import { createScripts } from '#extension/controllers/scripts';
import { registerMcpTools } from '#extension/mcpTools';

import type { ExtensionContext } from 'vscode';
import type { LanguageClientOptions, ServerOptions } from 'vscode-languageclient/node';

const isApiAutoUpdateEnabled = (): boolean =>
  workspace.getConfiguration('rbxdev-ls').get<boolean>('api.autoUpdate', true);

let client: LanguageClient;

/**
 * Activates the extension: starts the language client, wires up the game tree,
 * properties panel, remote spy, status bar items, and all commands.
 * @param context - The VS Code extension context.
 */
export const activate = (context: ExtensionContext): void => {
  const serverModule = context.asAbsolutePath(path.join('server', 'index.js'));
  const args = [
    `--definitions-cache=${path.join(context.globalStorageUri.fsPath, 'definitions')}`,
    `--definitions-update=${isApiAutoUpdateEnabled()}`,
  ];

  const serverOptions: ServerOptions = {
    'run': {
      'module': serverModule,
      'transport': TransportKind.stdio,
      args,
    },
    'debug': {
      'module': serverModule,
      'transport': TransportKind.stdio,
      args,
      'options': {
        'execArgv': ['--nolazy', '--inspect=6009'],
      },
    },
  };

  const clientOptions: LanguageClientOptions = {
    'documentSelector': [
      { 'scheme': 'file', 'language': 'lua' },
      { 'scheme': 'file', 'language': 'luau' },
    ],
    'synchronize': {
      'fileEvents': workspace.createFileSystemWatcher('**/*.{lua,luau}'),
    },
  };

  client = new LanguageClient('rbxdev-ls', 'Roblox Luau Language Server', serverOptions, clientOptions);

  const { log } = createConsole(context, client);
  const bridge = createBridge(context, client, { log });
  const properties = createProperties(context, client);
  const gameTree = createGameTree(context, client, {
    log,
    'refreshProperties': properties.refresh,
    'clearProperties': properties.clear,
  });
  const remoteSpy = createRemoteSpy(context, client, { 'isConnected': bridge.isConnected });
  const scripts = createScripts(context, client, {
    log,
    'isConnected': bridge.isConnected,
    'clientType': bridge.clientType,
  });
  const execution = createExecution(context, client);
  registerMcpSetup(context);
  registerSaveCommands(context, { 'execute': execution.execute, 'isConnected': bridge.isConnected });

  context.subscriptions.push(
    bridge.onChange(connected => {
      if (connected) {
        void remoteSpy.sync();
        return;
      }
      gameTree.clear();
      properties.clear();
      scripts.clear();
    }),
  );

  void client.start().then(() => registerMcpTools(context, client, bridge.isConnected));

  context.subscriptions.push(
    workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('rbxdev-ls.api.autoUpdate'))
        void client.sendRequest('custom/setApiUpdates', { 'enabled': isApiAutoUpdateEnabled() });
    }),
  );

  const statusInterval = setInterval(() => bridge.poll(), 500);
  context.subscriptions.push({ 'dispose': () => clearInterval(statusInterval) });

  setTimeout(() => bridge.poll(), 1000);

  log('rbxdev-ls extension activated');
};

/**
 * Deactivates the extension, stopping the language client if it was started.
 */
export const deactivate = async (): Promise<void> => {
  if (client !== undefined) await client.stop();
};
