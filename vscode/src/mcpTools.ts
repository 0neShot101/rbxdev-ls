/**
 * MCP Tools Registration for GitHub Copilot
 * Registers Roblox bridge tools directly with VS Code's Language Model API
 */

import * as vscode from 'vscode';

import type { LanguageClient } from 'vscode-languageclient/node';

interface GameTreeNode {
  name: string;
  className: string;
  children?: GameTreeNode[];
  hasChildren?: boolean;
}

interface PropertyEntry {
  name: string;
  valueType: string;
  value: string;
  className?: string;
}

const escapeLuaString = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t').replace(/\"/g, '\\"');

const createLuaLookupFromPath = (segments: ReadonlyArray<string>): string => {
  const serviceName = segments[0];
  if (serviceName === undefined) return 'nil';

  let lookup = `game:GetService("${escapeLuaString(serviceName)}")`;
  for (const segment of segments.slice(1)) lookup += `:FindFirstChild("${escapeLuaString(segment)}")`;
  return lookup;
};

const formatGameTreeNode = (node: GameTreeNode, indent: number = 0): string => {
  const prefix = '  '.repeat(indent);
  let result = `${prefix}${node.name} (${node.className})`;

  if (node.hasChildren === true && (node.children === undefined || node.children.length === 0)) result += ' [+]';

  if (node.children !== undefined && node.children.length > 0) {
    result += '\n';
    result += node.children.map(child => formatGameTreeNode(child, indent + 1)).join('\n');
  }

  return result;
};

/**
 * Registers all Roblox bridge tools with VS Code's Language Model API
 */
export const registerMcpTools = (
  context: vscode.ExtensionContext,
  client: LanguageClient,
  getConnectionStatus: () => boolean,
): void => {
  context.subscriptions.push(
    vscode.lm.registerTool('rbxdev_get_bridge_status', {
      async invoke(_options, _token) {
        try {
          const response = await client.sendRequest<{
            isRunning: boolean;
            isConnected: boolean;
            executorName?: string;
          }>('custom/executorStatus');

          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(
              JSON.stringify(
                {
                  'isRunning': response.isRunning,
                  'isConnected': response.isConnected,
                  'executorName': response.executorName ?? null,
                },
                null,
                2,
              ),
            ),
          ]);
        } catch (err) {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(`Error: ${err instanceof Error ? err.message : String(err)}`),
          ]);
        }
      },
    }),
  );

  context.subscriptions.push(
    vscode.lm.registerTool('rbxdev_execute_code', {
      async invoke(options, _token) {
        const code = (options.input as { code?: string })?.code;
        if (typeof code !== 'string' || code.trim() === '') {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart('Error: code parameter is required'),
          ]);
        }

        if (getConnectionStatus() === false)
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart('Error: No executor connected. Connect an executor first.'),
          ]);

        try {
          const result = await client.sendRequest<{
            success: boolean;
            result?: string;
            error?: { message: string; stack?: string };
          }>('custom/execute', { code });

          if (result.success === true)
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(result.result ?? '(no output)'),
            ]);

          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(
              `Execution error: ${result.error?.message ?? 'Unknown error'}${result.error?.stack ? `\n\nStack trace:\n${result.error.stack}` : ''}`,
            ),
          ]);
        } catch (err) {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(`Error: ${err instanceof Error ? err.message : String(err)}`),
          ]);
        }
      },
    }),
  );

  context.subscriptions.push(
    vscode.lm.registerTool('rbxdev_get_game_tree', {
      async invoke(options, _token) {
        const input = options.input as { path?: string[]; format?: 'tree' | 'json' } | undefined;
        const pathArg = input?.path;
        const format = input?.format ?? 'tree';

        try {
          // Get cached game tree from server
          const response = await client.sendRequest<{
            success: boolean;
            nodes?: GameTreeNode[];
            node?: GameTreeNode;
            error?: string;
          }>('custom/getGameTree', { 'path': pathArg });

          if (response.success === false) {
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(`Error: ${response.error ?? 'Failed to get game tree'}`),
            ]);
          }

          if (pathArg !== undefined && pathArg.length > 0 && response.node !== undefined) {
            const text = format === 'json' ? JSON.stringify(response.node, null, 2) : formatGameTreeNode(response.node);
            return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(text)]);
          }

          if (response.nodes !== undefined) {
            const text =
              format === 'json'
                ? JSON.stringify(response.nodes, null, 2)
                : response.nodes.map(n => formatGameTreeNode(n)).join('\n');
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(text || 'No game tree data available'),
            ]);
          }

          return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart('No game tree data available')]);
        } catch (err) {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(`Error: ${err instanceof Error ? err.message : String(err)}`),
          ]);
        }
      },
    }),
  );

  context.subscriptions.push(
    vscode.lm.registerTool('rbxdev_get_properties', {
      async invoke(options, _token) {
        if (getConnectionStatus() === false) {
          return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart('Error: No executor connected')]);
        }

        const input = options.input as { path?: string[]; properties?: string[] } | undefined;
        const pathArg = input?.path;

        if (Array.isArray(pathArg) === false || pathArg.length === 0) {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart('Error: path parameter is required (array of strings)'),
          ]);
        }

        try {
          const result = await client.sendRequest<{
            success: boolean;
            properties?: PropertyEntry[];
            error?: string;
          }>('custom/requestProperties', { 'path': pathArg, 'properties': input?.properties });

          if (result.success && result.properties !== undefined) {
            const formatted = result.properties
              .map(p => `${p.name}: ${p.value} (${p.valueType}${p.className ? `, ${p.className}` : ''})`)
              .join('\n');
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(formatted || 'No properties returned'),
            ]);
          }
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(`Error: ${result.error ?? 'Failed to get properties'}`),
          ]);
        } catch (err) {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(`Error: ${err instanceof Error ? err.message : String(err)}`),
          ]);
        }
      },
    }),
  );

  context.subscriptions.push(
    vscode.lm.registerTool('rbxdev_set_property', {
      async invoke(options, _token) {
        if (getConnectionStatus() === false) {
          return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart('Error: No executor connected')]);
        }

        const input = options.input as
          | {
              path?: string[];
              property?: string;
              value?: string;
              valueType?: string;
            }
          | undefined;

        if (Array.isArray(input?.path) === false || input!.path!.length === 0) {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart('Error: path parameter is required'),
          ]);
        }

        if (
          typeof input?.property !== 'string' ||
          typeof input?.value !== 'string' ||
          typeof input?.valueType !== 'string'
        ) {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart('Error: property, value, and valueType parameters are required'),
          ]);
        }

        try {
          const result = await client.sendRequest<{
            success: boolean;
            error?: string;
          }>('custom/setProperty', {
            'path': input.path,
            'property': input.property,
            'value': input.value,
            'valueType': input.valueType,
          });

          if (result.success === true) {
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(`Successfully set ${input.property} to ${input.value}`),
            ]);
          }
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(`Error: ${result.error ?? 'Failed to set property'}`),
          ]);
        } catch (err) {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(`Error: ${err instanceof Error ? err.message : String(err)}`),
          ]);
        }
      },
    }),
  );

  context.subscriptions.push(
    vscode.lm.registerTool('rbxdev_teleport_player', {
      async invoke(options, _token) {
        if (getConnectionStatus() === false) {
          return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart('Error: No executor connected')]);
        }

        const input = options.input as { path?: string[] } | undefined;

        if (Array.isArray(input?.path) === false || input!.path!.length === 0) {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart('Error: path parameter is required'),
          ]);
        }

        try {
          const result = await client.sendRequest<{
            success: boolean;
            error?: string;
          }>('custom/teleportTo', { 'path': input!.path });

          if (result.success === true) {
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(`Successfully teleported to ${input!.path!.join('.')}`),
            ]);
          }
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(`Error: ${result.error ?? 'Failed to teleport'}`),
          ]);
        } catch (err) {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(`Error: ${err instanceof Error ? err.message : String(err)}`),
          ]);
        }
      },
    }),
  );

  context.subscriptions.push(
    vscode.lm.registerTool('rbxdev_delete_instance', {
      async invoke(options, _token) {
        if (getConnectionStatus() === false) {
          return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart('Error: No executor connected')]);
        }

        const input = options.input as { path?: string[] } | undefined;

        if (Array.isArray(input?.path) === false || input!.path!.length === 0) {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart('Error: path parameter is required'),
          ]);
        }

        try {
          const confirmed = await vscode.window.showWarningMessage(
            `Delete ${input!.path!.join('.')}? This cannot be undone.`,
            { 'modal': true },
            'Delete',
          );
          if (confirmed !== 'Delete')
            return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart('Delete cancelled by user')]);

          const result = await client.sendRequest<{
            success: boolean;
            error?: string;
          }>('custom/deleteInstance', { 'path': input!.path });

          if (result.success === true) {
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(`Successfully deleted ${input!.path!.join('.')}`),
            ]);
          }
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(`Error: ${result.error ?? 'Failed to delete instance'}`),
          ]);
        } catch (err) {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(`Error: ${err instanceof Error ? err.message : String(err)}`),
          ]);
        }
      },
    }),
  );

  context.subscriptions.push(
    vscode.lm.registerTool('rbxdev_reparent_instance', {
      async invoke(options, _token) {
        if (getConnectionStatus() === false) {
          return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart('Error: No executor connected')]);
        }

        const input = options.input as { sourcePath?: string[]; targetPath?: string[] } | undefined;

        if (Array.isArray(input?.sourcePath) === false || input!.sourcePath!.length === 0) {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart('Error: sourcePath parameter is required'),
          ]);
        }

        if (Array.isArray(input?.targetPath) === false || input!.targetPath!.length === 0) {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart('Error: targetPath parameter is required'),
          ]);
        }

        try {
          const result = await client.sendRequest<{
            success: boolean;
            error?: string;
          }>('custom/reparentInstance', {
            'sourcePath': input!.sourcePath,
            'targetPath': input!.targetPath,
          });

          if (result.success === true) {
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(
                `Successfully moved ${input!.sourcePath!.join('.')} to ${input!.targetPath!.join('.')}`,
              ),
            ]);
          }
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(`Error: ${result.error ?? 'Failed to reparent instance'}`),
          ]);
        } catch (err) {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(`Error: ${err instanceof Error ? err.message : String(err)}`),
          ]);
        }
      },
    }),
  );

  context.subscriptions.push(
    vscode.lm.registerTool('rbxdev_get_children', {
      async invoke(options, _token) {
        if (getConnectionStatus() === false) {
          return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart('Error: No executor connected')]);
        }

        const input = options.input as { path?: string[]; format?: 'tree' | 'json' } | undefined;

        if (Array.isArray(input?.path) === false || input!.path!.length === 0) {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart('Error: path parameter is required'),
          ]);
        }

        const format = input?.format ?? 'tree';

        try {
          const result = await client.sendRequest<{
            success: boolean;
            children?: GameTreeNode[];
            error?: string;
          }>('custom/requestChildren', { 'path': input!.path });

          if (result.success && result.children !== undefined) {
            const text =
              format === 'json'
                ? JSON.stringify(result.children, null, 2)
                : result.children.map(c => formatGameTreeNode(c)).join('\n');
            return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(text || 'No children')]);
          }
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(`Error: ${result.error ?? 'Failed to get children'}`),
          ]);
        } catch (err) {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(`Error: ${err instanceof Error ? err.message : String(err)}`),
          ]);
        }
      },
    }),
  );

  context.subscriptions.push(
    vscode.lm.registerTool('rbxdev_get_script_source', {
      async invoke(options, _token) {
        if (getConnectionStatus() === false) {
          return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart('Error: No executor connected')]);
        }

        const input = options.input as { path?: string[] } | undefined;

        if (Array.isArray(input?.path) === false || input!.path!.length === 0) {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart('Error: path parameter is required'),
          ]);
        }

        try {
          const result = await client.sendRequest<{
            success: boolean;
            source?: string;
            scriptType?: string;
            error?: string;
          }>('custom/getScriptSource', { 'path': input!.path });

          if (result.success && result.source !== undefined) {
            const header =
              result.scriptType !== undefined ? `-- ${result.scriptType}: ${input!.path!.join('.')}\n\n` : '';
            return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(header + result.source)]);
          }
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(`Error: ${result.error ?? 'Failed to get script source'}`),
          ]);
        } catch (err) {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(`Error: ${err instanceof Error ? err.message : String(err)}`),
          ]);
        }
      },
    }),
  );

  context.subscriptions.push(
    vscode.lm.registerTool('rbxdev_create_instance', {
      async invoke(options, _token) {
        if (getConnectionStatus() === false) {
          return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart('Error: No executor connected')]);
        }

        const input = options.input as
          | {
              className?: string;
              parentPath?: string[];
              name?: string;
            }
          | undefined;

        if (typeof input?.className !== 'string' || input.className.trim() === '') {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart('Error: className parameter is required'),
          ]);
        }

        if (Array.isArray(input?.parentPath) === false || input!.parentPath!.length === 0) {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart('Error: parentPath parameter is required'),
          ]);
        }

        try {
          const result = await client.sendRequest<{
            success: boolean;
            instanceName?: string;
            error?: string;
          }>('custom/createInstance', {
            'className': input.className,
            'parentPath': input.parentPath,
            'name': input.name,
          });

          if (result.success === true) {
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(
                `Successfully created ${result.instanceName} (${input.className}) in ${input.parentPath!.join('.')}`,
              ),
            ]);
          }
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(`Error: ${result.error ?? 'Failed to create instance'}`),
          ]);
        } catch (err) {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(`Error: ${err instanceof Error ? err.message : String(err)}`),
          ]);
        }
      },
    }),
  );

  context.subscriptions.push(
    vscode.lm.registerTool('rbxdev_clone_instance', {
      async invoke(options, _token) {
        if (getConnectionStatus() === false) {
          return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart('Error: No executor connected')]);
        }

        const input = options.input as { path?: string[] } | undefined;

        if (Array.isArray(input?.path) === false || input!.path!.length === 0) {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart('Error: path parameter is required'),
          ]);
        }

        try {
          const result = await client.sendRequest<{
            success: boolean;
            cloneName?: string;
            error?: string;
          }>('custom/cloneInstance', { 'path': input!.path });

          if (result.success === true) {
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(`Successfully cloned ${input!.path!.join('.')} as ${result.cloneName}`),
            ]);
          }
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(`Error: ${result.error ?? 'Failed to clone instance'}`),
          ]);
        } catch (err) {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(`Error: ${err instanceof Error ? err.message : String(err)}`),
          ]);
        }
      },
    }),
  );

  context.subscriptions.push(
    vscode.lm.registerTool('rbxdev_get_remote_calls', {
      async invoke(options, _token) {
        if (getConnectionStatus() === false) {
          return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart('Error: No executor connected')]);
        }

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

          if (result.success && result.calls !== undefined) {
            if (result.calls.length === 0) {
              return new vscode.LanguageModelToolResult([
                new vscode.LanguageModelTextPart('No remote calls captured. Make sure Remote Spy is enabled.'),
              ]);
            }

            const formatted = result.calls
              .map(call => {
                const time = new Date(call.timestamp * 1000).toLocaleTimeString();
                return `[${time}] ${call.method} - ${call.remoteName} (${call.remoteType})\n  Code:\n${call.code}`;
              })
              .join('\n\n');

            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(`Recent remote calls (${result.calls.length}):\n\n${formatted}`),
            ]);
          }
          return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart('Failed to get remote calls')]);
        } catch (err) {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(`Error: ${err instanceof Error ? err.message : String(err)}`),
          ]);
        }
      },
    }),
  );

  context.subscriptions.push(
    vscode.lm.registerTool('rbxdev_set_remote_spy_block_list', {
      async invoke(options, _token) {
        if (getConnectionStatus() === false) {
          return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart('Error: No executor connected')]);
        }

        const input = options.input as { blocks: Array<{ type: 'path' | 'name'; value: string }> };
        if (Array.isArray(input?.blocks) === false) {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart('Error: blocks parameter is required (array)'),
          ]);
        }

        try {
          const result = await client.sendRequest<{ success: boolean; error?: string }>(
            'custom/setRemoteSpyBlockList',
            { 'blocks': input.blocks },
          );

          if (result.success === true) {
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(`Block list updated (${input.blocks.length} entries)`),
            ]);
          }
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(`Failed: ${result.error ?? 'Unknown error'}`),
          ]);
        } catch (err) {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(`Error: ${err instanceof Error ? err.message : String(err)}`),
          ]);
        }
      },
    }),
  );

  context.subscriptions.push(
    vscode.lm.registerTool('rbxdev_save_instance', {
      async invoke(options, _token) {
        if (getConnectionStatus() === false) {
          return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart('Error: No executor connected')]);
        }

        const input = options.input as { path?: string[]; fileName?: string; decompile?: boolean };
        const fileName = input?.fileName ?? 'game.rbxl';
        const decompile = input?.decompile !== false;

        const optionParts: string[] = [];
        optionParts.push(`FilePath = "${escapeLuaString(fileName)}"`);
        optionParts.push(`Decompile = ${decompile}`);

        if (input?.path !== undefined && input.path.length > 0) {
          const lookup = createLuaLookupFromPath(input.path);
          optionParts.push(`Object = ${lookup}`);
        }

        const code = `if saveinstance == nil then return "Error: saveinstance not available" end\nlocal ok, err = pcall(saveinstance, {${optionParts.join(', ')}})\nif ok then return "Saved to ${escapeLuaString(fileName)}" else return "Error: " .. tostring(err) end`;

        try {
          const result = await client.sendRequest<{
            success: boolean;
            result?: string;
            error?: { message: string };
          }>('custom/execute', { code });

          if (result.success === true) {
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(result.result ?? `Save initiated to ${fileName}`),
            ]);
          }
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(`Save failed: ${result.error?.message ?? 'Unknown error'}`),
          ]);
        } catch (err) {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(`Error: ${err instanceof Error ? err.message : String(err)}`),
          ]);
        }
      },
    }),
  );

  if (vscode.workspace.getConfiguration('rbxdev-ls').get<boolean>('debugLogs', false))
    console.log('[rbxdev-ls] MCP tools registered with VS Code Language Model API');
};
