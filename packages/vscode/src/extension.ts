import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import {
  commands,
  env,
  ExtensionContext,
  OutputChannel,
  ProgressLocation,
  StatusBarAlignment,
  StatusBarItem,
  window,
  workspace,
} from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient/node';

import { GameTreeDataProvider } from './gameTreeProvider';
import { registerMcpTools } from './mcpTools';
import { PropertiesWebviewProvider } from './propertiesWebview';
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
} from './remoteSpyState';
import { RemoteSpyPanel } from './remoteSpyWebview';

import type { BridgeStatus, ExecutorStatusResponse } from '@typings/bridge';
import type { BundlerCommand, BundlerRunError } from '@typings/bundler';
import type { GameTreeItem, GameTreeNode } from '@typings/gameTree';
import type { PropertyEntry, PropertyItem } from '@typings/properties';
import type { FromWebviewMessage } from '@typings/remoteSpy';

let client: LanguageClient;
let statusBarItem: StatusBarItem;
let executeButton: StatusBarItem;
let outputChannel: OutputChannel;
let remoteSpyChannel: OutputChannel;
let gameTreeProvider: GameTreeDataProvider;
let propertiesProvider: PropertiesWebviewProvider;
let lastConnected: boolean = false;
let lastExecutorName: string | undefined;
let remoteSpyStatusBar: StatusBarItem;
let bundleMode: boolean = false;
let remoteSpyPanel: RemoteSpyPanel;
const remoteSpyState = createRemoteSpyState();
let remoteSpyEnabled = false;
let lastClientType: string | undefined;
const scriptDocumentPaths = new Map<string, string[]>();
let isPollingExecutorStatus = false;
let debugLoggingEnabled = false;
let syncSpyState: () => Promise<void> = async () => {};

const logDebug = (...args: unknown[]): void => {
  if (debugLoggingEnabled === false) return;
  console.log(...args);
};

const escapeLuaString = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t').replace(/"/g, '\\"');

const stripMarker = (segment: string): string =>
  segment.includes('\0') ? segment.slice(0, segment.indexOf('\0')) : segment;

const stripMarkers = (segments: ReadonlyArray<string>): string[] => segments.map(stripMarker);

const formatGamePath = (segments: ReadonlyArray<string>): string => `game.${stripMarkers(segments).join('.')}`;

const toLuaLookup = (segments: ReadonlyArray<string>): string => {
  const serviceName = segments[0];
  if (serviceName === undefined) return 'nil';

  let lookup = `game:GetService("${escapeLuaString(serviceName)}")`;
  for (const segment of segments.slice(1)) lookup += `:FindFirstChild("${escapeLuaString(segment)}")`;
  return lookup;
};

const getWorkspaceFolderPath = (): string | undefined => {
  const folders = workspace.workspaceFolders;
  if (folders === undefined || folders.length === 0) return undefined;
  const activeUri = window.activeTextEditor?.document.uri;
  if (activeUri !== undefined) return workspace.getWorkspaceFolder(activeUri)?.uri.fsPath ?? folders[0]?.uri.fsPath;
  return folders[0]?.uri.fsPath;
};

const resetBridgeUiState = (): void => {
  commands.executeCommand('setContext', 'rbxdev-ls:bridgeConnected', false);
  commands.executeCommand('setContext', 'rbxdev-ls:clientType', undefined);
  gameTreeProvider.clear();
  propertiesProvider.clear();
  scriptDocumentPaths.clear();
  lastClientType = undefined;
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
  if (client === undefined) return;
  const config = workspace.getConfiguration('rbxdev-ls');
  const enabled = config.get<boolean>('autoRefreshGameTree.enabled', false);
  const rawInterval = config.get<number>('autoRefreshGameTree.intervalMs', 5000);
  const intervalMs = Math.max(2000, Math.floor(rawInterval));
  try {
    await client.sendRequest('custom/setAutoRefresh', { enabled, intervalMs });
  } catch (error) {
    logDebug('[rbxdev-ls] setAutoRefresh request failed:', error);
  }
};

const pollExecutorStatus = async (): Promise<void> => {
  if (client === undefined) return;
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
      void syncSpyState();
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

const executeCode = async (
  code: string,
  successMessage: (result?: string) => string,
  failurePrefix?: string,
): Promise<void> => {
  try {
    const response = await client.sendRequest<{ success: boolean; result?: string; error?: { message: string } }>(
      'custom/execute',
      { code },
    );

    if (response.success) window.showInformationMessage(successMessage(response.result));
    else
      window.showErrorMessage(`${failurePrefix ?? 'Execution failed'}: ${response.error?.message ?? 'Unknown error'}`);
  } catch (error) {
    window.showErrorMessage(
      `${failurePrefix ?? 'Execute failed'}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

const refreshProperties = async (instancePath: ReadonlyArray<string>): Promise<void> => {
  const result = await client.sendRequest<{ success: boolean; properties?: PropertyEntry[] }>(
    'custom/requestProperties',
    { 'path': instancePath },
  );

  if (result.success && result.properties !== undefined)
    propertiesProvider.setProperties(instancePath[instancePath.length - 1] ?? '', result.properties, instancePath);
};

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

const BUNDLER_PACKAGE = '@oneshot101/luau-bundler';
const BUNDLER_BIN = 'luau-bundler';

const CMD_NOT_FOUND_EXIT_CODE = 9009;

const commandShims = (command: string): string[] =>
  process.platform === 'win32' ? [`${command}.cmd`, command] : [command];

const isMissingExecutableError = (error: unknown): boolean => {
  if (error instanceof Error === false) return false;
  const code = (error as BundlerRunError).code;
  if (code === 'ENOENT' || code === 'EINVAL' || code === CMD_NOT_FOUND_EXIT_CODE) return true;
  return /ENOENT|EINVAL|is not recognized|command not found/i.test(error.message);
};

const quoteForShell = (value: string): string => (/[\s"&^]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

const runCandidate = (candidate: BundlerCommand, args: string[], cwd: string): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    const useShell = process.platform === 'win32';
    const fullArgs = [...candidate.prefix, ...args];
    execFile(
      useShell ? quoteForShell(candidate.command) : candidate.command,
      useShell ? fullArgs.map(quoteForShell) : fullArgs,
      { cwd, 'windowsHide': true, 'shell': useShell },
      (error, _stdout, stderr) => {
        if (error !== null) {
          const message = stderr.trim() !== '' ? stderr.trim() : error.message;
          const runError = new Error(message) as BundlerRunError;
          if (typeof error.code === 'string' || typeof error.code === 'number') runError.code = error.code;
          reject(runError);
          return;
        }

        resolve();
      },
    );
  });

const runBundler = async (candidates: BundlerCommand[], args: string[], cwd: string): Promise<void> => {
  const missingLaunchers: string[] = [];

  for (const candidate of candidates) {
    try {
      await runCandidate(candidate, args, cwd);
      return;
    } catch (error) {
      if (isMissingExecutableError(error)) {
        missingLaunchers.push(candidate.label);
        continue;
      }

      throw error;
    }
  }

  throw new Error(
    `Could not find a bundler launcher (${missingLaunchers.join(', ')}). Install Node.js/npm or set rbxdev-ls.bundler.path to a luau-bundler executable.`,
  );
};

/**
 * Resolves bundler commands. Priority order:
 * 1. User-configured custom path (rbxdev-ls.bundler.path setting)
 * 2. Local workspace copy (../luau-bundler/src/cli.ts via bun, for development)
 * 3. Published package via npx/npm exec (for end users)
 * @param context - The VS Code extension context.
 * @returns Ordered command candidates and their prefix args.
 */
const resolveBundlerCommands = (context: ExtensionContext): BundlerCommand[] => {
  const config = workspace.getConfiguration('rbxdev-ls');
  const customPath = config.get<string>('bundler.path', '');
  if (customPath !== '' && fs.existsSync(customPath))
    return [{ 'command': customPath, 'prefix': [], 'label': customPath }];

  const candidates: BundlerCommand[] = [];
  const localCli = path.join(context.extensionPath, '..', 'luau-bundler', 'src', 'cli.ts');
  if (fs.existsSync(localCli))
    for (const command of commandShims('bun')) candidates.push({ command, 'prefix': [localCli], 'label': command });

  for (const command of commandShims('npx'))
    candidates.push({ command, 'prefix': ['-y', BUNDLER_PACKAGE], 'label': command });

  for (const command of commandShims('npm'))
    candidates.push({
      command,
      'prefix': ['exec', '-y', '--package', BUNDLER_PACKAGE, '--', BUNDLER_BIN],
      'label': `${command} exec`,
    });

  return candidates;
};

/**
 * Activates the extension: starts the language client, wires up the game tree,
 * properties panel, remote spy, status bar items, and all commands.
 * @param context - The VS Code extension context.
 */
export const activate = (context: ExtensionContext): void => {
  const serverModule = context.asAbsolutePath(path.join('server', 'index.js'));

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

  outputChannel = window.createOutputChannel('Roblox Console');
  context.subscriptions.push(outputChannel);

  remoteSpyChannel = window.createOutputChannel('Roblox Remote Spy');
  context.subscriptions.push(remoteSpyChannel);

  debugLoggingEnabled = workspace.getConfiguration('rbxdev-ls').get<boolean>('debugLogs', false);

  logDebug('[rbxdev-ls] Creating Game Tree view...');
  gameTreeProvider = new GameTreeDataProvider(context.extensionPath);
  const treeView = window.createTreeView('rbxdev-gameTree', {
    'treeDataProvider': gameTreeProvider,
    'showCollapseAll': true,
    'dragAndDropController': gameTreeProvider,
    'canSelectMany': false,
  });
  context.subscriptions.push(treeView);

  gameTreeProvider.onReparent(async (sourcePath, targetPath) => {
    try {
      const result = await client.sendRequest<{ success: boolean; error?: string }>('custom/reparentInstance', {
        'sourcePath': sourcePath,
        'targetPath': targetPath,
      });

      if (result.success) {
        window.showInformationMessage(
          `Moved ${sourcePath[sourcePath.length - 1]} to ${targetPath[targetPath.length - 1]}`,
        );
        await client.sendRequest('custom/requestGameTree');
      } else window.showErrorMessage(`Move failed: ${result.error ?? 'Unknown error'}`);
    } catch (error) {
      window.showErrorMessage(`Move failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  gameTreeProvider.onRequestChildren(async path => {
    logDebug('[rbxdev-ls] Requesting children for path:', path);
    try {
      const result = await client.sendRequest<{
        success: boolean;
        children?: GameTreeNode[];
        error?: string;
      }>('custom/requestChildren', { 'path': path });

      logDebug(
        '[rbxdev-ls] Children request result:',
        result.success,
        'children:',
        result.children?.length ?? 'undefined',
        'error:',
        result.error,
      );
      if (result.success && result.children !== undefined) return result.children;
      return undefined;
    } catch (error) {
      logDebug('[rbxdev-ls] Children request error:', error);
      return undefined;
    }
  });

  logDebug('[rbxdev-ls] Game Tree view created');

  propertiesProvider = new PropertiesWebviewProvider(context);
  context.subscriptions.push(window.registerWebviewViewProvider('rbxdev-properties', propertiesProvider));

  remoteSpyPanel = new RemoteSpyPanel(context);
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

  syncSpyState = async (): Promise<void> => {
    try {
      await client.sendRequest('custom/setRemoteSpyEnabled', { 'enabled': remoteSpyEnabled });
    } catch {
      /* noop */
    }

    await pushBlockList();
  };

  const pushSpyState = (): void => remoteSpyPanel.sendFullState(remoteSpyState, remoteSpyEnabled);

  const callAt = (index?: number) => (index === undefined ? undefined : remoteSpyState.calls[index]);

  remoteSpyPanel.onMessage(async (message: FromWebviewMessage) => {
    switch (message.type) {
      case 'toggleSpy': {
        if (lastConnected === false) return window.showErrorMessage('No executor connected');

        const result = await client.sendRequest<{
          success: boolean;
          enabled?: boolean;
          error?: string;
        }>('custom/setRemoteSpyEnabled', { 'enabled': message.enabled === true });
        if (result.success) {
          remoteSpyEnabled = result.enabled === true;
          remoteSpyStatusBar.text = remoteSpyEnabled ? '$(eye) Spy ON' : '$(eye-closed) Spy OFF';
          pushSpyState();
        }
        break;
      }
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

  treeView.onDidChangeSelection(async e => {
    if (e.selection.length === 0) return propertiesProvider.clear();

    const selectedItem = e.selection[0];
    if (selectedItem === undefined) return;

    try {
      const result = await client.sendRequest<{
        success: boolean;
        properties?: PropertyEntry[];
        error?: string;
      }>('custom/requestProperties', { 'path': selectedItem.path });

      if (result.success && result.properties !== undefined)
        propertiesProvider.setProperties(selectedItem.name, result.properties, selectedItem.path);
      else propertiesProvider.clear();
    } catch {
      propertiesProvider.clear();
    }
  });

  propertiesProvider.onPropertyChange(async (instancePath, property, value, valueType) => {
    try {
      const result = await client.sendRequest<{ success: boolean; error?: string }>('custom/setProperty', {
        'path': instancePath,
        'property': property,
        'value': value,
        'valueType': valueType,
      });

      if (result.success) {
        await refreshProperties(instancePath);
        return true;
      }

      window.showErrorMessage(`Failed to set ${property}: ${result.error ?? 'Unknown error'}`);
      return false;
    } catch (error) {
      window.showErrorMessage(`Failed to set ${property}: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  });

  const toFilePath = (robloxPath: string, line?: number): string => {
    const withLine = (value: string): string => (line !== undefined ? `${value}:${line}` : value);

    const workspaceFolders = workspace.workspaceFolders;
    if (workspaceFolders === undefined || workspaceFolders.length === 0) return withLine(robloxPath);

    const workspaceRoots = workspaceFolders.map(folder => folder.uri.fsPath);

    const pathParts = robloxPath.replace(/^game\./, '').split('.');

    const serviceDirs: Record<string, string> = {
      'ServerScriptService': 'src/server',
      'ServerStorage': 'src/server/storage',
      'ReplicatedStorage': 'src/shared',
      'ReplicatedFirst': 'src/client/first',
      'StarterPlayer': 'src/client',
      'StarterPlayerScripts': 'src/client',
      'StarterCharacterScripts': 'src/client/character',
      'StarterGui': 'src/client/gui',
      'StarterPack': 'src/client/starterpack',
    };

    const service = pathParts[0];
    if (service === undefined) return withLine(robloxPath);

    const basePath = serviceDirs[service];
    if (basePath === undefined) return withLine(robloxPath);

    const scriptPath = pathParts.slice(1).join('/');
    for (const workspaceRoot of workspaceRoots) {
      const candidates = [
        path.join(workspaceRoot, basePath, `${scriptPath}.server.luau`),
        path.join(workspaceRoot, basePath, `${scriptPath}.client.luau`),
        path.join(workspaceRoot, basePath, `${scriptPath}.luau`),
        path.join(workspaceRoot, basePath, `${scriptPath}.lua`),
        path.join(workspaceRoot, basePath, scriptPath, 'init.server.luau'),
        path.join(workspaceRoot, basePath, scriptPath, 'init.client.luau'),
        path.join(workspaceRoot, basePath, scriptPath, 'init.luau'),
        path.join(workspaceRoot, basePath, scriptPath, 'init.lua'),
      ];

      for (const filePath of candidates) {
        try {
          if (fs.existsSync(filePath)) return withLine(filePath);
        } catch {
          /* noop */
        }
      }
    }

    return withLine(robloxPath);
  };

  const formatStackLine = (stackLine: string): string => {
    const patterns = [/Script '([^']+)',?\s*Line (\d+)/i, /((?:game\.)?[\w.]+):(\d+)/];

    for (const pattern of patterns) {
      const match = stackLine.match(pattern);
      if (match !== null && match[1] !== undefined && match[2] !== undefined) {
        const robloxPath = match[1];
        const line = parseInt(match[2], 10);
        const filePath = toFilePath(robloxPath, line);

        return stackLine.replace(`${robloxPath}:${line}`, filePath);
      }
    }

    return stackLine;
  };

  client.start().then(() => {
    registerMcpTools(context, client, () => lastConnected);

    client.onNotification(
      'custom/log',
      (log: { level: string; message: string; stack?: string; timestamp: number }) => {
        const prefix = log.level === 'error' ? '[ERROR]' : log.level === 'warn' ? '[WARN]' : '[INFO]';
        const timestamp = new Date(log.timestamp * 1000).toLocaleTimeString();

        const formattedMessage = formatStackLine(log.message);
        outputChannel.appendLine(`${timestamp} ${prefix} ${formattedMessage}`);

        if (log.stack !== undefined) {
          const stackLines = log.stack.split('\n');
          for (const line of stackLines) outputChannel.appendLine(formatStackLine(line));
        }

        if (log.level === 'error') outputChannel.show(true);
      },
    );

    client.onNotification('custom/gameTreeUpdate', (nodes: GameTreeNode[]) => {
      logDebug('[rbxdev-ls] Game tree update received:', nodes.length, 'services');

      const firstChild = nodes[0]?.children?.[0];
      if (firstChild !== undefined)
        logDebug('[rbxdev-ls] First child sample:', firstChild.name, 'hasChildren:', firstChild.hasChildren);
      gameTreeProvider.refresh(nodes);
    });

    client.onNotification(
      'custom/remoteSpy',
      (call: {
        remoteName: string;
        remotePath: string[];
        remoteType: string;
        method: string;
        arguments: string;
        code: string;
        timestamp: number;
      }) => {
        if (remoteSpyState.paused === true) return;
        if (isCallIgnored(call, remoteSpyState.ignoreList)) return;

        addCall(remoteSpyState, call);
        const callIndex = remoteSpyState.calls.length - 1;

        remoteSpyPanel.addCall(call, callIndex);

        const timestamp = new Date(call.timestamp * 1000).toLocaleTimeString();
        remoteSpyChannel.appendLine('─'.repeat(60));
        remoteSpyChannel.appendLine(`[${timestamp}] ${call.method} → ${call.remoteName} (${call.remoteType})`);
        remoteSpyChannel.appendLine('');
        remoteSpyChannel.appendLine(call.code);
        remoteSpyChannel.appendLine('');
      },
    );
  });

  context.subscriptions.push(
    workspace.onDidSaveTextDocument(async document => {
      const scriptPath = scriptDocumentPaths.get(document.uri.toString());
      if (scriptPath === undefined) return;
      if (lastClientType !== 'studio') return;
      if (lastConnected === false) return;

      try {
        const result = await client.sendRequest<{ success: boolean; error?: string }>('custom/setScriptSource', {
          'path': scriptPath,
          'source': document.getText(),
        });

        if (result.success)
          window.setStatusBarMessage(`$(check) Pushed to Studio: ${scriptPath[scriptPath.length - 1]}`, 3000);
        else window.showErrorMessage(`Push to Studio failed: ${result.error ?? 'Unknown error'}`);
      } catch (error) {
        window.showErrorMessage(`Push to Studio failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }),
  );

  context.subscriptions.push(
    workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('rbxdev-ls.autoRefreshGameTree')) void applyAutoRefreshSetting();
    }),
  );

  statusBarItem = window.createStatusBarItem(StatusBarAlignment.Right, 100);
  statusBarItem.command = 'rbxdev-ls.toggleBridge';
  updateStatusBar('stopped');
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  const updateExecuteButton = (): void => {
    executeButton.text = bundleMode ? '$(package) Bundle & Execute' : '$(play) Roblox Execute';
    executeButton.tooltip = bundleMode
      ? 'Bundle & Execute in Roblox (Ctrl+Shift+E)'
      : 'Execute code in Roblox (Ctrl+Shift+E)';
  };
  executeButton = window.createStatusBarItem(StatusBarAlignment.Right, 101);
  executeButton.command = 'rbxdev-ls.execute';
  updateExecuteButton();
  executeButton.show();
  context.subscriptions.push(executeButton);

  remoteSpyStatusBar = window.createStatusBarItem(StatusBarAlignment.Right, 99);
  remoteSpyStatusBar.text = '$(eye-closed) Spy OFF';
  remoteSpyStatusBar.tooltip = 'Toggle Remote Spy';
  remoteSpyStatusBar.command = 'rbxdev-ls.toggleRemoteSpy';
  remoteSpyStatusBar.show();
  context.subscriptions.push(remoteSpyStatusBar);

  const initBundlerConfig = async (workspaceRoot: string): Promise<boolean> => {
    const sourceInput = await window.showInputBox({
      'prompt': 'Source directory (relative to workspace root)',
      'value': 'src',
      'placeHolder': 'src',
    });
    if (sourceInput === undefined) return false;

    const outputInput = await window.showInputBox({
      'prompt': 'Output file path (relative to workspace root)',
      'value': 'dist/out.lua',
      'placeHolder': 'dist/out.lua',
    });
    if (outputInput === undefined) return false;

    const entryInput = await window.showInputBox({
      'prompt': 'Entry module name (without extension)',
      'value': 'init',
      'placeHolder': 'init',
    });
    if (entryInput === undefined) return false;

    const config = { 'src': sourceInput, 'output': outputInput, 'entry': entryInput };
    const configPath = path.join(workspaceRoot, 'luau-bundler.config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

    const sourcePath = path.join(workspaceRoot, sourceInput);
    if (fs.existsSync(sourcePath) === false) {
      fs.mkdirSync(sourcePath, { 'recursive': true });
      const entryFile = path.join(sourcePath, `${entryInput}.luau`);
      if (fs.existsSync(entryFile) === false)
        fs.writeFileSync(entryFile, `-- ${entryInput}.luau\nprint("Hello from bundled script!")\n`);
    }

    window.showInformationMessage(`Created luau-bundler.config.json and ${sourceInput}/${entryInput}.luau`);
    return true;
  };

  const doBundleExecute = async (): Promise<void> => {
    const workspaceRoot = getWorkspaceFolderPath();
    if (workspaceRoot === undefined) return void window.showErrorMessage('No workspace folder open');

    let sourceDir = 'src';
    let outputFile = 'dist/out.lua';
    let entry = 'init';
    let project: string | undefined;

    const configPath = path.join(workspaceRoot, 'luau-bundler.config.json');
    const loadConfig = (): void => {
      try {
        const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (typeof parsed.src === 'string') sourceDir = parsed.src;
        if (typeof parsed.output === 'string') outputFile = parsed.output;
        if (typeof parsed.entry === 'string') entry = parsed.entry;
        if (typeof parsed.project === 'string') project = parsed.project;
      } catch {
        /* noop */
      }
    };

    if (fs.existsSync(configPath)) loadConfig();
    else {
      const created = await initBundlerConfig(workspaceRoot);
      if (created === false) return;
      loadConfig();
    }

    const bundlerCommands = resolveBundlerCommands(context);
    const sourceArgs = project !== undefined ? ['--project', project] : ['--src', sourceDir];
    const bundlerArgs = [...sourceArgs, '--out', outputFile, '--entry', entry];
    const outputPath = path.join(workspaceRoot, outputFile);

    try {
      await window.withProgress(
        {
          'location': ProgressLocation.Notification,
          'title': 'Bundling...',
          'cancellable': false,
        },
        () => runBundler(bundlerCommands, bundlerArgs, workspaceRoot),
      );
    } catch (error) {
      window.showErrorMessage(`Bundle failed: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }

    if (fs.existsSync(outputPath) === false)
      return void window.showErrorMessage(`Bundle output not found: ${outputFile}`);

    await executeCode(fs.readFileSync(outputPath, 'utf-8'), () => 'Bundle executed successfully');
  };

  context.subscriptions.push(
    commands.registerCommand('rbxdev-ls.execute', async () => {
      if (bundleMode === true) return doBundleExecute();

      const editor = window.activeTextEditor;
      if (editor === undefined) return window.showErrorMessage('No active editor');

      await executeCode(editor.document.getText(), result =>
        result !== undefined ? `Executed: ${result}` : 'Code executed successfully',
      );
    }),

    commands.registerCommand('rbxdev-ls.executeNormal', async () => {
      bundleMode = false;
      updateExecuteButton();
      await commands.executeCommand('rbxdev-ls.execute');
    }),

    commands.registerCommand('rbxdev-ls.executeSelection', async () => {
      const editor = window.activeTextEditor;
      if (editor === undefined) return window.showErrorMessage('No active editor');

      const code = editor.document.getText(editor.selection);
      if (code.trim().length === 0) return window.showErrorMessage('No code selected');

      await executeCode(code, () => 'Selection executed successfully');
    }),

    commands.registerCommand('rbxdev-ls.toggleBridge', async () => {
      try {
        await client.sendRequest('custom/toggleBridge');
        await pollExecutorStatus();
      } catch (error) {
        window.showErrorMessage(`Toggle failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }),

    commands.registerCommand('rbxdev-ls.copyPath', (item: GameTreeItem) => {
      const gamePath = formatGamePath(item.path);
      env.clipboard.writeText(gamePath);
      window.showInformationMessage(`Copied: ${gamePath}`);
    }),

    commands.registerCommand('rbxdev-ls.insertPath', async (item: GameTreeItem) => {
      const editor = window.activeTextEditor;
      if (editor === undefined) return window.showErrorMessage('No active editor');
      const gamePath = formatGamePath(item.path);
      await editor.edit(editBuilder => editBuilder.insert(editor.selection.active, gamePath));
    }),

    commands.registerCommand('rbxdev-ls.insertService', async (item: GameTreeItem) => {
      const editor = window.activeTextEditor;
      if (editor === undefined) return window.showErrorMessage('No active editor');
      const serviceName = item.path[0];
      if (serviceName === undefined) return;
      const escapedServiceName = escapeLuaString(serviceName);
      let serviceIdentifier = serviceName;
      if (/^[A-Za-z_]/.test(serviceIdentifier) === false) serviceIdentifier = 'service_' + serviceIdentifier;
      serviceIdentifier = serviceIdentifier.replace(/[^A-Za-z0-9_]/g, '_');
      const code = `local ${serviceIdentifier} = game:GetService("${escapedServiceName}")\n`;
      await editor.edit(editBuilder => editBuilder.insert(editor.selection.active, code));
    }),

    commands.registerCommand('rbxdev-ls.refreshGameTree', async () => {
      try {
        await client.sendRequest('custom/requestGameTree');
      } catch (error) {
        window.showErrorMessage(`Refresh failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }),

    commands.registerCommand('rbxdev-ls.editProperty', async (item: PropertyItem) => {
      let newValue: string | undefined;

      if (item.valueType === 'boolean') {
        const selected = await window.showQuickPick(
          [
            { 'label': 'true', 'picked': item.value === 'true' },
            { 'label': 'false', 'picked': item.value === 'false' },
          ],
          { 'title': `${item.name}`, 'placeHolder': `Current: ${item.value}` },
        );
        newValue = selected?.label;
      } else if (item.valueType === 'Color3') {
        const colorPresets = [
          { 'label': '$(circle-filled) White', 'description': '1, 1, 1', 'value': '1, 1, 1' },
          { 'label': '$(circle-filled) Black', 'description': '0, 0, 0', 'value': '0, 0, 0' },
          { 'label': '$(circle-filled) Red', 'description': '1, 0, 0', 'value': '1, 0, 0' },
          { 'label': '$(circle-filled) Green', 'description': '0, 1, 0', 'value': '0, 1, 0' },
          { 'label': '$(circle-filled) Blue', 'description': '0, 0, 1', 'value': '0, 0, 1' },
          { 'label': '$(circle-filled) Yellow', 'description': '1, 1, 0', 'value': '1, 1, 0' },
          { 'label': '$(circle-filled) Cyan', 'description': '0, 1, 1', 'value': '0, 1, 1' },
          { 'label': '$(circle-filled) Magenta', 'description': '1, 0, 1', 'value': '1, 0, 1' },
          { 'label': '$(circle-filled) Orange', 'description': '1, 0.5, 0', 'value': '1, 0.5, 0' },
          { 'label': '$(circle-filled) Purple', 'description': '0.5, 0, 1', 'value': '0.5, 0, 1' },
          { 'label': '$(circle-filled) Gray', 'description': '0.5, 0.5, 0.5', 'value': '0.5, 0.5, 0.5' },
          { 'label': '$(edit) Custom RGB...', 'description': 'Enter custom values', 'value': '__custom__' },
        ];

        const selected = await window.showQuickPick(colorPresets, {
          'title': `${item.name} (Color3)`,
          'placeHolder': `Current: ${item.value}`,
        });

        if (selected?.value === '__custom__') {
          newValue = await window.showInputBox({
            'prompt': `Enter RGB values (0-1)`,
            'value': item.value,
            'placeHolder': 'r, g, b (e.g., "0.5, 0.8, 1")',
            'validateInput': v => {
              if (/^-?\d*\.?\d+\s*,\s*-?\d*\.?\d+\s*,\s*-?\d*\.?\d+$/.test(v.trim()) === false)
                return 'Enter 3 numbers separated by commas';
              const parts = v.split(',').map(s => parseFloat(s.trim()));
              if (parts.some(n => isNaN(n) || n < 0 || n > 1)) return 'Values must be between 0 and 1';
              return undefined;
            },
          });
        } else newValue = selected?.value;
      } else if (item.valueType === 'EnumItem') {
        const enumMatch = item.value.match(/^Enum\.(\w+)\.(\w+)$/);
        if (enumMatch !== null && enumMatch[1] !== undefined) {
          const enumType = enumMatch[1];

          const enumValues: Record<string, string[]> = {
            'Material': [
              'Plastic',
              'Wood',
              'Slate',
              'Concrete',
              'CorrodedMetal',
              'DiamondPlate',
              'Foil',
              'Grass',
              'Ice',
              'Marble',
              'Granite',
              'Brick',
              'Pebble',
              'Sand',
              'Fabric',
              'SmoothPlastic',
              'Metal',
              'WoodPlanks',
              'Cobblestone',
              'Neon',
              'Glass',
              'ForceField',
            ],
            'PartType': ['Block', 'Cylinder', 'Ball', 'Wedge', 'CornerWedge'],
            'Shape': ['Block', 'Cylinder', 'Ball'],
            'Font': [
              'Legacy',
              'Arial',
              'ArialBold',
              'SourceSans',
              'SourceSansBold',
              'SourceSansSemibold',
              'SourceSansLight',
              'SourceSansItalic',
              'Bodoni',
              'Garamond',
              'Cartoon',
              'Code',
              'Highway',
              'SciFi',
              'Arcade',
              'Fantasy',
              'Antique',
              'Gotham',
              'GothamMedium',
              'GothamBold',
              'GothamBlack',
              'Ubuntu',
              'Michroma',
              'TitilliumWeb',
              'JosefinSans',
              'Oswald',
              'Merriweather',
              'Roboto',
              'RobotoMono',
              'Sarpanch',
              'SpecialElite',
              'FredokaOne',
              'Creepster',
              'IndieFlower',
              'PermanentMarker',
              'DenkOne',
              'BuilderSans',
              'BuilderSansMedium',
              'BuilderSansBold',
              'BuilderSansExtraBold',
            ],
            'SortOrder': ['LayoutOrder', 'Name', 'Custom'],
            'HorizontalAlignment': ['Center', 'Left', 'Right'],
            'VerticalAlignment': ['Center', 'Top', 'Bottom'],
            'TextXAlignment': ['Center', 'Left', 'Right'],
            'TextYAlignment': ['Center', 'Top', 'Bottom'],
            'ScaleType': ['Stretch', 'Slice', 'Tile', 'Fit', 'Crop'],
            'SizeConstraint': ['RelativeXY', 'RelativeXX', 'RelativeYY'],
            'BorderMode': ['Outline', 'Middle', 'Inset'],
            'EasingStyle': [
              'Linear',
              'Sine',
              'Back',
              'Quad',
              'Quart',
              'Quint',
              'Bounce',
              'Elastic',
              'Exponential',
              'Circular',
              'Cubic',
            ],
            'EasingDirection': ['In', 'Out', 'InOut'],
            'SurfaceType': ['Smooth', 'Glue', 'Weld', 'Studs', 'Inlet', 'Universal', 'Hinge', 'Motor', 'SteppingMotor'],
          };

          const values = enumValues[enumType];
          if (values !== undefined) {
            const items = values.map(v => ({
              'label': v,
              'description': `Enum.${enumType}.${v}`,
              'picked': item.value === `Enum.${enumType}.${v}`,
            }));

            const selected = await window.showQuickPick(items, {
              'title': `${item.name} (${enumType})`,
              'placeHolder': `Current: ${item.value}`,
            });

            if (selected !== undefined) newValue = `Enum.${enumType}.${selected.label}`;
          } else {
            newValue = await window.showInputBox({
              'prompt': `Edit ${item.name}`,
              'value': item.value,
              'placeHolder': 'Enum.Type.Value',
            });
          }
        }
      } else if (item.valueType === 'BrickColor') {
        const brickColors = [
          'White',
          'Grey',
          'Light grey',
          'Black',
          'Really black',
          'Bright red',
          'Bright orange',
          'Bright yellow',
          'Bright green',
          'Bright blue',
          'Bright violet',
          'Hot pink',
          'Really red',
          'Lime green',
          'Toothpaste',
          'Cyan',
          'Deep blue',
          'Navy blue',
          'Dark green',
          'Grime',
          'Rust',
          'Maroon',
          'Brown',
          'Reddish brown',
          'Nougat',
          'Brick yellow',
          'Sand red',
          'Sand blue',
          'Sand green',
          'Teal',
          'Medium stone grey',
          'Dark stone grey',
          'Institutional white',
          'Ghost grey',
        ].map(color => ({ 'label': color, 'picked': item.value === color }));

        const selected = await window.showQuickPick(brickColors, {
          'title': `${item.name} (BrickColor)`,
          'placeHolder': `Current: ${item.value}`,
        });

        newValue = selected?.label;
      } else {
        const validateInput = (value: string): string | undefined => {
          switch (item.valueType) {
            case 'number':
              return /^-?\d*\.?\d+$/.test(value.trim()) ? undefined : 'Enter a valid number';
            case 'Vector3':
            case 'CFrame':
              return /^-?\d*\.?\d+\s*,\s*-?\d*\.?\d+\s*,\s*-?\d*\.?\d+$/.test(value.trim())
                ? undefined
                : 'Enter 3 numbers: x, y, z';
            case 'Vector2':
              return /^-?\d*\.?\d+\s*,\s*-?\d*\.?\d+$/.test(value.trim()) ? undefined : 'Enter 2 numbers: x, y';
            case 'UDim2':
              return /^\{?\s*-?\d*\.?\d+\s*,\s*-?\d+\s*\}?\s*,\s*\{?\s*-?\d*\.?\d+\s*,\s*-?\d+\s*\}?$/.test(
                value.trim(),
              )
                ? undefined
                : 'Format: {xScale, xOffset}, {yScale, yOffset}';
            default:
              return undefined;
          }
        };

        const placeholders: Record<string, string> = {
          'Vector3': 'x, y, z',
          'Vector2': 'x, y',
          'CFrame': 'x, y, z',
          'UDim2': '{xScale, xOffset}, {yScale, yOffset}',
          'number': 'Enter a number',
        };

        newValue = await window.showInputBox({
          'prompt': `${item.name}`,
          'value': item.value,
          'placeHolder': placeholders[item.valueType] ?? `Enter value`,
          'validateInput': validateInput,
        });
      }

      if (newValue === undefined) return;

      try {
        const result = await client.sendRequest<{ success: boolean; error?: string }>('custom/setProperty', {
          'path': item.instancePath,
          'property': item.name,
          'value': newValue,
          'valueType': item.valueType,
        });

        if (result.success) await refreshProperties(item.instancePath);
        else window.showErrorMessage(`Failed: ${result.error ?? 'Unknown error'}`);
      } catch (error) {
        window.showErrorMessage(`Failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }),

    commands.registerCommand('rbxdev-ls.teleportTo', async (item: GameTreeItem) => {
      try {
        const result = await client.sendRequest<{ success: boolean; error?: string }>('custom/teleportTo', {
          'path': item.path,
        });

        if (result.success) window.showInformationMessage(`Teleported to ${item.name}`);
        else window.showErrorMessage(`Teleport failed: ${result.error ?? 'Unknown error'}`);
      } catch (error) {
        window.showErrorMessage(`Teleport failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }),

    commands.registerCommand('rbxdev-ls.setupMcp', async () => {
      const mcpServerPath = context.asAbsolutePath(path.join('server', 'mcp.js'));
      const config = workspace.getConfiguration('rbxdev-ls');
      const port = config.get<number>('executorBridge.port', 21324);

      const choices = [
        {
          'label': '$(folder) Add to Workspace',
          'description': 'Create .vscode/mcp.json in current workspace',
          'action': 'workspace',
        },
        {
          'label': '$(home) Add to User Settings',
          'description': 'Add to your global VS Code MCP configuration',
          'action': 'user',
        },
        {
          'label': '$(clippy) Copy Configuration',
          'description': 'Copy the MCP config to clipboard',
          'action': 'copy',
        },
      ];

      const selected = await window.showQuickPick(choices, {
        'title': 'Setup MCP Server for GitHub Copilot',
        'placeHolder': 'Choose how to configure the MCP server',
      });

      if (selected === undefined) return;

      const mcpConfig = {
        'servers': {
          'rbxdev-roblox': {
            'type': 'stdio',
            'command': 'node',
            'args': [mcpServerPath],
            'env': {
              'RBXDEV_BRIDGE_PORT': String(port),
            },
          },
        },
      };

      if (selected.action === 'workspace') {
        const workspaceRoot = getWorkspaceFolderPath();
        if (workspaceRoot === undefined) return window.showErrorMessage('No workspace folder open');

        const vscodeDir = path.join(workspaceRoot, '.vscode');
        const mcpJsonPath = path.join(vscodeDir, 'mcp.json');

        try {
          if (fs.existsSync(vscodeDir) === false) fs.mkdirSync(vscodeDir, { 'recursive': true });

          let existingConfig: Record<string, unknown> = {};
          if (fs.existsSync(mcpJsonPath)) {
            const content = fs.readFileSync(mcpJsonPath, 'utf-8');
            existingConfig = JSON.parse(content);
          }

          const servers = (existingConfig['servers'] as Record<string, unknown>) ?? {};
          servers['rbxdev-roblox'] = mcpConfig.servers['rbxdev-roblox'];
          existingConfig['servers'] = servers;

          fs.writeFileSync(mcpJsonPath, JSON.stringify(existingConfig, null, 2));

          const document = await workspace.openTextDocument(mcpJsonPath);
          await window.showTextDocument(document);

          window
            .showInformationMessage(
              'MCP server configured! Click "Start" in the mcp.json file to activate it for Copilot.',
              'Open Copilot Chat',
            )
            .then(action => {
              if (action === 'Open Copilot Chat') commands.executeCommand('workbench.action.chat.open');
            });
        } catch (error) {
          window.showErrorMessage(
            `Failed to create mcp.json: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      } else if (selected.action === 'user') {
        await commands.executeCommand('workbench.action.openSettingsJson');
        window
          .showInformationMessage(
            'Add the MCP server to your settings. Run "MCP: Open User Configuration" for the dedicated MCP config file.',
            'Copy Config',
          )
          .then(action => {
            if (action === 'Copy Config') {
              env.clipboard.writeText(JSON.stringify(mcpConfig, null, 2));
              window.showInformationMessage('MCP configuration copied to clipboard');
            }
          });
      } else if (selected.action === 'copy') {
        await env.clipboard.writeText(JSON.stringify(mcpConfig, null, 2));
        window.showInformationMessage(
          'MCP configuration copied to clipboard. Paste it into .vscode/mcp.json or your user MCP config.',
        );
      }
    }),

    commands.registerCommand('rbxdev-ls.deleteInstance', async (item: GameTreeItem) => {
      const confirm = await window.showWarningMessage(
        `Delete "${item.name}" (${item.className})? This cannot be undone.`,
        { 'modal': true },
        'Delete',
      );

      if (confirm !== 'Delete') return;

      try {
        const result = await client.sendRequest<{ success: boolean; error?: string }>('custom/deleteInstance', {
          'path': item.path,
        });

        if (result.success) {
          window.showInformationMessage(`Deleted ${item.name}`);
          await client.sendRequest('custom/requestGameTree');
        } else window.showErrorMessage(`Delete failed: ${result.error ?? 'Unknown error'}`);
      } catch (error) {
        window.showErrorMessage(`Delete failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }),

    commands.registerCommand('rbxdev-ls.viewScript', async (item: GameTreeItem) => {
      logDebug('[rbxdev-ls] viewScript called with:', item);

      if (item === undefined) return window.showErrorMessage('No script selected');

      const scriptTypes = ['Script', 'LocalScript', 'ModuleScript'];
      if (scriptTypes.includes(item.className) === false)
        return window.showErrorMessage(`${item.className} is not a script type`);

      try {
        await window.withProgress(
          {
            'location': { 'viewId': 'rbxdev-gameTree' },
            'title': 'Fetching script source...',
          },
          async () => {
            logDebug('[rbxdev-ls] Requesting script source for:', item.path);
            const result = await client.sendRequest<{
              success: boolean;
              source?: string;
              scriptType?: string;
              error?: string;
            }>('custom/getScriptSource', { 'path': item.path });

            logDebug('[rbxdev-ls] Script source result:', result.success, result.error);

            if (result.success && result.source !== undefined) {
              const cleanPath = stripMarkers(item.path);
              const scriptsDir = path.join(context.globalStorageUri.fsPath, 'studio-scripts');
              const scriptDir = path.join(scriptsDir, ...cleanPath.slice(0, -1));
              const scriptName = cleanPath[cleanPath.length - 1] ?? 'script';
              const scriptFile = path.join(scriptDir, `${scriptName}.luau`);

              if (fs.existsSync(scriptDir) === false) fs.mkdirSync(scriptDir, { 'recursive': true });
              fs.writeFileSync(scriptFile, result.source, 'utf-8');

              const document = await workspace.openTextDocument(scriptFile);
              await window.showTextDocument(document);
              scriptDocumentPaths.set(document.uri.toString(), [...item.path]);
            } else window.showErrorMessage(`Failed to get script source: ${result.error ?? 'Unknown error'}`);
          },
        );
      } catch (error) {
        console.error('[rbxdev-ls] viewScript error:', error);
        window.showErrorMessage(
          `Failed to get script source: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }),

    commands.registerCommand('rbxdev-ls.createInstance', async (item: GameTreeItem) => {
      const classCategories = [
        { 'label': '$(folder) Containers', 'kind': -1 },
        { 'label': 'Folder', 'description': 'Generic container', 'className': 'Folder' },
        { 'label': 'Model', 'description': 'Group of parts', 'className': 'Model' },
        { 'label': 'Configuration', 'description': 'Store configuration values', 'className': 'Configuration' },

        { 'label': '$(code) Scripts', 'kind': -1 },
        { 'label': 'Script', 'description': 'Server-side script', 'className': 'Script' },
        { 'label': 'LocalScript', 'description': 'Client-side script', 'className': 'LocalScript' },
        { 'label': 'ModuleScript', 'description': 'Reusable module', 'className': 'ModuleScript' },

        { 'label': '$(primitive-square) Parts', 'kind': -1 },
        { 'label': 'Part', 'description': 'Basic brick part', 'className': 'Part' },
        { 'label': 'WedgePart', 'description': 'Wedge-shaped part', 'className': 'WedgePart' },
        { 'label': 'CornerWedgePart', 'description': 'Corner wedge part', 'className': 'CornerWedgePart' },
        { 'label': 'MeshPart', 'description': 'Custom mesh part', 'className': 'MeshPart' },
        { 'label': 'SpawnLocation', 'description': 'Player spawn point', 'className': 'SpawnLocation' },

        { 'label': '$(layout) UI', 'kind': -1 },
        { 'label': 'ScreenGui', 'description': 'Screen overlay GUI', 'className': 'ScreenGui' },
        { 'label': 'BillboardGui', 'description': '3D world GUI', 'className': 'BillboardGui' },
        { 'label': 'SurfaceGui', 'description': 'Surface-attached GUI', 'className': 'SurfaceGui' },
        { 'label': 'Frame', 'description': 'GUI container', 'className': 'Frame' },
        { 'label': 'TextLabel', 'description': 'Display text', 'className': 'TextLabel' },
        { 'label': 'TextButton', 'description': 'Clickable text', 'className': 'TextButton' },
        { 'label': 'TextBox', 'description': 'Text input', 'className': 'TextBox' },
        { 'label': 'ImageLabel', 'description': 'Display image', 'className': 'ImageLabel' },
        { 'label': 'ImageButton', 'description': 'Clickable image', 'className': 'ImageButton' },

        { 'label': '$(symbol-value) Values', 'kind': -1 },
        { 'label': 'StringValue', 'description': 'Store a string', 'className': 'StringValue' },
        { 'label': 'NumberValue', 'description': 'Store a number', 'className': 'NumberValue' },
        { 'label': 'IntValue', 'description': 'Store an integer', 'className': 'IntValue' },
        { 'label': 'BoolValue', 'description': 'Store a boolean', 'className': 'BoolValue' },
        { 'label': 'ObjectValue', 'description': 'Store an instance reference', 'className': 'ObjectValue' },

        { 'label': '$(zap) Events & Communication', 'kind': -1 },
        { 'label': 'RemoteEvent', 'description': 'Client-server event', 'className': 'RemoteEvent' },
        { 'label': 'RemoteFunction', 'description': 'Client-server function', 'className': 'RemoteFunction' },
        { 'label': 'BindableEvent', 'description': 'Same-context event', 'className': 'BindableEvent' },
        { 'label': 'BindableFunction', 'description': 'Same-context function', 'className': 'BindableFunction' },
      ];

      const selected = await window.showQuickPick(
        classCategories.map(c => ({
          'label': c.label,
          'description': c.description ?? '',
          'kind': c.kind as number | undefined,
          'className': (c as { className?: string }).className,
        })),
        {
          'title': 'Create Instance',
          'placeHolder': 'Select a class to create',
        },
      );

      if (selected === undefined || selected.className === undefined) return;

      const name = await window.showInputBox({
        'title': 'Instance Name',
        'prompt': `Name for new ${selected.className}`,
        'value': selected.className,
        'validateInput': v => {
          if (v.trim() === '') return 'Name cannot be empty';
          return undefined;
        },
      });

      if (name === undefined) return;

      try {
        const result = await client.sendRequest<{
          success: boolean;
          instanceName?: string;
          error?: string;
        }>('custom/createInstance', {
          'className': selected.className,
          'parentPath': item.path,
          'name': name.trim(),
        });

        if (result.success) {
          window.showInformationMessage(`Created ${result.instanceName} in ${item.name}`);
          await client.sendRequest('custom/requestGameTree');
        } else window.showErrorMessage(`Create failed: ${result.error ?? 'Unknown error'}`);
      } catch (error) {
        window.showErrorMessage(`Create failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }),

    commands.registerCommand('rbxdev-ls.cloneInstance', async (item: GameTreeItem) => {
      try {
        const result = await client.sendRequest<{
          success: boolean;
          cloneName?: string;
          error?: string;
        }>('custom/cloneInstance', { 'path': item.path });

        if (result.success) {
          window.showInformationMessage(`Cloned ${item.name} as ${result.cloneName}`);
          await client.sendRequest('custom/requestGameTree');
        } else window.showErrorMessage(`Clone failed: ${result.error ?? 'Unknown error'}`);
      } catch (error) {
        window.showErrorMessage(`Clone failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }),

    commands.registerCommand('rbxdev-ls.searchGameTree', async () => {
      const searchTypes = [
        {
          'label': '$(symbol-string) By Name',
          'description': 'Search instances by name',
          'byName': true,
          'byClass': false,
        },
        {
          'label': '$(symbol-class) By Class',
          'description': 'Search instances by class name',
          'byName': false,
          'byClass': true,
        },
        {
          'label': '$(search) By Name or Class',
          'description': 'Search by both name and class',
          'byName': true,
          'byClass': true,
        },
      ];

      const searchType = await window.showQuickPick(searchTypes, {
        'title': 'Search Game Tree',
        'placeHolder': 'Select search type',
      });

      if (searchType === undefined) return;

      const query = await window.showInputBox({
        'title': 'Search Game Tree',
        'prompt': `Enter ${searchType.byName && searchType.byClass ? 'name or class' : searchType.byName ? 'name' : 'class'} to search for`,
        'placeHolder': searchType.byClass ? 'e.g., Part, Script, Folder' : 'e.g., MyFolder, PlayerScript',
      });

      if (query === undefined || query.trim() === '') return;

      gameTreeProvider.setSearchFilter(query.trim(), {
        'byName': searchType.byName,
        'byClass': searchType.byClass,
      });

      commands.executeCommand('setContext', 'rbxdev-ls:searchActive', true);
    }),

    commands.registerCommand('rbxdev-ls.clearGameTreeSearch', () => {
      gameTreeProvider.clearSearch();
      commands.executeCommand('setContext', 'rbxdev-ls:searchActive', false);
    }),

    commands.registerCommand('rbxdev-ls.toggleRemoteSpy', async () => {
      if (lastConnected === false) return window.showErrorMessage('No executor connected');

      try {
        const status = await client.sendRequest<{ isEnabled: boolean }>('custom/getRemoteSpyStatus');

        const result = await client.sendRequest<{
          success: boolean;
          enabled?: boolean;
          error?: string;
        }>('custom/setRemoteSpyEnabled', { 'enabled': status.isEnabled === false });

        if (result.success) {
          remoteSpyEnabled = result.enabled === true;
          if (remoteSpyEnabled) {
            remoteSpyStatusBar.text = '$(eye) Spy ON';
            remoteSpyStatusBar.backgroundColor = undefined;
            remoteSpyPanel.show(remoteSpyState, remoteSpyEnabled);
            window.showInformationMessage('Remote Spy enabled - monitoring remote calls');
          } else {
            remoteSpyStatusBar.text = '$(eye-closed) Spy OFF';
            remoteSpyStatusBar.backgroundColor = undefined;
          }
          remoteSpyPanel.sendFullState(remoteSpyState, remoteSpyEnabled);
        } else window.showErrorMessage(`Failed to toggle Remote Spy: ${result.error ?? 'Unknown error'}`);
      } catch (error) {
        window.showErrorMessage(`Remote Spy error: ${error instanceof Error ? error.message : String(error)}`);
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
        const result = await client.sendRequest<{
          success: boolean;
          error?: string;
        }>('custom/setRemoteSpyFilter', { 'filter': filter });

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

    commands.registerCommand('rbxdev-ls.saveGame', async () => {
      if (lastConnected === false) return window.showErrorMessage('No executor connected');

      const fileName = await window.showInputBox({
        'title': 'Save Game',
        'prompt': 'Enter the file name for the saved game',
        'value': 'game.rbxl',
        'validateInput': v => {
          if (v.trim() === '') return 'File name cannot be empty';
          if (v.endsWith('.rbxl') === false && v.endsWith('.rbxlx') === false)
            return 'File must end with .rbxl or .rbxlx';
          return undefined;
        },
      });

      if (fileName === undefined) return;

      const config = workspace.getConfiguration('rbxdev-ls');
      const decompile = config.get<boolean>('saveInstance.decompile', true);
      const noscripts = config.get<boolean>('saveInstance.noscripts', false);
      const excludeServices = config.get<string[]>('saveInstance.excludeServices', ['Chat', 'CoreGui', 'CorePackages']);

      const optionParts: string[] = [];
      optionParts.push(`FilePath = "${escapeLuaString(fileName)}"`);
      optionParts.push(`Decompile = ${decompile}`);
      if (noscripts === true) optionParts.push('NilInstances = false');
      if (excludeServices.length > 0) {
        const classNames = excludeServices.map(c => `"${escapeLuaString(c)}"`).join(', ');
        optionParts.push(`ExcludeClassNames = {${classNames}}`);
      }

      const code = `if saveinstance == nil then return "Error: saveinstance not available" end\nlocal ok, err = pcall(saveinstance, {${optionParts.join(', ')}})\nif ok then return "Saved to ${escapeLuaString(fileName)}" else return "Error: " .. tostring(err) end`;

      await window.withProgress(
        { 'location': ProgressLocation.Notification, 'title': `Saving game to ${fileName}...`, 'cancellable': false },
        () => executeCode(code, result => result ?? `Saved to ${fileName}`, 'Save failed'),
      );
    }),

    commands.registerCommand('rbxdev-ls.saveInstance', async (item: GameTreeItem) => {
      if (lastConnected === false) return window.showErrorMessage('No executor connected');
      if (item === undefined) return window.showErrorMessage('No instance selected');

      const defaultName = `${item.name}.rbxm`;
      const fileName = await window.showInputBox({
        'title': `Save ${item.name}`,
        'prompt': 'Enter the file name',
        'value': defaultName,
        'validateInput': v => {
          if (v.trim() === '') return 'File name cannot be empty';
          if (
            v.endsWith('.rbxm') === false &&
            v.endsWith('.rbxmx') === false &&
            v.endsWith('.rbxl') === false &&
            v.endsWith('.rbxlx') === false
          )
            return 'File must end with .rbxm, .rbxmx, .rbxl, or .rbxlx';
          return undefined;
        },
      });

      if (fileName === undefined) return;

      const config = workspace.getConfiguration('rbxdev-ls');
      const decompile = config.get<boolean>('saveInstance.decompile', true);

      const lookup = toLuaLookup(stripMarkers(item.path));
      const safeFileName = escapeLuaString(fileName);
      const safeItemName = escapeLuaString(item.name);

      const code = `if saveinstance == nil then return "Error: saveinstance not available" end\nlocal target = ${lookup}\nif target == nil then return "Error: instance not found" end\nlocal ok, err = pcall(saveinstance, {Object = target, FilePath = "${safeFileName}", Decompile = ${decompile}})\nif ok then return "Saved ${safeItemName} to ${safeFileName}" else return "Error: " .. tostring(err) end`;

      await window.withProgress(
        { 'location': ProgressLocation.Notification, 'title': `Saving ${item.name}...`, 'cancellable': false },
        () => executeCode(code, result => result ?? `Saved ${item.name}`, 'Save failed'),
      );
    }),

    commands.registerCommand('rbxdev-ls.bundleExecute', async () => {
      bundleMode = true;
      updateExecuteButton();
      await doBundleExecute();
    }),

    commands.registerCommand('rbxdev-ls.pushScript', async () => {
      const editor = window.activeTextEditor;
      if (editor === undefined) return window.showErrorMessage('No active editor');
      if (lastClientType !== 'studio')
        return window.showErrorMessage('Push to Studio is only available when connected to Roblox Studio');

      const scriptPath = scriptDocumentPaths.get(editor.document.uri.toString());
      if (scriptPath === undefined)
        return window.showErrorMessage(
          'This document was not opened from the Game Tree. Open a script via the Game Tree first.',
        );

      try {
        const result = await client.sendRequest<{ success: boolean; error?: string }>('custom/setScriptSource', {
          'path': scriptPath,
          'source': editor.document.getText(),
        });

        if (result.success)
          window.setStatusBarMessage(`$(check) Pushed to Studio: ${scriptPath[scriptPath.length - 1]}`, 3000);
        else window.showErrorMessage(`Push failed: ${result.error ?? 'Unknown error'}`);
      } catch (error) {
        window.showErrorMessage(`Push failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }),
  );

  const statusInterval = setInterval(() => pollExecutorStatus(), 500);
  context.subscriptions.push({ 'dispose': () => clearInterval(statusInterval) });

  setTimeout(() => pollExecutorStatus(), 1000);

  logDebug('rbxdev-ls extension activated');
};

/**
 * Deactivates the extension, stopping the language client if it was started.
 */
export const deactivate = async (): Promise<void> => {
  if (client !== undefined) await client.stop();
};
