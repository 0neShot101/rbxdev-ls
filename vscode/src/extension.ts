import * as path from 'path';
import * as fs from 'fs';

import { commands, env, ExtensionContext, OutputChannel, StatusBarAlignment, StatusBarItem, Uri, window, workspace } from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient/node';

import { GameTreeDataProvider, type GameTreeItem, type GameTreeNode } from './gameTreeProvider';
import { type PropertyEntry, type PropertyItem } from './propertiesProvider';
import { PropertiesWebviewProvider } from './propertiesWebview';
import { registerMcpTools } from './mcpTools';

let client: LanguageClient;
let statusBarItem: StatusBarItem;
let executeButton: StatusBarItem;
let outputChannel: OutputChannel;
let remoteSpyChannel: OutputChannel;
let gameTreeProvider: GameTreeDataProvider;
let propertiesProvider: PropertiesWebviewProvider;
let lastConnectedState: boolean = false;
let lastExecutorName: string | undefined;
let remoteSpyStatusBar: StatusBarItem;
let lastRemoteCalls: Array<{
  remoteName: string;
  remotePath: string[];
  remoteType: string;
  method: string;
  arguments: string;
  timestamp: number;
}> = [];

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
  console.log('[rbxdev-ls] Extension activating...');

  // Path to the server module (bundled inside extension)
  const serverModule = context.asAbsolutePath(path.join('server', 'index.js'));

  // Check if server exists
  if (!fs.existsSync(serverModule)) {
    console.error('[rbxdev-ls] Server module not found:', serverModule);
    window.showErrorMessage(`rbxdev-ls: Server not found at ${serverModule}`);
    return;
  }
  console.log('[rbxdev-ls] Server module found:', serverModule);

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

  // Create Output Channel for Remote Spy
  remoteSpyChannel = window.createOutputChannel('Roblox Remote Spy');
  context.subscriptions.push(remoteSpyChannel);

  // Create Game Tree view (before client starts so it's ready)
  console.log('[rbxdev-ls] Creating Game Tree view...');
  gameTreeProvider = new GameTreeDataProvider(context.extensionPath);
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

  // Handle lazy loading of children
  gameTreeProvider.onRequestChildren(async (path) => {
    console.log('[rbxdev-ls] Requesting children for path:', path);
    try {
      const result = await client.sendRequest<{
        success: boolean;
        children?: GameTreeNode[];
        error?: string;
      }>('custom/requestChildren', { 'path': path });

      console.log('[rbxdev-ls] Children request result:', result.success, 'children:', result.children?.length ?? 'undefined', 'error:', result.error);
      if (result.success && result.children !== undefined) {
        return result.children;
      }
      return undefined;
    } catch (err) {
      console.log('[rbxdev-ls] Children request error:', err);
      return undefined;
    }
  });

  console.log('[rbxdev-ls] Game Tree view created');

  // Create Properties webview
  propertiesProvider = new PropertiesWebviewProvider(context);
  context.subscriptions.push(
    window.registerWebviewViewProvider('rbxdev-properties', propertiesProvider)
  );

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

  // Handle property changes from the webview
  propertiesProvider.onPropertyChange(async (instancePath, property, value, valueType) => {
    try {
      const result = await client.sendRequest<{ success: boolean; error?: string }>(
        'custom/setProperty',
        {
          'path': instancePath,
          'property': property,
          'value': value,
          'valueType': valueType,
        }
      );

      if (result.success) {
        // Refresh properties to show updated value
        const propsResult = await client.sendRequest<{
          success: boolean;
          properties?: PropertyEntry[];
        }>('custom/requestProperties', { 'path': instancePath });
        if (propsResult.success && propsResult.properties !== undefined) {
          propertiesProvider.setProperties(
            instancePath[instancePath.length - 1] ?? '',
            propsResult.properties,
            instancePath
          );
        }
        return true;
      } else {
        window.showErrorMessage(`Failed to set ${property}: ${result.error ?? 'Unknown error'}`);
        return false;
      }
    } catch (err) {
      window.showErrorMessage(`Failed to set ${property}: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  });

  // Helper to convert Roblox script paths to local file paths
  const convertRobloxPathToFile = (robloxPath: string, line?: number): string => {
    // Get workspace folder
    const workspaceFolders = workspace.workspaceFolders;
    if (workspaceFolders === undefined || workspaceFolders.length === 0) {
      return line !== undefined ? `${robloxPath}:${line}` : robloxPath;
    }
    const workspaceRoot = workspaceFolders[0]?.uri.fsPath;
    if (workspaceRoot === undefined) {
      return line !== undefined ? `${robloxPath}:${line}` : robloxPath;
    }

    // Parse roblox path like "game.ServerScriptService.Main" or "ServerScriptService.Main"
    const pathParts = robloxPath.replace(/^game\./, '').split('.');

    // Common service to folder mappings (based on typical rojo structure)
    const serviceMap: Record<string, string> = {
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
    if (service === undefined) {
      return line !== undefined ? `${robloxPath}:${line}` : robloxPath;
    }

    const basePath = serviceMap[service];
    if (basePath === undefined) {
      return line !== undefined ? `${robloxPath}:${line}` : robloxPath;
    }

    // Build potential file paths
    const scriptPath = pathParts.slice(1).join('/');
    const possiblePaths = [
      path.join(workspaceRoot, basePath, `${scriptPath}.server.luau`),
      path.join(workspaceRoot, basePath, `${scriptPath}.client.luau`),
      path.join(workspaceRoot, basePath, `${scriptPath}.luau`),
      path.join(workspaceRoot, basePath, `${scriptPath}.lua`),
      path.join(workspaceRoot, basePath, scriptPath, 'init.server.luau'),
      path.join(workspaceRoot, basePath, scriptPath, 'init.client.luau'),
      path.join(workspaceRoot, basePath, scriptPath, 'init.luau'),
      path.join(workspaceRoot, basePath, scriptPath, 'init.lua'),
    ];

    // Check which file exists (sync for simplicity in output formatting)
    const fs = require('fs');
    for (const filePath of possiblePaths) {
      try {
        if (fs.existsSync(filePath)) {
          return line !== undefined ? `${filePath}:${line}` : filePath;
        }
      } catch {
        // Ignore errors
      }
    }

    return line !== undefined ? `${robloxPath}:${line}` : robloxPath;
  };

  // Parse stack trace line and convert to clickable format
  const formatStackLine = (stackLine: string): string => {
    // Match patterns like:
    // "Script 'game.ServerScriptService.Main', Line 12"
    // "game.ServerScriptService.Main:12"
    // "ServerScriptService.Main:12: error message"
    const patterns = [
      /Script '([^']+)',?\s*Line (\d+)/i,
      /((?:game\.)?[\w.]+):(\d+)/,
    ];

    for (const pattern of patterns) {
      const match = stackLine.match(pattern);
      if (match !== null && match[1] !== undefined && match[2] !== undefined) {
        const robloxPath = match[1];
        const line = parseInt(match[2], 10);
        const filePath = convertRobloxPathToFile(robloxPath, line);
        // Replace the original path:line with the file path:line
        return stackLine.replace(`${robloxPath}:${line}`, filePath);
      }
    }

    return stackLine;
  };

  // Start the client (also starts the server)
  console.log('[rbxdev-ls] Starting language client...');
  client.start().then(() => {
    console.log('[rbxdev-ls] Language client started successfully');
    // Register MCP tools for GitHub Copilot
    registerMcpTools(context, client, () => lastConnectedState);

    // Handle log notifications from executor bridge
    client.onNotification('custom/log', (log: { level: string; message: string; stack?: string; timestamp: number }) => {
      const prefix = log.level === 'error' ? '[ERROR]' : log.level === 'warn' ? '[WARN]' : '[INFO]';
      const timestamp = new Date(log.timestamp * 1000).toLocaleTimeString();

      // Format message - try to convert any Roblox paths in the message
      const formattedMessage = formatStackLine(log.message);
      outputChannel.appendLine(`${timestamp} ${prefix} ${formattedMessage}`);

      if (log.stack !== undefined) {
        // Format each line of the stack trace
        const stackLines = log.stack.split('\n');
        for (const line of stackLines) {
          outputChannel.appendLine(formatStackLine(line));
        }
      }

      if (log.level === 'error') {
        outputChannel.show(true);
      }
    });

    // Handle game tree update notifications
    client.onNotification('custom/gameTreeUpdate', (nodes: GameTreeNode[]) => {
      console.log('[rbxdev-ls] Game tree update received:', nodes.length, 'services');
      // Log first service's first child to see hasChildren
      if (nodes.length > 0 && nodes[0]?.children && nodes[0].children.length > 0) {
        const firstChild = nodes[0].children[0];
        console.log('[rbxdev-ls] First child sample:', firstChild?.name, 'hasChildren:', firstChild?.hasChildren);
      }
      gameTreeProvider.refresh(nodes);
    });

    // Handle remote spy notifications
    client.onNotification('custom/remoteSpy', (call: {
      remoteName: string;
      remotePath: string[];
      remoteType: string;
      method: string;
      arguments: string;
      timestamp: number;
    }) => {
      // Store for copy functionality (keep last 100)
      lastRemoteCalls.push(call);
      if (lastRemoteCalls.length > 100) {
        lastRemoteCalls.shift();
      }

      const timestamp = new Date(call.timestamp * 1000).toLocaleTimeString();

      // Generate copyable Lua code
      const luaCode = call.arguments !== ''
        ? `game.${call.remotePath.join('.')}:${call.method}(${call.arguments})`
        : `game.${call.remotePath.join('.')}:${call.method}()`;

      // SimpleSpy-style output format
      remoteSpyChannel.appendLine('─'.repeat(60));
      remoteSpyChannel.appendLine(`[${timestamp}] ${call.method} → ${call.remoteName} (${call.remoteType})`);
      remoteSpyChannel.appendLine('');
      remoteSpyChannel.appendLine(luaCode);
      remoteSpyChannel.appendLine('');
    });
  }).catch((err) => {
    console.error('[rbxdev-ls] Failed to start language client:', err);
    window.showErrorMessage(`rbxdev-ls: Failed to start - ${err instanceof Error ? err.message : String(err)}`);
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

  // Create remote spy status bar
  remoteSpyStatusBar = window.createStatusBarItem(StatusBarAlignment.Right, 99);
  remoteSpyStatusBar.text = '$(eye-closed) Spy OFF';
  remoteSpyStatusBar.tooltip = 'Toggle Remote Spy';
  remoteSpyStatusBar.command = 'rbxdev-ls.toggleRemoteSpy';
  remoteSpyStatusBar.show();
  context.subscriptions.push(remoteSpyStatusBar);

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
      let newValue: string | undefined;

      // Handle different value types with appropriate UI
      if (item.valueType === 'boolean') {
        // Boolean: Quick pick with true/false
        const selected = await window.showQuickPick(
          [
            { 'label': 'true', 'picked': item.value === 'true' },
            { 'label': 'false', 'picked': item.value === 'false' },
          ],
          { 'title': `${item.name}`, 'placeHolder': `Current: ${item.value}` }
        );
        newValue = selected?.label;

      } else if (item.valueType === 'Color3') {
        // Color3: Show color presets + custom option
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
            'validateInput': (v) => {
              if (!/^-?\d*\.?\d+\s*,\s*-?\d*\.?\d+\s*,\s*-?\d*\.?\d+$/.test(v.trim())) {
                return 'Enter 3 numbers separated by commas';
              }
              const parts = v.split(',').map(s => parseFloat(s.trim()));
              if (parts.some(n => isNaN(n) || n < 0 || n > 1)) {
                return 'Values must be between 0 and 1';
              }
              return undefined;
            },
          });
        } else {
          newValue = selected?.value;
        }

      } else if (item.valueType === 'EnumItem') {
        // EnumItem: Try to get enum values and show as dropdown
        const enumMatch = item.value.match(/^Enum\.(\w+)\.(\w+)$/);
        if (enumMatch !== null && enumMatch[1] !== undefined) {
          const enumType = enumMatch[1];

          // Common enum values (hardcoded for common types)
          const enumValues: Record<string, string[]> = {
            'Material': ['Plastic', 'Wood', 'Slate', 'Concrete', 'CorrodedMetal', 'DiamondPlate', 'Foil', 'Grass', 'Ice', 'Marble', 'Granite', 'Brick', 'Pebble', 'Sand', 'Fabric', 'SmoothPlastic', 'Metal', 'WoodPlanks', 'Cobblestone', 'Neon', 'Glass', 'ForceField'],
            'PartType': ['Block', 'Cylinder', 'Ball', 'Wedge', 'CornerWedge'],
            'Shape': ['Block', 'Cylinder', 'Ball'],
            'Font': ['Legacy', 'Arial', 'ArialBold', 'SourceSans', 'SourceSansBold', 'SourceSansSemibold', 'SourceSansLight', 'SourceSansItalic', 'Bodoni', 'Garamond', 'Cartoon', 'Code', 'Highway', 'SciFi', 'Arcade', 'Fantasy', 'Antique', 'Gotham', 'GothamMedium', 'GothamBold', 'GothamBlack', 'Ubuntu', 'Michroma', 'TitilliumWeb', 'JosefinSans', 'Oswald', 'Merriweather', 'Roboto', 'RobotoMono', 'Sarpanch', 'SpecialElite', 'FredokaOne', 'Creepster', 'IndieFlower', 'PermanentMarker', 'DenkOne', 'BuilderSans', 'BuilderSansMedium', 'BuilderSansBold', 'BuilderSansExtraBold'],
            'SortOrder': ['LayoutOrder', 'Name', 'Custom'],
            'HorizontalAlignment': ['Center', 'Left', 'Right'],
            'VerticalAlignment': ['Center', 'Top', 'Bottom'],
            'TextXAlignment': ['Center', 'Left', 'Right'],
            'TextYAlignment': ['Center', 'Top', 'Bottom'],
            'ScaleType': ['Stretch', 'Slice', 'Tile', 'Fit', 'Crop'],
            'SizeConstraint': ['RelativeXY', 'RelativeXX', 'RelativeYY'],
            'BorderMode': ['Outline', 'Middle', 'Inset'],
            'EasingStyle': ['Linear', 'Sine', 'Back', 'Quad', 'Quart', 'Quint', 'Bounce', 'Elastic', 'Exponential', 'Circular', 'Cubic'],
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

            if (selected !== undefined) {
              newValue = `Enum.${enumType}.${selected.label}`;
            }
          } else {
            // Unknown enum, fall back to input box
            newValue = await window.showInputBox({
              'prompt': `Edit ${item.name}`,
              'value': item.value,
              'placeHolder': 'Enum.Type.Value',
            });
          }
        }

      } else if (item.valueType === 'BrickColor') {
        // BrickColor: Show common colors
        const brickColors = [
          'White', 'Grey', 'Light grey', 'Black', 'Really black',
          'Bright red', 'Bright orange', 'Bright yellow', 'Bright green', 'Bright blue',
          'Bright violet', 'Hot pink', 'Really red', 'Lime green', 'Toothpaste',
          'Cyan', 'Deep blue', 'Navy blue', 'Dark green', 'Grime',
          'Rust', 'Maroon', 'Brown', 'Reddish brown', 'Nougat',
          'Brick yellow', 'Sand red', 'Sand blue', 'Sand green', 'Teal',
          'Medium stone grey', 'Dark stone grey', 'Institutional white', 'Ghost grey',
        ].map(color => ({ 'label': color, 'picked': item.value === color }));

        const selected = await window.showQuickPick(brickColors, {
          'title': `${item.name} (BrickColor)`,
          'placeHolder': `Current: ${item.value}`,
        });

        newValue = selected?.label;

      } else {
        // Default: Input box with validation
        const validateInput = (value: string): string | undefined => {
          switch (item.valueType) {
            case 'number':
              return /^-?\d*\.?\d+$/.test(value.trim()) ? undefined : 'Enter a valid number';
            case 'Vector3':
            case 'CFrame':
              return /^-?\d*\.?\d+\s*,\s*-?\d*\.?\d+\s*,\s*-?\d*\.?\d+$/.test(value.trim())
                ? undefined : 'Enter 3 numbers: x, y, z';
            case 'Vector2':
              return /^-?\d*\.?\d+\s*,\s*-?\d*\.?\d+$/.test(value.trim())
                ? undefined : 'Enter 2 numbers: x, y';
            case 'UDim2':
              return /^\{?\s*-?\d*\.?\d+\s*,\s*-?\d+\s*\}?\s*,\s*\{?\s*-?\d*\.?\d+\s*,\s*-?\d+\s*\}?$/.test(value.trim())
                ? undefined : 'Format: {xScale, xOffset}, {yScale, yOffset}';
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
          // Refresh properties to show updated value (no message popup)
          const propsResult = await client.sendRequest<{
            success: boolean;
            properties?: PropertyEntry[];
          }>('custom/requestProperties', { 'path': item.instancePath });
          if (propsResult.success && propsResult.properties !== undefined) {
            propertiesProvider.setProperties(item.instancePath[item.instancePath.length - 1] ?? '', propsResult.properties, item.instancePath);
          }
        } else {
          window.showErrorMessage(`Failed: ${result.error ?? 'Unknown error'}`);
        }
      } catch (err) {
        window.showErrorMessage(`Failed: ${err instanceof Error ? err.message : String(err)}`);
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

    commands.registerCommand('rbxdev-ls.setupMcp', async () => {
      const mcpServerPath = context.asAbsolutePath(path.join('server', 'mcp.js'));
      const config = workspace.getConfiguration('rbxdev-ls');
      const port = config.get<number>('executorBridge.port', 21324);

      const choices = [
        { 'label': '$(folder) Add to Workspace', 'description': 'Create .vscode/mcp.json in current workspace', 'action': 'workspace' },
        { 'label': '$(home) Add to User Settings', 'description': 'Add to your global VS Code MCP configuration', 'action': 'user' },
        { 'label': '$(clippy) Copy Configuration', 'description': 'Copy the MCP config to clipboard', 'action': 'copy' },
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
        const workspaceFolders = workspace.workspaceFolders;
        if (workspaceFolders === undefined || workspaceFolders.length === 0) {
          window.showErrorMessage('No workspace folder open');
          return;
        }

        const vscodeDir = path.join(workspaceFolders[0]!.uri.fsPath, '.vscode');
        const mcpJsonPath = path.join(vscodeDir, 'mcp.json');

        try {
          if (fs.existsSync(vscodeDir) === false) {
            fs.mkdirSync(vscodeDir, { 'recursive': true });
          }

          let existingConfig: Record<string, unknown> = {};
          if (fs.existsSync(mcpJsonPath)) {
            const content = fs.readFileSync(mcpJsonPath, 'utf-8');
            existingConfig = JSON.parse(content);
          }

          const servers = (existingConfig['servers'] as Record<string, unknown>) ?? {};
          servers['rbxdev-roblox'] = mcpConfig.servers['rbxdev-roblox'];
          existingConfig['servers'] = servers;

          fs.writeFileSync(mcpJsonPath, JSON.stringify(existingConfig, null, 2));

          const doc = await workspace.openTextDocument(mcpJsonPath);
          await window.showTextDocument(doc);

          window.showInformationMessage(
            'MCP server configured! Click "Start" in the mcp.json file to activate it for Copilot.',
            'Open Copilot Chat'
          ).then((action) => {
            if (action === 'Open Copilot Chat') {
              commands.executeCommand('workbench.action.chat.open');
            }
          });
        } catch (err) {
          window.showErrorMessage(`Failed to create mcp.json: ${err instanceof Error ? err.message : String(err)}`);
        }

      } else if (selected.action === 'user') {
        await commands.executeCommand('workbench.action.openSettingsJson');
        window.showInformationMessage(
          'Add the MCP server to your settings. Run "MCP: Open User Configuration" for the dedicated MCP config file.',
          'Copy Config'
        ).then((action) => {
          if (action === 'Copy Config') {
            env.clipboard.writeText(JSON.stringify(mcpConfig, null, 2));
            window.showInformationMessage('MCP configuration copied to clipboard');
          }
        });

      } else if (selected.action === 'copy') {
        await env.clipboard.writeText(JSON.stringify(mcpConfig, null, 2));
        window.showInformationMessage('MCP configuration copied to clipboard. Paste it into .vscode/mcp.json or your user MCP config.');
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
    }),

    commands.registerCommand('rbxdev-ls.viewScript', async (item: GameTreeItem) => {
      console.log('[rbxdev-ls] viewScript called with:', item);

      // Check if item was passed (context menu should pass it)
      if (item === undefined) {
        window.showErrorMessage('No script selected');
        return;
      }

      // Validate this is a script type
      const scriptTypes = ['Script', 'LocalScript', 'ModuleScript'];
      if (scriptTypes.includes(item.className) === false) {
        window.showErrorMessage(`${item.className} is not a script type`);
        return;
      }

      try {
        await window.withProgress({
          'location': { 'viewId': 'rbxdev-gameTree' },
          'title': 'Fetching script source...',
        }, async () => {
          console.log('[rbxdev-ls] Requesting script source for:', item.path);
          const result = await client.sendRequest<{
            success: boolean;
            source?: string;
            scriptType?: string;
            error?: string;
          }>('custom/getScriptSource', { 'path': item.path });

          console.log('[rbxdev-ls] Script source result:', result.success, result.error);

          if (result.success && result.source !== undefined) {
            // Create a new untitled document with the script source
            const doc = await workspace.openTextDocument({
              'content': result.source,
              'language': 'luau',
            });
            await window.showTextDocument(doc);
          } else {
            window.showErrorMessage(`Failed to get script source: ${result.error ?? 'Unknown error'}`);
          }
        });
      } catch (err) {
        console.error('[rbxdev-ls] viewScript error:', err);
        window.showErrorMessage(`Failed to get script source: ${err instanceof Error ? err.message : String(err)}`);
      }
    }),

    commands.registerCommand('rbxdev-ls.createInstance', async (item: GameTreeItem) => {
      // Common Roblox classes organized by category
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
        }
      );

      if (selected === undefined || selected.className === undefined) return;

      // Ask for instance name
      const name = await window.showInputBox({
        'title': 'Instance Name',
        'prompt': `Name for new ${selected.className}`,
        'value': selected.className,
        'validateInput': (v) => {
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
        } else {
          window.showErrorMessage(`Create failed: ${result.error ?? 'Unknown error'}`);
        }
      } catch (err) {
        window.showErrorMessage(`Create failed: ${err instanceof Error ? err.message : String(err)}`);
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
        } else {
          window.showErrorMessage(`Clone failed: ${result.error ?? 'Unknown error'}`);
        }
      } catch (err) {
        window.showErrorMessage(`Clone failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }),

    commands.registerCommand('rbxdev-ls.searchGameTree', async () => {
      const searchTypes = [
        { 'label': '$(symbol-string) By Name', 'description': 'Search instances by name', 'byName': true, 'byClass': false },
        { 'label': '$(symbol-class) By Class', 'description': 'Search instances by class name', 'byName': false, 'byClass': true },
        { 'label': '$(search) By Name or Class', 'description': 'Search by both name and class', 'byName': true, 'byClass': true },
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
      if (lastConnectedState === false) {
        window.showErrorMessage('No executor connected');
        return;
      }

      try {
        // Get current status
        const status = await client.sendRequest<{ isEnabled: boolean }>('custom/getRemoteSpyStatus');
        const newEnabled = status.isEnabled === false;

        const result = await client.sendRequest<{
          success: boolean;
          enabled?: boolean;
          error?: string;
        }>('custom/setRemoteSpyEnabled', { 'enabled': newEnabled });

        if (result.success) {
          if (result.enabled === true) {
            remoteSpyStatusBar.text = '$(eye) Spy ON';
            remoteSpyStatusBar.backgroundColor = undefined;
            remoteSpyChannel.show(true);
            window.showInformationMessage('Remote Spy enabled - monitoring remote calls');
          } else {
            remoteSpyStatusBar.text = '$(eye-closed) Spy OFF';
            remoteSpyStatusBar.backgroundColor = undefined;
          }
        } else {
          window.showErrorMessage(`Failed to toggle Remote Spy: ${result.error ?? 'Unknown error'}`);
        }
      } catch (err) {
        window.showErrorMessage(`Remote Spy error: ${err instanceof Error ? err.message : String(err)}`);
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

        if (result.success) {
          window.showInformationMessage(filter === '' ? 'Remote Spy filter cleared' : `Remote Spy filter set to: ${filter}`);
        } else {
          window.showErrorMessage(`Failed to set filter: ${result.error ?? 'Unknown error'}`);
        }
      } catch (err) {
        window.showErrorMessage(`Filter error: ${err instanceof Error ? err.message : String(err)}`);
      }
    }),

    commands.registerCommand('rbxdev-ls.clearRemoteSpyOutput', () => {
      remoteSpyChannel.clear();
    }),

    commands.registerCommand('rbxdev-ls.showRemoteSpy', () => {
      remoteSpyChannel.show(true);
    }),

    commands.registerCommand('rbxdev-ls.copyLastRemoteCall', async () => {
      if (lastRemoteCalls.length === 0) {
        window.showWarningMessage('No remote calls captured yet');
        return;
      }

      // Show quick pick of recent calls
      const items = lastRemoteCalls.slice(-20).reverse().map((call, index) => {
        const luaCode = call.arguments !== ''
          ? `game.${call.remotePath.join('.')}:${call.method}(${call.arguments})`
          : `game.${call.remotePath.join('.')}:${call.method}()`;
        return {
          'label': `${call.remoteName}`,
          'description': call.method,
          'detail': luaCode,
          'luaCode': luaCode,
        };
      });

      const selected = await window.showQuickPick(items, {
        'title': 'Copy Remote Call',
        'placeHolder': 'Select a remote call to copy',
      });

      if (selected === undefined) return;

      await env.clipboard.writeText(selected.luaCode);
      window.showInformationMessage(`Copied: ${selected.luaCode}`);
    }),

    commands.registerCommand('rbxdev-ls.insertLastRemoteCall', async () => {
      const editor = window.activeTextEditor;
      if (editor === undefined) {
        window.showErrorMessage('No active editor');
        return;
      }

      if (lastRemoteCalls.length === 0) {
        window.showWarningMessage('No remote calls captured yet');
        return;
      }

      // Show quick pick of recent calls
      const items = lastRemoteCalls.slice(-20).reverse().map((call) => {
        const luaCode = call.arguments !== ''
          ? `game.${call.remotePath.join('.')}:${call.method}(${call.arguments})`
          : `game.${call.remotePath.join('.')}:${call.method}()`;
        return {
          'label': `${call.remoteName}`,
          'description': call.method,
          'detail': luaCode,
          'luaCode': luaCode,
        };
      });

      const selected = await window.showQuickPick(items, {
        'title': 'Insert Remote Call',
        'placeHolder': 'Select a remote call to insert',
      });

      if (selected === undefined) return;

      await editor.edit(editBuilder => {
        editBuilder.insert(editor.selection.active, selected.luaCode);
      });
    }),

    commands.registerCommand('rbxdev-ls.copyQuickRemote', async () => {
      if (lastRemoteCalls.length === 0) {
        window.showWarningMessage('No remote calls captured yet');
        return;
      }

      const call = lastRemoteCalls[lastRemoteCalls.length - 1];
      if (call === undefined) return;

      const luaCode = call.arguments !== ''
        ? `game.${call.remotePath.join('.')}:${call.method}(${call.arguments})`
        : `game.${call.remotePath.join('.')}:${call.method}()`;

      await env.clipboard.writeText(luaCode);
      window.showInformationMessage(`Copied: ${call.remoteName}`);
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
