/**
 * MCP Tools Registration for GitHub Copilot
 * Registers Roblox bridge tools directly with VS Code's Language Model API
 */

import * as vscode from 'vscode';

import type { LanguageClient } from 'vscode-languageclient/node';
import type { GameTreeNode } from '@typings/gameTree';
import type { PropertyEntry } from '@typings/properties';

/**
 * Wraps plain text in a language model tool result.
 */
const textResult = (text: string): vscode.LanguageModelToolResult =>
  new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(text)]);

/**
 * Builds a tool result describing a caught error.
 */
const errorResult = (error: unknown): vscode.LanguageModelToolResult =>
  textResult(`Error: ${error instanceof Error ? error.message : String(error)}`);

/**
 * Checks that a tool input value is a non-empty path array.
 */
const isPath = (value: unknown): value is string[] => Array.isArray(value) && value.length > 0;

/**
 * Escapes a value for safe embedding inside a Lua string literal.
 */
const escapeLua = (value: string): string =>
  value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/"/g, '\\"')
    .replace(/\0/g, '\\000');

/**
 * Builds a Lua expression that resolves an instance from path segments.
 */
const luaLookup = (segments: ReadonlyArray<string>): string => {
  const serviceName = segments[0];
  if (serviceName === undefined) return 'nil';

  let lookup = `game:GetService("${escapeLua(serviceName)}")`;
  for (const segment of segments.slice(1)) lookup += `:FindFirstChild("${escapeLua(segment)}")`;
  return lookup;
};

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
const renderNodes = (nodes: ReadonlyArray<GameTreeNode>, format: 'tree' | 'json'): string =>
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
  context.subscriptions.push(
    vscode.lm.registerTool('rbxdev_get_bridge_status', {
      'invoke': async () => {
        try {
          const response = await client.sendRequest<{
            isRunning: boolean;
            isConnected: boolean;
            executorName?: string;
          }>('custom/executorStatus');

          return textResult(
            JSON.stringify(
              {
                'isRunning': response.isRunning,
                'isConnected': response.isConnected,
                'executorName': response.executorName ?? null,
              },
              null,
              2,
            ),
          );
        } catch (error) {
          return errorResult(error);
        }
      },
    }),
  );

  context.subscriptions.push(
    vscode.lm.registerTool('rbxdev_execute_code', {
      'invoke': async options => {
        const code = (options.input as { code?: string })?.code;
        if (typeof code !== 'string' || code.trim() === '') return textResult('Error: code parameter is required');

        if (isConnected() === false) return textResult('Error: No executor connected. Connect an executor first.');

        try {
          const result = await client.sendRequest<{
            success: boolean;
            result?: string;
            error?: { message: string; stack?: string };
          }>('custom/execute', { code });

          if (result.success === true) return textResult(result.result ?? '(no output)');

          const stack = result.error?.stack;
          return textResult(
            `Execution error: ${result.error?.message ?? 'Unknown error'}${stack !== undefined && stack !== '' ? `\n\nStack trace:\n${stack}` : ''}`,
          );
        } catch (error) {
          return errorResult(error);
        }
      },
    }),
  );

  context.subscriptions.push(
    vscode.lm.registerTool('rbxdev_get_game_tree', {
      'invoke': async options => {
        const input = options.input as { path?: string[]; format?: 'tree' | 'json' } | undefined;
        const path = input?.path;
        const format = input?.format ?? 'tree';

        try {
          const response = await client.sendRequest<{
            success: boolean;
            nodes?: GameTreeNode[];
            node?: GameTreeNode;
            error?: string;
          }>('custom/getGameTree', { path });

          if (response.success === false) return textResult(`Error: ${response.error ?? 'Failed to get game tree'}`);

          if (path !== undefined && path.length > 0 && response.node !== undefined)
            return textResult(format === 'json' ? JSON.stringify(response.node, null, 2) : formatNode(response.node));

          if (response.nodes !== undefined) {
            const text = renderNodes(response.nodes, format);
            return textResult(text === '' ? 'No game tree data available' : text);
          }

          return textResult('No game tree data available');
        } catch (error) {
          return errorResult(error);
        }
      },
    }),
  );

  context.subscriptions.push(
    vscode.lm.registerTool('rbxdev_get_properties', {
      'invoke': async options => {
        if (isConnected() === false) return textResult('Error: No executor connected');

        const input = options.input as { path?: string[]; properties?: string[] } | undefined;
        const path = input?.path;

        if (isPath(path) === false) return textResult('Error: path parameter is required (array of strings)');

        try {
          const result = await client.sendRequest<{
            success: boolean;
            properties?: PropertyEntry[];
            error?: string;
          }>('custom/requestProperties', { path, 'properties': input?.properties });

          if (result.success === true && result.properties !== undefined) {
            const formatted = result.properties.map(formatProperty).join('\n');
            return textResult(formatted === '' ? 'No properties returned' : formatted);
          }
          return textResult(`Error: ${result.error ?? 'Failed to get properties'}`);
        } catch (error) {
          return errorResult(error);
        }
      },
    }),
  );

  context.subscriptions.push(
    vscode.lm.registerTool('rbxdev_set_property', {
      'invoke': async options => {
        if (isConnected() === false) return textResult('Error: No executor connected');

        const input = options.input as
          | {
              path?: string[];
              property?: string;
              value?: string;
              valueType?: string;
            }
          | undefined;
        const path = input?.path;

        if (isPath(path) === false) return textResult('Error: path parameter is required');

        if (
          typeof input?.property !== 'string' ||
          typeof input?.value !== 'string' ||
          typeof input?.valueType !== 'string'
        )
          return textResult('Error: property, value, and valueType parameters are required');

        try {
          const result = await client.sendRequest<{
            success: boolean;
            error?: string;
          }>('custom/setProperty', {
            path,
            'property': input.property,
            'value': input.value,
            'valueType': input.valueType,
          });

          if (result.success === true) return textResult(`Successfully set ${input.property} to ${input.value}`);
          return textResult(`Error: ${result.error ?? 'Failed to set property'}`);
        } catch (error) {
          return errorResult(error);
        }
      },
    }),
  );

  context.subscriptions.push(
    vscode.lm.registerTool('rbxdev_teleport_player', {
      'invoke': async options => {
        if (isConnected() === false) return textResult('Error: No executor connected');

        const path = (options.input as { path?: string[] } | undefined)?.path;
        if (isPath(path) === false) return textResult('Error: path parameter is required');

        try {
          const result = await client.sendRequest<{
            success: boolean;
            error?: string;
          }>('custom/teleportTo', { path });

          if (result.success === true) return textResult(`Successfully teleported to ${path.join('.')}`);
          return textResult(`Error: ${result.error ?? 'Failed to teleport'}`);
        } catch (error) {
          return errorResult(error);
        }
      },
    }),
  );

  context.subscriptions.push(
    vscode.lm.registerTool('rbxdev_delete_instance', {
      'invoke': async options => {
        if (isConnected() === false) return textResult('Error: No executor connected');

        const path = (options.input as { path?: string[] } | undefined)?.path;
        if (isPath(path) === false) return textResult('Error: path parameter is required');

        try {
          const confirmed = await vscode.window.showWarningMessage(
            `Delete ${path.join('.')}? This cannot be undone.`,
            { 'modal': true },
            'Delete',
          );
          if (confirmed !== 'Delete') return textResult('Delete cancelled by user');

          const result = await client.sendRequest<{
            success: boolean;
            error?: string;
          }>('custom/deleteInstance', { path });

          if (result.success === true) return textResult(`Successfully deleted ${path.join('.')}`);
          return textResult(`Error: ${result.error ?? 'Failed to delete instance'}`);
        } catch (error) {
          return errorResult(error);
        }
      },
    }),
  );

  context.subscriptions.push(
    vscode.lm.registerTool('rbxdev_reparent_instance', {
      'invoke': async options => {
        if (isConnected() === false) return textResult('Error: No executor connected');

        const input = options.input as { sourcePath?: string[]; targetPath?: string[] } | undefined;
        const sourcePath = input?.sourcePath;
        const targetPath = input?.targetPath;

        if (isPath(sourcePath) === false) return textResult('Error: sourcePath parameter is required');
        if (isPath(targetPath) === false) return textResult('Error: targetPath parameter is required');

        try {
          const result = await client.sendRequest<{
            success: boolean;
            error?: string;
          }>('custom/reparentInstance', { sourcePath, targetPath });

          if (result.success === true)
            return textResult(`Successfully moved ${sourcePath.join('.')} to ${targetPath.join('.')}`);
          return textResult(`Error: ${result.error ?? 'Failed to reparent instance'}`);
        } catch (error) {
          return errorResult(error);
        }
      },
    }),
  );

  context.subscriptions.push(
    vscode.lm.registerTool('rbxdev_get_children', {
      'invoke': async options => {
        if (isConnected() === false) return textResult('Error: No executor connected');

        const input = options.input as { path?: string[]; format?: 'tree' | 'json' } | undefined;
        const path = input?.path;

        if (isPath(path) === false) return textResult('Error: path parameter is required');

        const format = input?.format ?? 'tree';

        try {
          const result = await client.sendRequest<{
            success: boolean;
            children?: GameTreeNode[];
            error?: string;
          }>('custom/requestChildren', { path });

          if (result.success === true && result.children !== undefined) {
            const text = renderNodes(result.children, format);
            return textResult(text === '' ? 'No children' : text);
          }
          return textResult(`Error: ${result.error ?? 'Failed to get children'}`);
        } catch (error) {
          return errorResult(error);
        }
      },
    }),
  );

  context.subscriptions.push(
    vscode.lm.registerTool('rbxdev_get_script_source', {
      'invoke': async options => {
        if (isConnected() === false) return textResult('Error: No executor connected');

        const path = (options.input as { path?: string[] } | undefined)?.path;
        if (isPath(path) === false) return textResult('Error: path parameter is required');

        try {
          const result = await client.sendRequest<{
            success: boolean;
            source?: string;
            scriptType?: string;
            error?: string;
          }>('custom/getScriptSource', { path });

          if (result.success === true && result.source !== undefined) {
            const header = result.scriptType !== undefined ? `-- ${result.scriptType}: ${path.join('.')}\n\n` : '';
            return textResult(header + result.source);
          }
          return textResult(`Error: ${result.error ?? 'Failed to get script source'}`);
        } catch (error) {
          return errorResult(error);
        }
      },
    }),
  );

  context.subscriptions.push(
    vscode.lm.registerTool('rbxdev_create_instance', {
      'invoke': async options => {
        if (isConnected() === false) return textResult('Error: No executor connected');

        const input = options.input as
          | {
              className?: string;
              parentPath?: string[];
              name?: string;
            }
          | undefined;

        if (typeof input?.className !== 'string' || input.className.trim() === '')
          return textResult('Error: className parameter is required');

        const parentPath = input.parentPath;
        if (isPath(parentPath) === false) return textResult('Error: parentPath parameter is required');

        try {
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
            return textResult(
              `Successfully created ${result.instanceName} (${input.className}) in ${parentPath.join('.')}`,
            );
          return textResult(`Error: ${result.error ?? 'Failed to create instance'}`);
        } catch (error) {
          return errorResult(error);
        }
      },
    }),
  );

  context.subscriptions.push(
    vscode.lm.registerTool('rbxdev_clone_instance', {
      'invoke': async options => {
        if (isConnected() === false) return textResult('Error: No executor connected');

        const path = (options.input as { path?: string[] } | undefined)?.path;
        if (isPath(path) === false) return textResult('Error: path parameter is required');

        try {
          const result = await client.sendRequest<{
            success: boolean;
            cloneName?: string;
            error?: string;
          }>('custom/cloneInstance', { path });

          if (result.success === true)
            return textResult(`Successfully cloned ${path.join('.')} as ${result.cloneName}`);
          return textResult(`Error: ${result.error ?? 'Failed to clone instance'}`);
        } catch (error) {
          return errorResult(error);
        }
      },
    }),
  );

  context.subscriptions.push(
    vscode.lm.registerTool('rbxdev_get_remote_calls', {
      'invoke': async options => {
        if (isConnected() === false) return textResult('Error: No executor connected');

        const input = options.input as { limit?: number } | undefined;
        const limit = input?.limit ?? 50;

        try {
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
            if (result.calls.length === 0)
              return textResult('No remote calls captured. Make sure Remote Spy is enabled.');

            const formatted = result.calls
              .map(call => {
                const time = new Date(call.timestamp * 1000).toLocaleTimeString();
                return `[${time}] ${call.method} - ${call.remoteName} (${call.remoteType})\n  Code:\n${call.code}`;
              })
              .join('\n\n');

            return textResult(`Recent remote calls (${result.calls.length}):\n\n${formatted}`);
          }
          return textResult('Failed to get remote calls');
        } catch (error) {
          return errorResult(error);
        }
      },
    }),
  );

  context.subscriptions.push(
    vscode.lm.registerTool('rbxdev_set_remote_spy_block_list', {
      'invoke': async options => {
        if (isConnected() === false) return textResult('Error: No executor connected');

        const input = options.input as { blocks: Array<{ type: 'path' | 'name'; value: string }> };
        if (Array.isArray(input?.blocks) === false) return textResult('Error: blocks parameter is required (array)');

        try {
          const result = await client.sendRequest<{ success: boolean; error?: string }>(
            'custom/setRemoteSpyBlockList',
            { 'blocks': input.blocks },
          );

          if (result.success === true) return textResult(`Block list updated (${input.blocks.length} entries)`);
          return textResult(`Failed: ${result.error ?? 'Unknown error'}`);
        } catch (error) {
          return errorResult(error);
        }
      },
    }),
  );

  context.subscriptions.push(
    vscode.lm.registerTool('rbxdev_save_instance', {
      'invoke': async options => {
        if (isConnected() === false) return textResult('Error: No executor connected');

        const input = options.input as { path?: string[]; fileName?: string; decompile?: boolean };
        const fileName = input?.fileName ?? 'game.rbxl';
        const decompile = input?.decompile !== false;

        const parts = [`FilePath = "${escapeLua(fileName)}"`, `Decompile = ${decompile}`];
        if (input?.path !== undefined && input.path.length > 0) parts.push(`Object = ${luaLookup(input.path)}`);

        const code = `if saveinstance == nil then return "Error: saveinstance not available" end\nlocal ok, err = pcall(saveinstance, {${parts.join(', ')}})\nif ok then return "Saved to ${escapeLua(fileName)}" else return "Error: " .. tostring(err) end`;

        try {
          const result = await client.sendRequest<{
            success: boolean;
            result?: string;
            error?: { message: string };
          }>('custom/execute', { code });

          if (result.success === true) return textResult(result.result ?? `Save initiated to ${fileName}`);
          return textResult(`Save failed: ${result.error?.message ?? 'Unknown error'}`);
        } catch (error) {
          return errorResult(error);
        }
      },
    }),
  );

  if (vscode.workspace.getConfiguration('rbxdev-ls').get<boolean>('debugLogs', false))
    console.log('[rbxdev-ls] MCP tools registered with VS Code Language Model API');
};
