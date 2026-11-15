import * as fs from 'fs';
import * as path from 'path';

import { window, workspace } from 'vscode';

import type { ExtensionContext } from 'vscode';
import type { LanguageClient } from 'vscode-languageclient/node';
import type { ConsoleController } from '@typings/controllers';

/**
 * Creates the Roblox console: its output channel, log formatting and source-stack mapping.
 * @param context - Extension context that owns the channel.
 * @param client - Language client delivering `custom/log` notifications.
 * @returns The debug logger shared with other controllers.
 */
export const createConsole = (context: ExtensionContext, client: LanguageClient): ConsoleController => {
  const debugLoggingEnabled = workspace.getConfiguration('rbxdev-ls').get<boolean>('debugLogs', false);

  const log = (message: string): void => {
    if (debugLoggingEnabled === false) return;
    console.log(message);
  };

  const outputChannel = window.createOutputChannel('Roblox Console');
  context.subscriptions.push(outputChannel);

  const toFilePath = (robloxPath: string, line?: number): string => {
    const withLine = (value: string): string => (line !== undefined ? `${value}:${line}` : value);

    const workspaceFolders = workspace.workspaceFolders;
    if (workspaceFolders === undefined || workspaceFolders.length === 0) return withLine(robloxPath);

    const workspaceRoots = workspaceFolders.map(folder => folder.uri.fsPath);

    const pathParts = robloxPath.replace(/^game\./, '').split('.');

    const serviceDirs = new Map(
      Object.entries({
        'ServerScriptService': 'src/server',
        'ServerStorage': 'src/server/storage',
        'ReplicatedStorage': 'src/shared',
        'ReplicatedFirst': 'src/client/first',
        'StarterPlayer': 'src/client',
        'StarterPlayerScripts': 'src/client',
        'StarterCharacterScripts': 'src/client/character',
        'StarterGui': 'src/client/gui',
        'StarterPack': 'src/client/starterpack',
      }),
    );

    const service = pathParts[0];
    if (service === undefined) return withLine(robloxPath);

    const basePath = serviceDirs.get(service);
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

      for (const filePath of candidates) if (fs.existsSync(filePath)) return withLine(filePath);
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

  client.onNotification('custom/log', (log: { level: string; message: string; stack?: string; timestamp: number }) => {
    const prefix = log.level === 'error' ? '[ERROR]' : log.level === 'warn' ? '[WARN]' : '[INFO]';
    const timestamp = new Date(log.timestamp * 1000).toLocaleTimeString();

    const formattedMessage = formatStackLine(log.message);
    outputChannel.appendLine(`${timestamp} ${prefix} ${formattedMessage}`);

    if (log.stack !== undefined) {
      const stackLines = log.stack.split('\n');
      for (const line of stackLines) outputChannel.appendLine(formatStackLine(line));
    }

    if (log.level === 'error') outputChannel.show(true);
  });

  return { log };
};
