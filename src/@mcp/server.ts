/**
 * MCP Server for rbxdev-ls
 * Exposes Roblox executor bridge capabilities via Model Context Protocol
 */

import { createExecutorBridge, type ExecutorBridge, type LogEntry } from '@executor/server';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';

import type { GameTreeNode } from '@executor/protocol';

const DEFAULT_BRIDGE_PORT = 21324;
const MAX_LOG_BUFFER = 1000;

/**
 * Parses the port from environment variable or command line arguments
 */
const getConfiguredPort = (): number => {
  const envPort = process.env['RBXDEV_BRIDGE_PORT'];
  if (envPort !== undefined) {
    const parsed = parseInt(envPort, 10);
    if (Number.isNaN(parsed) === false && parsed > 0 && parsed < 65536) return parsed;
  }

  const portArgIndex = process.argv.indexOf('--port');
  if (portArgIndex !== -1 && process.argv[portArgIndex + 1] !== undefined) {
    const parsed = parseInt(process.argv[portArgIndex + 1] as string, 10);
    if (Number.isNaN(parsed) === false && parsed > 0 && parsed < 65536) return parsed;
  }

  return DEFAULT_BRIDGE_PORT;
};

/**
 * Converts a game tree node to a formatted string representation
 */
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
 * Serializes a game tree node to JSON-compatible object
 */
const serializeGameTreeNode = (
  node: GameTreeNode,
): { name: string; className: string; hasChildren?: boolean; children?: unknown[] } => ({
  'name': node.name,
  'className': node.className,
  ...(node.hasChildren === true ? { 'hasChildren': true } : {}),
  ...(node.children !== undefined ? { 'children': node.children.map(serializeGameTreeNode) } : {}),
});

/**
 * Creates and configures the MCP server with all tools and resources
 */
export const createMcpServer = (): { server: Server; bridge: ExecutorBridge } => {
  const logBuffer: LogEntry[] = [];

  const log = (message: string): void => {
    console.error(`[mcp] ${message}`);
  };

  const bridge = createExecutorBridge(log);

  bridge.onLog(entry => {
    logBuffer.push(entry);
    if (logBuffer.length > MAX_LOG_BUFFER) logBuffer.shift();
  });

  const server = new Server(
    {
      'name': 'rbxdev-ls',
      'version': '0.1.4',
    },
    {
      'capabilities': {
        'tools': {},
        'resources': {},
      },
    },
  );

  const tools: Tool[] = [
    {
      'name': 'get_bridge_status',
      'description':
        'Get the current status of the Roblox executor bridge connection. Returns whether the bridge is running, connected, and the executor name if connected.',
      'inputSchema': {
        'type': 'object',
        'properties': {},
        'required': [],
      },
    },
    {
      'name': 'execute_code',
      'description':
        'Execute Luau code in the connected Roblox game. The code runs in the executor environment with access to the full Roblox API. Returns the result or error from execution.',
      'inputSchema': {
        'type': 'object',
        'properties': {
          'code': {
            'type': 'string',
            'description': 'The Luau code to execute in the game',
          },
        },
        'required': ['code'],
      },
    },
    {
      'name': 'get_game_tree',
      'description':
        'Get the current game hierarchy tree from the connected Roblox game. Returns the structure of services and their children. Use the path parameter to get a subtree starting from a specific instance.',
      'inputSchema': {
        'type': 'object',
        'properties': {
          'path': {
            'type': 'array',
            'items': { 'type': 'string' },
            'description':
              'Optional path to a specific node (e.g., ["Workspace", "Folder"]). If omitted, returns all services.',
          },
          'format': {
            'type': 'string',
            'enum': ['tree', 'json'],
            'description':
              'Output format: "tree" for human-readable tree view, "json" for structured data. Defaults to "tree".',
          },
        },
        'required': [],
      },
    },
    {
      'name': 'get_properties',
      'description':
        'Get property values from an instance in the game. Specify the path to the instance and optionally which properties to retrieve.',
      'inputSchema': {
        'type': 'object',
        'properties': {
          'path': {
            'type': 'array',
            'items': { 'type': 'string' },
            'description': 'Path to the instance (e.g., ["Workspace", "Part"])',
          },
          'properties': {
            'type': 'array',
            'items': { 'type': 'string' },
            'description': 'Optional list of specific property names to fetch. If omitted, fetches common properties.',
          },
        },
        'required': ['path'],
      },
    },
    {
      'name': 'set_property',
      'description':
        'Set a property value on an instance in the game. Supports various Roblox types including primitives, Vector3, Color3, etc.',
      'inputSchema': {
        'type': 'object',
        'properties': {
          'path': {
            'type': 'array',
            'items': { 'type': 'string' },
            'description': 'Path to the instance (e.g., ["Workspace", "Part"])',
          },
          'property': {
            'type': 'string',
            'description': 'Name of the property to set',
          },
          'value': {
            'type': 'string',
            'description': 'The value to set (as a string representation, e.g., "true", "100", "1, 2, 3" for Vector3)',
          },
          'valueType': {
            'type': 'string',
            'description': 'The type of the value (e.g., "string", "number", "boolean", "Vector3", "Color3", "CFrame")',
          },
        },
        'required': ['path', 'property', 'value', 'valueType'],
      },
    },
    {
      'name': 'teleport_player',
      'description':
        "Teleport the local player to an instance's position in the game. The instance must have a Position or CFrame property.",
      'inputSchema': {
        'type': 'object',
        'properties': {
          'path': {
            'type': 'array',
            'items': { 'type': 'string' },
            'description': 'Path to the target instance (e.g., ["Workspace", "SpawnLocation"])',
          },
        },
        'required': ['path'],
      },
    },
    {
      'name': 'delete_instance',
      'description': 'Delete an instance from the game. This is permanent and cannot be undone. Use with caution.',
      'inputSchema': {
        'type': 'object',
        'properties': {
          'path': {
            'type': 'array',
            'items': { 'type': 'string' },
            'description': 'Path to the instance to delete (e.g., ["Workspace", "Part"])',
          },
        },
        'required': ['path'],
      },
    },
    {
      'name': 'reparent_instance',
      'description':
        'Move an instance to a new parent in the game hierarchy. Changes the Parent property of the instance.',
      'inputSchema': {
        'type': 'object',
        'properties': {
          'sourcePath': {
            'type': 'array',
            'items': { 'type': 'string' },
            'description': 'Path to the instance to move',
          },
          'targetPath': {
            'type': 'array',
            'items': { 'type': 'string' },
            'description': 'Path to the new parent instance',
          },
        },
        'required': ['sourcePath', 'targetPath'],
      },
    },
    {
      'name': 'get_children',
      'description':
        'Get the children of an instance. Used for lazy-loading parts of the game tree that were not initially fetched.',
      'inputSchema': {
        'type': 'object',
        'properties': {
          'path': {
            'type': 'array',
            'items': { 'type': 'string' },
            'description': 'Path to the parent instance',
          },
          'format': {
            'type': 'string',
            'enum': ['tree', 'json'],
            'description': 'Output format: "tree" for human-readable, "json" for structured data. Defaults to "tree".',
          },
        },
        'required': ['path'],
      },
    },
    {
      'name': 'get_console_output',
      'description':
        'Get recent console output (print, warn, error) from the game. Returns the most recent log entries.',
      'inputSchema': {
        'type': 'object',
        'properties': {
          'limit': {
            'type': 'number',
            'description': 'Maximum number of log entries to return. Defaults to 50.',
          },
          'level': {
            'type': 'string',
            'enum': ['info', 'warn', 'error', 'all'],
            'description': 'Filter by log level. Defaults to "all".',
          },
        },
        'required': [],
      },
    },
    {
      'name': 'refresh_game_tree',
      'description':
        'Request a fresh game tree snapshot from the executor. Use this if the game state has changed and you need updated information.',
      'inputSchema': {
        'type': 'object',
        'properties': {},
        'required': [],
      },
    },
    {
      'name': 'get_script_source',
      'description':
        'Get the decompiled source code of a Script, LocalScript, or ModuleScript in the Roblox game. Requires the executor to have decompiler support.',
      'inputSchema': {
        'type': 'object',
        'properties': {
          'path': {
            'type': 'array',
            'items': { 'type': 'string' },
            'description': 'Path to the script instance (e.g., ["ReplicatedStorage", "MyModule"])',
          },
        },
        'required': ['path'],
      },
    },
    {
      'name': 'create_instance',
      'description':
        'Create a new instance in the Roblox game. Supports common classes like Part, Folder, Script, Model, GUI elements, values, and more.',
      'inputSchema': {
        'type': 'object',
        'properties': {
          'className': {
            'type': 'string',
            'description': 'The class name of the instance to create (e.g., "Part", "Folder", "Script")',
          },
          'parentPath': {
            'type': 'array',
            'items': { 'type': 'string' },
            'description': 'Path to the parent instance where the new instance will be created',
          },
          'name': {
            'type': 'string',
            'description': 'Optional name for the new instance. Defaults to the class name.',
          },
        },
        'required': ['className', 'parentPath'],
      },
    },
    {
      'name': 'clone_instance',
      'description':
        'Clone an existing instance in the Roblox game. The clone will be created as a sibling of the original with the same parent.',
      'inputSchema': {
        'type': 'object',
        'properties': {
          'path': {
            'type': 'array',
            'items': { 'type': 'string' },
            'description': 'Path to the instance to clone',
          },
        },
        'required': ['path'],
      },
    },
    {
      'name': 'get_remote_calls',
      'description':
        'Get recently captured remote calls from the Remote Spy. Requires Remote Spy to be enabled first. Returns FireServer and InvokeServer calls made on RemoteEvents and RemoteFunctions.',
      'inputSchema': {
        'type': 'object',
        'properties': {
          'limit': {
            'type': 'number',
            'description': 'Maximum number of calls to return. Defaults to 50.',
          },
        },
        'required': [],
      },
    },
    {
      'name': 'set_remote_spy_enabled',
      'description':
        'Enable or disable the Remote Spy feature. When enabled, it monitors all FireServer and InvokeServer calls made on RemoteEvents and RemoteFunctions.',
      'inputSchema': {
        'type': 'object',
        'properties': {
          'enabled': {
            'type': 'boolean',
            'description': 'Whether to enable or disable Remote Spy',
          },
        },
        'required': ['enabled'],
      },
    },
  ];

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    'resources': [
      {
        'uri': 'rbxdev://bridge/status',
        'name': 'Bridge Status',
        'description': 'Current status of the Roblox executor bridge connection',
        'mimeType': 'application/json',
      },
      {
        'uri': 'rbxdev://game/tree',
        'name': 'Game Tree',
        'description': 'Current game hierarchy structure',
        'mimeType': 'text/plain',
      },
      {
        'uri': 'rbxdev://console/logs',
        'name': 'Console Logs',
        'description': 'Recent console output from the game',
        'mimeType': 'text/plain',
      },
    ],
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async request => {
    const { uri } = request.params;

    if (uri === 'rbxdev://bridge/status') {
      return {
        'contents': [
          {
            'uri': uri,
            'mimeType': 'application/json',
            'text': JSON.stringify(
              {
                'isRunning': bridge.isRunning,
                'isConnected': bridge.isConnected,
                'executorName': bridge.executorName ?? null,
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    if (uri === 'rbxdev://game/tree') {
      if (bridge.isConnected === false) {
        return {
          'contents': [
            {
              'uri': uri,
              'mimeType': 'text/plain',
              'text': 'Not connected to executor',
            },
          ],
        };
      }

      const services = bridge.liveGameModel.services;
      const lines: string[] = [];
      for (const [, node] of services) {
        lines.push(formatGameTreeNode(node));
      }

      return {
        'contents': [
          {
            'uri': uri,
            'mimeType': 'text/plain',
            'text': lines.join('\n') || 'No game tree data available',
          },
        ],
      };
    }

    if (uri === 'rbxdev://console/logs') {
      const formatted = logBuffer
        .slice(-100)
        .map(entry => {
          const date = new Date(entry.timestamp);
          const time = date.toISOString().slice(11, 23);
          const levelTag = `[${entry.level.toUpperCase()}]`;
          return `${time} ${levelTag} ${entry.message}${entry.stack !== undefined ? `\n${entry.stack}` : ''}`;
        })
        .join('\n');

      return {
        'contents': [
          {
            'uri': uri,
            'mimeType': 'text/plain',
            'text': formatted || 'No console output',
          },
        ],
      };
    }

    throw new Error(`Unknown resource: ${uri}`);
  });

  server.setRequestHandler(CallToolRequestSchema, async request => {
    const { name, 'arguments': args } = request.params;

    switch (name) {
      case 'get_bridge_status': {
        return {
          'content': [
            {
              'type': 'text',
              'text': JSON.stringify(
                {
                  'isRunning': bridge.isRunning,
                  'isConnected': bridge.isConnected,
                  'executorName': bridge.executorName ?? null,
                  'lastUpdate': bridge.liveGameModel.lastUpdate,
                  'servicesCount': bridge.liveGameModel.services.size,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      case 'execute_code': {
        if (bridge.isConnected === false) {
          return {
            'content': [{ 'type': 'text', 'text': 'Error: No executor connected' }],
            'isError': true,
          };
        }

        const code = (args as { code: string }).code;
        if (typeof code !== 'string' || code.trim() === '') {
          return {
            'content': [{ 'type': 'text', 'text': 'Error: code parameter is required' }],
            'isError': true,
          };
        }

        try {
          const result = await bridge.execute(code);
          if (result.success) {
            return {
              'content': [
                {
                  'type': 'text',
                  'text': result.result ?? '(no output)',
                },
              ],
            };
          }
          return {
            'content': [
              {
                'type': 'text',
                'text': `Execution error: ${result.error?.message ?? 'Unknown error'}${result.error?.stack !== undefined ? `\n\nStack trace:\n${result.error.stack}` : ''}`,
              },
            ],
            'isError': true,
          };
        } catch (err) {
          return {
            'content': [{ 'type': 'text', 'text': `Error: ${err instanceof Error ? err.message : String(err)}` }],
            'isError': true,
          };
        }
      }

      case 'get_game_tree': {
        if (bridge.isConnected === false) {
          return {
            'content': [{ 'type': 'text', 'text': 'Error: No executor connected' }],
            'isError': true,
          };
        }

        const typedArgs = args as { path?: string[]; format?: 'tree' | 'json' } | undefined;
        const path = typedArgs?.path;
        const format = typedArgs?.format ?? 'tree';

        if (path !== undefined && path.length > 0) {
          const node = bridge.liveGameModel.getNode(path);
          if (node === undefined) {
            return {
              'content': [{ 'type': 'text', 'text': `Error: Node not found at path: ${path.join('.')}` }],
              'isError': true,
            };
          }

          if (format === 'json') {
            return {
              'content': [{ 'type': 'text', 'text': JSON.stringify(serializeGameTreeNode(node), null, 2) }],
            };
          }
          return {
            'content': [{ 'type': 'text', 'text': formatGameTreeNode(node) }],
          };
        }

        const services = bridge.liveGameModel.services;
        if (format === 'json') {
          const serviceArray: unknown[] = [];
          for (const [, node] of services) {
            serviceArray.push(serializeGameTreeNode(node));
          }
          return {
            'content': [{ 'type': 'text', 'text': JSON.stringify(serviceArray, null, 2) }],
          };
        }

        const lines: string[] = [];
        for (const [, node] of services) {
          lines.push(formatGameTreeNode(node));
        }
        return {
          'content': [{ 'type': 'text', 'text': lines.join('\n') || 'No game tree data available' }],
        };
      }

      case 'get_properties': {
        if (bridge.isConnected === false) {
          return {
            'content': [{ 'type': 'text', 'text': 'Error: No executor connected' }],
            'isError': true,
          };
        }

        const typedArgs = args as { path: string[]; properties?: string[] };
        const path = typedArgs.path;

        if (Array.isArray(path) === false || path.length === 0) {
          return {
            'content': [{ 'type': 'text', 'text': 'Error: path parameter is required' }],
            'isError': true,
          };
        }

        try {
          const result = await bridge.requestProperties(path, typedArgs.properties);
          if (result.success && result.properties !== undefined) {
            const formatted = result.properties
              .map(p => `${p.name}: ${p.value} (${p.valueType}${p.className !== undefined ? `, ${p.className}` : ''})`)
              .join('\n');
            return {
              'content': [{ 'type': 'text', 'text': formatted || 'No properties returned' }],
            };
          }
          return {
            'content': [{ 'type': 'text', 'text': `Error: ${result.error ?? 'Failed to get properties'}` }],
            'isError': true,
          };
        } catch (err) {
          return {
            'content': [{ 'type': 'text', 'text': `Error: ${err instanceof Error ? err.message : String(err)}` }],
            'isError': true,
          };
        }
      }

      case 'set_property': {
        if (bridge.isConnected === false) {
          return {
            'content': [{ 'type': 'text', 'text': 'Error: No executor connected' }],
            'isError': true,
          };
        }

        const typedArgs = args as {
          path: string[];
          property: string;
          value: string;
          valueType: string;
        };

        if (Array.isArray(typedArgs.path) === false || typedArgs.path.length === 0) {
          return {
            'content': [{ 'type': 'text', 'text': 'Error: path parameter is required' }],
            'isError': true,
          };
        }

        try {
          const result = await bridge.setProperty(
            typedArgs.path,
            typedArgs.property,
            typedArgs.value,
            typedArgs.valueType,
          );
          if (result.success) {
            return {
              'content': [{ 'type': 'text', 'text': `Successfully set ${typedArgs.property} to ${typedArgs.value}` }],
            };
          }
          return {
            'content': [{ 'type': 'text', 'text': `Error: ${result.error ?? 'Failed to set property'}` }],
            'isError': true,
          };
        } catch (err) {
          return {
            'content': [{ 'type': 'text', 'text': `Error: ${err instanceof Error ? err.message : String(err)}` }],
            'isError': true,
          };
        }
      }

      case 'teleport_player': {
        if (bridge.isConnected === false) {
          return {
            'content': [{ 'type': 'text', 'text': 'Error: No executor connected' }],
            'isError': true,
          };
        }

        const typedArgs = args as { path: string[] };

        if (Array.isArray(typedArgs.path) === false || typedArgs.path.length === 0) {
          return {
            'content': [{ 'type': 'text', 'text': 'Error: path parameter is required' }],
            'isError': true,
          };
        }

        try {
          const result = await bridge.teleportTo(typedArgs.path);
          if (result.success) {
            return {
              'content': [{ 'type': 'text', 'text': `Successfully teleported to ${typedArgs.path.join('.')}` }],
            };
          }
          return {
            'content': [{ 'type': 'text', 'text': `Error: ${result.error ?? 'Failed to teleport'}` }],
            'isError': true,
          };
        } catch (err) {
          return {
            'content': [{ 'type': 'text', 'text': `Error: ${err instanceof Error ? err.message : String(err)}` }],
            'isError': true,
          };
        }
      }

      case 'delete_instance': {
        if (bridge.isConnected === false) {
          return {
            'content': [{ 'type': 'text', 'text': 'Error: No executor connected' }],
            'isError': true,
          };
        }

        const typedArgs = args as { path: string[] };

        if (Array.isArray(typedArgs.path) === false || typedArgs.path.length === 0) {
          return {
            'content': [{ 'type': 'text', 'text': 'Error: path parameter is required' }],
            'isError': true,
          };
        }

        try {
          const result = await bridge.deleteInstance(typedArgs.path);
          if (result.success) {
            return {
              'content': [{ 'type': 'text', 'text': `Successfully deleted ${typedArgs.path.join('.')}` }],
            };
          }
          return {
            'content': [{ 'type': 'text', 'text': `Error: ${result.error ?? 'Failed to delete instance'}` }],
            'isError': true,
          };
        } catch (err) {
          return {
            'content': [{ 'type': 'text', 'text': `Error: ${err instanceof Error ? err.message : String(err)}` }],
            'isError': true,
          };
        }
      }

      case 'reparent_instance': {
        if (bridge.isConnected === false) {
          return {
            'content': [{ 'type': 'text', 'text': 'Error: No executor connected' }],
            'isError': true,
          };
        }

        const typedArgs = args as { sourcePath: string[]; targetPath: string[] };

        if (Array.isArray(typedArgs.sourcePath) === false || typedArgs.sourcePath.length === 0) {
          return {
            'content': [{ 'type': 'text', 'text': 'Error: sourcePath parameter is required' }],
            'isError': true,
          };
        }

        if (Array.isArray(typedArgs.targetPath) === false || typedArgs.targetPath.length === 0) {
          return {
            'content': [{ 'type': 'text', 'text': 'Error: targetPath parameter is required' }],
            'isError': true,
          };
        }

        try {
          const result = await bridge.reparentInstance(typedArgs.sourcePath, typedArgs.targetPath);
          if (result.success) {
            return {
              'content': [
                {
                  'type': 'text',
                  'text': `Successfully moved ${typedArgs.sourcePath.join('.')} to ${typedArgs.targetPath.join('.')}`,
                },
              ],
            };
          }
          return {
            'content': [{ 'type': 'text', 'text': `Error: ${result.error ?? 'Failed to reparent instance'}` }],
            'isError': true,
          };
        } catch (err) {
          return {
            'content': [{ 'type': 'text', 'text': `Error: ${err instanceof Error ? err.message : String(err)}` }],
            'isError': true,
          };
        }
      }

      case 'get_children': {
        if (bridge.isConnected === false) {
          return {
            'content': [{ 'type': 'text', 'text': 'Error: No executor connected' }],
            'isError': true,
          };
        }

        const typedArgs = args as { path: string[]; format?: 'tree' | 'json' };
        const format = typedArgs.format ?? 'tree';

        if (Array.isArray(typedArgs.path) === false || typedArgs.path.length === 0) {
          return {
            'content': [{ 'type': 'text', 'text': 'Error: path parameter is required' }],
            'isError': true,
          };
        }

        try {
          const result = await bridge.requestChildren(typedArgs.path);
          if (result.success && result.children !== undefined) {
            if (format === 'json') {
              return {
                'content': [
                  {
                    'type': 'text',
                    'text': JSON.stringify(result.children.map(serializeGameTreeNode), null, 2),
                  },
                ],
              };
            }

            const formatted = result.children.map(child => formatGameTreeNode(child)).join('\n');
            return {
              'content': [{ 'type': 'text', 'text': formatted || 'No children' }],
            };
          }
          return {
            'content': [{ 'type': 'text', 'text': `Error: ${result.error ?? 'Failed to get children'}` }],
            'isError': true,
          };
        } catch (err) {
          return {
            'content': [{ 'type': 'text', 'text': `Error: ${err instanceof Error ? err.message : String(err)}` }],
            'isError': true,
          };
        }
      }

      case 'get_console_output': {
        const typedArgs = args as { limit?: number; level?: 'info' | 'warn' | 'error' | 'all' } | undefined;
        const limit = typedArgs?.limit ?? 50;
        const level = typedArgs?.level ?? 'all';

        let filtered = logBuffer;
        if (level !== 'all') {
          filtered = logBuffer.filter(entry => entry.level === level);
        }

        const entries = filtered.slice(-limit);
        const formatted = entries
          .map(entry => {
            const date = new Date(entry.timestamp);
            const time = date.toISOString().slice(11, 23);
            const levelTag = `[${entry.level.toUpperCase()}]`;
            return `${time} ${levelTag} ${entry.message}${entry.stack !== undefined ? `\n${entry.stack}` : ''}`;
          })
          .join('\n');

        return {
          'content': [{ 'type': 'text', 'text': formatted || 'No console output' }],
        };
      }

      case 'refresh_game_tree': {
        if (bridge.isConnected === false) {
          return {
            'content': [{ 'type': 'text', 'text': 'Error: No executor connected' }],
            'isError': true,
          };
        }

        bridge.requestGameTree();
        return {
          'content': [{ 'type': 'text', 'text': 'Game tree refresh requested' }],
        };
      }

      case 'get_script_source': {
        if (bridge.isConnected === false) {
          return {
            'content': [{ 'type': 'text', 'text': 'Error: No executor connected' }],
            'isError': true,
          };
        }

        const typedArgs = args as { path: string[] };

        if (Array.isArray(typedArgs.path) === false || typedArgs.path.length === 0) {
          return {
            'content': [{ 'type': 'text', 'text': 'Error: path parameter is required' }],
            'isError': true,
          };
        }

        try {
          const result = await bridge.requestScriptSource(typedArgs.path);
          if (result.success && result.source !== undefined) {
            const header =
              result.scriptType !== undefined ? `-- ${result.scriptType}: ${typedArgs.path.join('.')}\n\n` : '';
            return {
              'content': [{ 'type': 'text', 'text': header + result.source }],
            };
          }
          return {
            'content': [{ 'type': 'text', 'text': `Error: ${result.error ?? 'Failed to get script source'}` }],
            'isError': true,
          };
        } catch (err) {
          return {
            'content': [{ 'type': 'text', 'text': `Error: ${err instanceof Error ? err.message : String(err)}` }],
            'isError': true,
          };
        }
      }

      case 'create_instance': {
        if (bridge.isConnected === false) {
          return {
            'content': [{ 'type': 'text', 'text': 'Error: No executor connected' }],
            'isError': true,
          };
        }

        const typedArgs = args as { className: string; parentPath: string[]; name?: string };

        if (typeof typedArgs.className !== 'string' || typedArgs.className.trim() === '') {
          return {
            'content': [{ 'type': 'text', 'text': 'Error: className parameter is required' }],
            'isError': true,
          };
        }

        if (Array.isArray(typedArgs.parentPath) === false || typedArgs.parentPath.length === 0) {
          return {
            'content': [{ 'type': 'text', 'text': 'Error: parentPath parameter is required' }],
            'isError': true,
          };
        }

        try {
          const result = await bridge.createInstance(typedArgs.className, typedArgs.parentPath, typedArgs.name);
          if (result.success) {
            return {
              'content': [
                {
                  'type': 'text',
                  'text': `Successfully created ${result.instanceName} (${typedArgs.className}) in ${typedArgs.parentPath.join('.')}`,
                },
              ],
            };
          }
          return {
            'content': [{ 'type': 'text', 'text': `Error: ${result.error ?? 'Failed to create instance'}` }],
            'isError': true,
          };
        } catch (err) {
          return {
            'content': [{ 'type': 'text', 'text': `Error: ${err instanceof Error ? err.message : String(err)}` }],
            'isError': true,
          };
        }
      }

      case 'clone_instance': {
        if (bridge.isConnected === false) {
          return {
            'content': [{ 'type': 'text', 'text': 'Error: No executor connected' }],
            'isError': true,
          };
        }

        const typedArgs = args as { path: string[] };

        if (Array.isArray(typedArgs.path) === false || typedArgs.path.length === 0) {
          return {
            'content': [{ 'type': 'text', 'text': 'Error: path parameter is required' }],
            'isError': true,
          };
        }

        try {
          const result = await bridge.cloneInstance(typedArgs.path);
          if (result.success) {
            return {
              'content': [
                {
                  'type': 'text',
                  'text': `Successfully cloned ${typedArgs.path.join('.')} as ${result.cloneName}`,
                },
              ],
            };
          }
          return {
            'content': [{ 'type': 'text', 'text': `Error: ${result.error ?? 'Failed to clone instance'}` }],
            'isError': true,
          };
        } catch (err) {
          return {
            'content': [{ 'type': 'text', 'text': `Error: ${err instanceof Error ? err.message : String(err)}` }],
            'isError': true,
          };
        }
      }

      case 'get_remote_calls': {
        const typedArgs = args as { limit?: number } | undefined;
        const limit = typedArgs?.limit ?? 50;

        const calls = bridge.remoteSpyCalls.slice(-limit);

        if (calls.length === 0) {
          return {
            'content': [
              {
                'type': 'text',
                'text': `No remote calls captured. Remote Spy is ${bridge.isRemoteSpyEnabled ? 'enabled' : 'disabled - enable it first with set_remote_spy_enabled'}.`,
              },
            ],
          };
        }

        const formatted = calls
          .map(call => {
            const time = new Date(call.timestamp * 1000).toISOString().slice(11, 23);
            const pathStr = `game.${call.remotePath.join('.')}`;
            return `[${time}] ${call.method} - ${call.remoteName} (${call.remoteType})\n  Path: ${pathStr}\n  Args: ${call.arguments || '(none)'}`;
          })
          .join('\n\n');

        return {
          'content': [
            {
              'type': 'text',
              'text': `Recent remote calls (${calls.length}):\n\n${formatted}`,
            },
          ],
        };
      }

      case 'set_remote_spy_enabled': {
        if (bridge.isConnected === false) {
          return {
            'content': [{ 'type': 'text', 'text': 'Error: No executor connected' }],
            'isError': true,
          };
        }

        const typedArgs = args as { enabled: boolean };

        if (typeof typedArgs.enabled !== 'boolean') {
          return {
            'content': [{ 'type': 'text', 'text': 'Error: enabled parameter is required (boolean)' }],
            'isError': true,
          };
        }

        try {
          const result = await bridge.setRemoteSpyEnabled(typedArgs.enabled);
          if (result.success) {
            return {
              'content': [
                {
                  'type': 'text',
                  'text': `Remote Spy ${result.enabled === true ? 'enabled' : 'disabled'}`,
                },
              ],
            };
          }
          return {
            'content': [{ 'type': 'text', 'text': `Error: ${result.error ?? 'Failed to set Remote Spy state'}` }],
            'isError': true,
          };
        } catch (err) {
          return {
            'content': [{ 'type': 'text', 'text': `Error: ${err instanceof Error ? err.message : String(err)}` }],
            'isError': true,
          };
        }
      }

      default:
        return {
          'content': [{ 'type': 'text', 'text': `Unknown tool: ${name}` }],
          'isError': true,
        };
    }
  });

  return { server, bridge };
};

/**
 * Starts the MCP server with stdio transport
 */
export const startMcpServer = async (): Promise<void> => {
  const port = getConfiguredPort();
  const { server, bridge } = createMcpServer();

  bridge.start(port);
  console.error(`[mcp] Executor bridge started on port ${port}`);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[mcp] MCP server connected via stdio');
};
