/**
 * MCP Tools Registration for GitHub Copilot
 * Registers Roblox bridge tools directly with VS Code's Language Model API
 */

import * as vscode from 'vscode';

import { escapeLuaString, toLuaLookup } from '#extension/utils/gamePath';
import { catchTool, guardTool } from '#extension/utils/toolGuard';
import {
  isBlockListInput,
  isCreateInstanceInput,
  isEmptyInput,
  isExecuteCodeInput,
  isPathInput,
  isPropertiesInput,
  isRemoteCallsInput,
  isReparentInput,
  isSaveInstanceInput,
  isSetPropertyInput,
  isTreeInput,
} from '#extension/utils/toolInputs';

import type { LanguageClient } from 'vscode-languageclient/node';
import type { GameTreeNode } from '@typings/gameTree';
import type { ToolHandler, ToolInputGuard, TreeFormat } from '@typings/mcpTools';
import type { PropertyEntry } from '@typings/properties';

/**
 * Wraps plain text in a language model tool result.
 */
const textResult = (text: string): vscode.LanguageModelToolResult =>
  new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(text)]);

/**
 * Checks that an optional tool path is present and non-empty.
 */
const isPath = (path: ReadonlyArray<string> | undefined): path is ReadonlyArray<string> =>
  path !== undefined && path.length > 0;

/**
 * Renders a game tree node and its children as an indented text tree.
 */
const formatNode = (node: GameTreeNode, indent: number = 0): string => {
  let result = `${'  '.repeat(indent)}${node.name} (${node.className})`;

  if (node.hasChildren === true && (node.children === undefined || node.children.length === 0)) result += ' [+]';

  if (node.children !== undefined && node.children.length > 0)
    result += '\n' + node.children.map(child => formatNode(child, indent + 1)).join('\n');

  return result;
};

/**
 * Renders a list of game tree nodes as JSON or an indented text tree.
 */
const renderNodes = (nodes: ReadonlyArray<GameTreeNode>, format: TreeFormat): string =>
  format === 'json' ? JSON.stringify(nodes, null, 2) : nodes.map(node => formatNode(node)).join('\n');

/**
 * Formats a property entry as a single human-readable line.
 */
const formatProperty = (entry: PropertyEntry): string => {
  const suffix = entry.className !== undefined && entry.className !== '' ? `, ${entry.className}` : '';
  return `${entry.name}: ${entry.value} (${entry.valueType}${suffix})`;
};

/**
 * Registers all Roblox bridge tools with VS Code's Language Model API.
 * @param context - Extension context that owns the tool subscriptions.
 * @param client - Language client used to reach the bridge server.
 * @param isConnected - Returns whether an executor is currently connected.
 */
export const registerMcpTools = (
  context: vscode.ExtensionContext,
  client: LanguageClient,
  isConnected: () => boolean,
): void => {
  const register = <Input>(name: string, isInput: ToolInputGuard<Input>, handler: ToolHandler<Input>): void =>
    void context.subscriptions.push(
      vscode.lm.registerTool(name, {
        'invoke': async options =>
          textResult(isInput(options.input) ? await handler(options.input) : `Error: invalid input for ${name}`),
      }),
    );

  register(
    'rbxdev_get_bridge_status',
    isEmptyInput,
    catchTool(async () => {
      const response = await client.sendRequest<{
        isRunning: boolean;
        isConnected: boolean;
        executorName?: string;
      }>('custom/executorStatus');

      return JSON.stringify(
        {
          'isRunning': response.isRunning,
          'isConnected': response.isConnected,
          'executorName': response.executorName ?? null,
        },
        null,
        2,
      );
    }),
  );

  register(
    'rbxdev_execute_code',
    isExecuteCodeInput,
    catchTool(async ({ code }) => {
      if (code === undefined || code.trim() === '') return 'Error: code parameter is required';

      if (isConnected() === false) return 'Error: No executor connected. Connect an executor first.';

      const result = await client.sendRequest<{
        success: boolean;
        result?: string;
        error?: { message: string; stack?: string };
      }>('custom/execute', { code });

      if (result.success === true) return result.result ?? '(no output)';

      const stack = result.error?.stack;
      return `Execution error: ${result.error?.message ?? 'Unknown error'}${stack !== undefined && stack !== '' ? `\n\nStack trace:\n${stack}` : ''}`;
    }),
  );

  register(
    'rbxdev_get_game_tree',
    isTreeInput,
    catchTool(async input => {
      const path = input.path;
      const format = input.format ?? 'tree';

      const response = await client.sendRequest<{
        success: boolean;
        nodes?: GameTreeNode[];
        node?: GameTreeNode;
        error?: string;
      }>('custom/getGameTree', { path });

      if (response.success === false) return `Error: ${response.error ?? 'Failed to get game tree'}`;

      if (path !== undefined && path.length > 0 && response.node !== undefined)
        return format === 'json' ? JSON.stringify(response.node, null, 2) : formatNode(response.node);

      if (response.nodes !== undefined) {
        const text = renderNodes(response.nodes, format);
        return text === '' ? 'No game tree data available' : text;
      }

      return 'No game tree data available';
    }),
  );

  register(
    'rbxdev_get_properties',
    isPropertiesInput,
    guardTool(isConnected, async input => {
      const path = input.path;

      if (isPath(path) === false) return 'Error: path parameter is required (array of strings)';

      const result = await client.sendRequest<{
        success: boolean;
        properties?: PropertyEntry[];
        error?: string;
      }>('custom/requestProperties', { path, 'properties': input.properties });

      if (result.success === true && result.properties !== undefined) {
        const formatted = result.properties.map(formatProperty).join('\n');
        return formatted === '' ? 'No properties returned' : formatted;
      }
      return `Error: ${result.error ?? 'Failed to get properties'}`;
    }),
  );

  register(
    'rbxdev_set_property',
    isSetPropertyInput,
    guardTool(isConnected, async input => {
      const path = input.path;

      if (isPath(path) === false) return 'Error: path parameter is required';

      if (input.property === undefined || input.value === undefined || input.valueType === undefined)
        return 'Error: property, value, and valueType parameters are required';

      const result = await client.sendRequest<{
        success: boolean;
        error?: string;
      }>('custom/setProperty', {
        path,
        'property': input.property,
        'value': input.value,
        'valueType': input.valueType,
      });

      if (result.success === true) return `Successfully set ${input.property} to ${input.value}`;
      return `Error: ${result.error ?? 'Failed to set property'}`;
    }),
  );

  register(
    'rbxdev_teleport_player',
    isPathInput,
    guardTool(isConnected, async ({ path }) => {
      if (isPath(path) === false) return 'Error: path parameter is required';

      const result = await client.sendRequest<{
        success: boolean;
        error?: string;
      }>('custom/teleportTo', { path });

      if (result.success === true) return `Successfully teleported to ${path.join('.')}`;
      return `Error: ${result.error ?? 'Failed to teleport'}`;
    }),
  );

  register(
    'rbxdev_delete_instance',
    isPathInput,
    guardTool(isConnected, async ({ path }) => {
      if (isPath(path) === false) return 'Error: path parameter is required';

      const confirmed = await vscode.window.showWarningMessage(
        `Delete ${path.join('.')}? This cannot be undone.`,
        { 'modal': true },
        'Delete',
      );
      if (confirmed !== 'Delete') return 'Delete cancelled by user';

      const result = await client.sendRequest<{
        success: boolean;
        error?: string;
      }>('custom/deleteInstance', { path });

      if (result.success === true) return `Successfully deleted ${path.join('.')}`;
      return `Error: ${result.error ?? 'Failed to delete instance'}`;
    }),
  );

  register(
    'rbxdev_reparent_instance',
    isReparentInput,
    guardTool(isConnected, async ({ sourcePath, targetPath }) => {
      if (isPath(sourcePath) === false) return 'Error: sourcePath parameter is required';
      if (isPath(targetPath) === false) return 'Error: targetPath parameter is required';

      const result = await client.sendRequest<{
        success: boolean;
        error?: string;
      }>('custom/reparentInstance', { sourcePath, targetPath });

      if (result.success === true) return `Successfully moved ${sourcePath.join('.')} to ${targetPath.join('.')}`;
      return `Error: ${result.error ?? 'Failed to reparent instance'}`;
    }),
  );

  register(
    'rbxdev_get_children',
    isTreeInput,
    guardTool(isConnected, async input => {
      const path = input.path;

      if (isPath(path) === false) return 'Error: path parameter is required';

      const format = input.format ?? 'tree';

      const result = await client.sendRequest<{
        success: boolean;
        children?: GameTreeNode[];
        error?: string;
      }>('custom/requestChildren', { path });

      if (result.success === true && result.children !== undefined) {
        const text = renderNodes(result.children, format);
        return text === '' ? 'No children' : text;
      }
      return `Error: ${result.error ?? 'Failed to get children'}`;
    }),
  );

  register(
    'rbxdev_get_script_source',
    isPathInput,
    guardTool(isConnected, async ({ path }) => {
      if (isPath(path) === false) return 'Error: path parameter is required';

      const result = await client.sendRequest<{
        success: boolean;
        source?: string;
        scriptType?: string;
        error?: string;
      }>('custom/getScriptSource', { path });

      if (result.success === true && result.source !== undefined) {
        const header = result.scriptType !== undefined ? `-- ${result.scriptType}: ${path.join('.')}\n\n` : '';
        return header + result.source;
      }
      return `Error: ${result.error ?? 'Failed to get script source'}`;
    }),
  );

  register(
    'rbxdev_create_instance',
    isCreateInstanceInput,
    guardTool(isConnected, async input => {
      if (input.className === undefined || input.className.trim() === '')
        return 'Error: className parameter is required';

      const parentPath = input.parentPath;
      if (isPath(parentPath) === false) return 'Error: parentPath parameter is required';

      const result = await client.sendRequest<{
        success: boolean;
        instanceName?: string;
        error?: string;
      }>('custom/createInstance', {
        'className': input.className,
        parentPath,
        'name': input.name,
      });

      if (result.success === true)
        return `Successfully created ${result.instanceName} (${input.className}) in ${parentPath.join('.')}`;
      return `Error: ${result.error ?? 'Failed to create instance'}`;
    }),
  );

  register(
    'rbxdev_clone_instance',
    isPathInput,
    guardTool(isConnected, async ({ path }) => {
      if (isPath(path) === false) return 'Error: path parameter is required';

      const result = await client.sendRequest<{
        success: boolean;
        cloneName?: string;
        error?: string;
      }>('custom/cloneInstance', { path });

      if (result.success === true) return `Successfully cloned ${path.join('.')} as ${result.cloneName}`;
      return `Error: ${result.error ?? 'Failed to clone instance'}`;
    }),
  );

  register(
    'rbxdev_get_remote_calls',
    isRemoteCallsInput,
    guardTool(isConnected, async input => {
      const limit = input.limit ?? 50;

      const result = await client.sendRequest<{
        success: boolean;
        calls?: Array<{
          remoteName: string;
          remotePath: string[];
          remoteType: string;
          method: string;
          arguments: string;
          code: string;
          timestamp: number;
        }>;
      }>('custom/getRemoteSpyCalls', { limit });

      if (result.success === true && result.calls !== undefined) {
        if (result.calls.length === 0) return 'No remote calls captured. Make sure Remote Spy is enabled.';

        const formatted = result.calls
          .map(call => {
            const time = new Date(call.timestamp * 1000).toLocaleTimeString();
            return `[${time}] ${call.method} - ${call.remoteName} (${call.remoteType})\n  Code:\n${call.code}`;
          })
          .join('\n\n');

        return `Recent remote calls (${result.calls.length}):\n\n${formatted}`;
      }
      return 'Failed to get remote calls';
    }),
  );

  register(
    'rbxdev_set_remote_spy_block_list',
    isBlockListInput,
    guardTool(isConnected, async ({ blocks }) => {
      if (blocks === undefined) return 'Error: blocks parameter is required (array)';

      const result = await client.sendRequest<{ success: boolean; error?: string }>('custom/setRemoteSpyBlockList', {
        blocks,
      });

      if (result.success === true) return `Block list updated (${blocks.length} entries)`;
      return `Failed: ${result.error ?? 'Unknown error'}`;
    }),
  );

  register(
    'rbxdev_save_instance',
    isSaveInstanceInput,
    guardTool(isConnected, async input => {
      const fileName = input.fileName ?? 'game.rbxl';
      const decompile = input.decompile !== false;

      const parts = [`FilePath = "${escapeLuaString(fileName)}"`, `Decompile = ${decompile}`];
      if (isPath(input.path)) parts.push(`Object = ${toLuaLookup(input.path)}`);

      const code = `if saveinstance == nil then return "Error: saveinstance not available" end\nlocal ok, err = pcall(saveinstance, {${parts.join(', ')}})\nif ok then return "Saved to ${escapeLuaString(fileName)}" else return "Error: " .. tostring(err) end`;

      const result = await client.sendRequest<{
        success: boolean;
        result?: string;
        error?: { message: string };
      }>('custom/execute', { code });

      if (result.success === true) return result.result ?? `Save initiated to ${fileName}`;
      return `Save failed: ${result.error?.message ?? 'Unknown error'}`;
    }),
  );

  if (vscode.workspace.getConfiguration('rbxdev-ls').get<boolean>('debugLogs', false))
    console.log('[rbxdev-ls] MCP tools registered with VS Code Language Model API');
};
