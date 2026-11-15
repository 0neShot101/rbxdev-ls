import * as fs from 'fs';
import * as path from 'path';

import { commands, env, window, workspace } from 'vscode';

import { isJsonObject, parseJsonObject } from '#extension/utils/json';
import { getWorkspaceFolderPath } from '#extension/utils/workspace';

import type { ExtensionContext } from 'vscode';
import type { JsonObject } from '@typings/json';

/**
 * Reads an existing MCP configuration file, or an empty configuration when none exists.
 * @throws When the file is not a JSON object.
 */
const readMcpConfig = (filePath: string): JsonObject => {
  if (fs.existsSync(filePath) === false) return {};

  const config = parseJsonObject(fs.readFileSync(filePath, 'utf-8'));
  if (config === undefined) throw new Error('mcp.json must contain a JSON object');
  return config;
};

/**
 * Registers the MCP setup command, which writes, merges or copies the MCP server configuration.
 * @param context - Extension context that owns the command.
 */
export const registerMcpSetup = (context: ExtensionContext): void =>
  void context.subscriptions.push(
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

          const existingConfig = readMcpConfig(mcpJsonPath);
          const servers = existingConfig['servers'] ?? {};
          if (isJsonObject(servers) === false) throw new Error('mcp.json "servers" must be a JSON object');

          const merged = {
            ...existingConfig,
            'servers': { ...servers, 'rbxdev-roblox': mcpConfig.servers['rbxdev-roblox'] },
          };

          fs.writeFileSync(mcpJsonPath, JSON.stringify(merged, null, 2));

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
  );
