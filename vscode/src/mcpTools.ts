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

const formatGameTreeNode = (node: GameTreeNode, indent: number = 0): string => {
  const prefix = '  '.repeat(indent);
  let result = `${prefix}${node.name} (${node.className})`;

  if (node.hasChildren === true && (node.children === undefined || node.children.length === 0))
    result += ' [+]';

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
  getConnectionStatus: () => boolean
): void => {
  // Get Bridge Status Tool
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
            new vscode.LanguageModelTextPart(JSON.stringify({
              isRunning: response.isRunning,
              isConnected: response.isConnected,
              executorName: response.executorName ?? null,
            }, null, 2)),
          ]);
        } catch (err) {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(`Error: ${err instanceof Error ? err.message : String(err)}`),
          ]);
        }
      },
    })
  );

  // Execute Code Tool
  context.subscriptions.push(
    vscode.lm.registerTool('rbxdev_execute_code', {
      async invoke(options, _token) {
        const code = (options.input as { code?: string })?.code;
        if (typeof code !== 'string' || code.trim() === '') {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart('Error: code parameter is required'),
          ]);
        }

        if (getConnectionStatus() === false) {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart('Error: No executor connected. Connect an executor first.'),
          ]);
        }

        try {
          const result = await client.sendRequest<{
            success: boolean;
            result?: string;
            error?: { message: string; stack?: string };
          }>('custom/execute', { code });

          if (result.success) {
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(result.result ?? '(no output)'),
            ]);
          }
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(
              `Execution error: ${result.error?.message ?? 'Unknown error'}${result.error?.stack ? `\n\nStack trace:\n${result.error.stack}` : ''}`
            ),
          ]);
        } catch (err) {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(`Error: ${err instanceof Error ? err.message : String(err)}`),
          ]);
        }
      },
    })
  );

  // Get Game Tree Tool
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
          }>('custom/getGameTree', { path: pathArg });

          if (response.success === false) {
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(`Error: ${response.error ?? 'Failed to get game tree'}`),
            ]);
          }

          if (pathArg !== undefined && pathArg.length > 0 && response.node !== undefined) {
            const text = format === 'json'
              ? JSON.stringify(response.node, null, 2)
              : formatGameTreeNode(response.node);
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(text),
            ]);
          }

          if (response.nodes !== undefined) {
            const text = format === 'json'
              ? JSON.stringify(response.nodes, null, 2)
              : response.nodes.map(n => formatGameTreeNode(n)).join('\n');
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(text || 'No game tree data available'),
            ]);
          }

          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart('No game tree data available'),
          ]);
        } catch (err) {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(`Error: ${err instanceof Error ? err.message : String(err)}`),
          ]);
        }
      },
    })
  );

  // Get Properties Tool
  context.subscriptions.push(
    vscode.lm.registerTool('rbxdev_get_properties', {
      async invoke(options, _token) {
        if (getConnectionStatus() === false) {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart('Error: No executor connected'),
          ]);
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
          }>('custom/requestProperties', { path: pathArg, properties: input?.properties });

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
    })
  );

  // Set Property Tool
  context.subscriptions.push(
    vscode.lm.registerTool('rbxdev_set_property', {
      async invoke(options, _token) {
        if (getConnectionStatus() === false) {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart('Error: No executor connected'),
          ]);
        }

        const input = options.input as {
          path?: string[];
          property?: string;
          value?: string;
          valueType?: string;
        } | undefined;

        if (Array.isArray(input?.path) === false || input!.path!.length === 0) {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart('Error: path parameter is required'),
          ]);
        }

        if (typeof input?.property !== 'string' || typeof input?.value !== 'string' || typeof input?.valueType !== 'string') {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart('Error: property, value, and valueType parameters are required'),
          ]);
        }

        try {
          const result = await client.sendRequest<{
            success: boolean;
            error?: string;
          }>('custom/setProperty', {
            path: input.path,
            property: input.property,
            value: input.value,
            valueType: input.valueType,
          });

          if (result.success) {
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
    })
  );

  // Teleport Player Tool
  context.subscriptions.push(
    vscode.lm.registerTool('rbxdev_teleport_player', {
      async invoke(options, _token) {
        if (getConnectionStatus() === false) {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart('Error: No executor connected'),
          ]);
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
          }>('custom/teleportTo', { path: input!.path });

          if (result.success) {
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
    })
  );

  // Delete Instance Tool
  context.subscriptions.push(
    vscode.lm.registerTool('rbxdev_delete_instance', {
      async invoke(options, _token) {
        if (getConnectionStatus() === false) {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart('Error: No executor connected'),
          ]);
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
          }>('custom/deleteInstance', { path: input!.path });

          if (result.success) {
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
    })
  );

  // Reparent Instance Tool
  context.subscriptions.push(
    vscode.lm.registerTool('rbxdev_reparent_instance', {
      async invoke(options, _token) {
        if (getConnectionStatus() === false) {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart('Error: No executor connected'),
          ]);
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
            sourcePath: input!.sourcePath,
            targetPath: input!.targetPath,
          });

          if (result.success) {
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(
                `Successfully moved ${input!.sourcePath!.join('.')} to ${input!.targetPath!.join('.')}`
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
    })
  );

  // Get Children Tool (lazy loading)
  context.subscriptions.push(
    vscode.lm.registerTool('rbxdev_get_children', {
      async invoke(options, _token) {
        if (getConnectionStatus() === false) {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart('Error: No executor connected'),
          ]);
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
          }>('custom/requestChildren', { path: input!.path });

          if (result.success && result.children !== undefined) {
            const text = format === 'json'
              ? JSON.stringify(result.children, null, 2)
              : result.children.map(c => formatGameTreeNode(c)).join('\n');
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(text || 'No children'),
            ]);
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
    })
  );

  // Get Script Source Tool
  context.subscriptions.push(
    vscode.lm.registerTool('rbxdev_get_script_source', {
      async invoke(options, _token) {
        if (getConnectionStatus() === false) {
          return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart('Error: No executor connected'),
          ]);
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
          }>('custom/getScriptSource', { path: input!.path });

          if (result.success && result.source !== undefined) {
            const header = result.scriptType !== undefined
              ? `-- ${result.scriptType}: ${input!.path!.join('.')}\n\n`
              : '';
            return new vscode.LanguageModelToolResult([
              new vscode.LanguageModelTextPart(header + result.source),
            ]);
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
    })
  );

  console.log('[rbxdev-ls] MCP tools registered with VS Code Language Model API');
};
