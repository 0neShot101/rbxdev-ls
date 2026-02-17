import { createExecutorBridge } from '@executor/server';
import type { ExecutorBridge, LogEntry } from '@typings/bridge';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';

import type { GameTreeNode } from '@typings/protocol';

const DEFAULT_BRIDGE_PORT = 21324;
const MAX_LOG_BUFFER = 1000;

type ToolResult = { content: Array<{ type: string; text: string }>; isError?: boolean };

export const textResult = (text: string): ToolResult => ({ 'content': [{ 'type': 'text', text }] });
export const errorResult = (text: string): ToolResult => ({ 'content': [{ 'type': 'text', text }], 'isError': true });

const NOT_CONNECTED = errorResult('Error: No executor connected');

export const requirePath = (path: unknown): ToolResult | undefined =>
  Array.isArray(path) === false || (path as unknown[]).length === 0
    ? errorResult('Error: path parameter is required')
    : undefined;

const bridgeCall = async <T extends { success: boolean; error?: string | undefined }>(
  fn: () => Promise<T>,
  onSuccess: (result: T) => string,
  failureMsg: string,
): Promise<ToolResult> => {
  try {
    const result = await fn();
    if (result.success) return textResult(onSuccess(result));
    return errorResult(`Error: ${result.error ?? failureMsg}`);
  } catch (err) {
    return errorResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
  }
};

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

export const formatGameTreeNode = (node: GameTreeNode, indent: number = 0): string => {
  const prefix = '  '.repeat(indent);
  let result = `${prefix}${node.name} (${node.className})`;

  if (node.hasChildren === true && (node.children === undefined || node.children.length === 0)) result += ' [+]';

  if (node.children !== undefined && node.children.length > 0) {
    result += '\n';
    result += node.children.map(child => formatGameTreeNode(child, indent + 1)).join('\n');
  }

  return result;
};

export const serializeGameTreeNode = (
  node: GameTreeNode,
): { name: string; className: string; hasChildren?: boolean; children?: unknown[] } => ({
  'name': node.name,
  'className': node.className,
  ...(node.hasChildren === true ? { 'hasChildren': true } : {}),
  ...(node.children !== undefined ? { 'children': node.children.map(serializeGameTreeNode) } : {}),
});

export const formatLogEntry = (entry: LogEntry): string => {
  const time = new Date(entry.timestamp).toISOString().slice(11, 23);
  return `${time} [${entry.level.toUpperCase()}] ${entry.message}${entry.stack !== undefined ? `\n${entry.stack}` : ''}`;
};

export const formatServicesTree = (services: ReadonlyMap<string, GameTreeNode>): string => {
  const lines: string[] = [];
  for (const [, node] of services) lines.push(formatGameTreeNode(node));
  return lines.join('\n');
};

export const tools: Tool[] = [
  {
    'name': 'get_bridge_status',
    'description':
      'Get the current status of the Roblox executor bridge connection. Returns whether the bridge is running, connected, and the executor name if connected.',
    'inputSchema': { 'type': 'object', 'properties': {}, 'required': [] },
  },
  {
    'name': 'execute_code',
    'description':
      'Execute Luau code in the connected Roblox game. The code runs in the executor environment with access to the full Roblox API. Returns the result or error from execution.',
    'inputSchema': {
      'type': 'object',
      'properties': { 'code': { 'type': 'string', 'description': 'The Luau code to execute in the game' } },
      'required': ['code'],
    },
  },
  {
    'name': 'get_game_tree',
    'description':
      'Get the current game hierarchy tree from the connected Roblox game. Returns the structure of services and their children.',
    'inputSchema': {
      'type': 'object',
      'properties': {
        'path': {
          'type': 'array',
          'items': { 'type': 'string' },
          'description': 'Optional path to a specific node. If omitted, returns all services.',
        },
        'format': {
          'type': 'string',
          'enum': ['tree', 'json'],
          'description': 'Output format: "tree" for human-readable, "json" for structured data. Defaults to "tree".',
        },
      },
      'required': [],
    },
  },
  {
    'name': 'get_properties',
    'description': 'Get property values from an instance in the game.',
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
          'description': 'Optional list of specific property names to fetch.',
        },
      },
      'required': ['path'],
    },
  },
  {
    'name': 'set_property',
    'description': 'Set a property value on an instance in the game. Supports various Roblox types.',
    'inputSchema': {
      'type': 'object',
      'properties': {
        'path': { 'type': 'array', 'items': { 'type': 'string' }, 'description': 'Path to the instance' },
        'property': { 'type': 'string', 'description': 'Name of the property to set' },
        'value': { 'type': 'string', 'description': 'The value to set as a string representation' },
        'valueType': { 'type': 'string', 'description': 'The type of the value (e.g., "string", "number", "Vector3")' },
      },
      'required': ['path', 'property', 'value', 'valueType'],
    },
  },
  {
    'name': 'teleport_player',
    'description': "Teleport the local player to an instance's position in the game.",
    'inputSchema': {
      'type': 'object',
      'properties': {
        'path': { 'type': 'array', 'items': { 'type': 'string' }, 'description': 'Path to the target instance' },
      },
      'required': ['path'],
    },
  },
  {
    'name': 'delete_instance',
    'description': 'Delete an instance from the game. This is permanent and cannot be undone.',
    'inputSchema': {
      'type': 'object',
      'properties': {
        'path': { 'type': 'array', 'items': { 'type': 'string' }, 'description': 'Path to the instance to delete' },
      },
      'required': ['path'],
    },
  },
  {
    'name': 'reparent_instance',
    'description': 'Move an instance to a new parent in the game hierarchy.',
    'inputSchema': {
      'type': 'object',
      'properties': {
        'sourcePath': { 'type': 'array', 'items': { 'type': 'string' }, 'description': 'Path to the instance to move' },
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
    'description': 'Get the children of an instance. Used for lazy-loading parts of the game tree.',
    'inputSchema': {
      'type': 'object',
      'properties': {
        'path': { 'type': 'array', 'items': { 'type': 'string' }, 'description': 'Path to the parent instance' },
        'format': { 'type': 'string', 'enum': ['tree', 'json'], 'description': 'Output format. Defaults to "tree".' },
      },
      'required': ['path'],
    },
  },
  {
    'name': 'get_console_output',
    'description': 'Get recent console output (print, warn, error) from the game.',
    'inputSchema': {
      'type': 'object',
      'properties': {
        'limit': { 'type': 'number', 'description': 'Maximum number of log entries to return. Defaults to 50.' },
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
    'description': 'Request a fresh game tree snapshot from the executor.',
    'inputSchema': { 'type': 'object', 'properties': {}, 'required': [] },
  },
  {
    'name': 'get_script_source',
    'description': 'Get the decompiled source code of a Script, LocalScript, or ModuleScript in the game.',
    'inputSchema': {
      'type': 'object',
      'properties': {
        'path': { 'type': 'array', 'items': { 'type': 'string' }, 'description': 'Path to the script instance' },
      },
      'required': ['path'],
    },
  },
  {
    'name': 'create_instance',
    'description': 'Create a new instance in the Roblox game.',
    'inputSchema': {
      'type': 'object',
      'properties': {
        'className': { 'type': 'string', 'description': 'The class name of the instance to create' },
        'parentPath': { 'type': 'array', 'items': { 'type': 'string' }, 'description': 'Path to the parent instance' },
        'name': { 'type': 'string', 'description': 'Optional name for the new instance' },
      },
      'required': ['className', 'parentPath'],
    },
  },
  {
    'name': 'clone_instance',
    'description': 'Clone an existing instance in the Roblox game.',
    'inputSchema': {
      'type': 'object',
      'properties': {
        'path': { 'type': 'array', 'items': { 'type': 'string' }, 'description': 'Path to the instance to clone' },
      },
      'required': ['path'],
    },
  },
  {
    'name': 'get_remote_calls',
    'description': 'Get recently captured remote calls from the Remote Spy.',
    'inputSchema': {
      'type': 'object',
      'properties': {
        'limit': { 'type': 'number', 'description': 'Maximum number of calls to return. Defaults to 50.' },
      },
      'required': [],
    },
  },
  {
    'name': 'set_remote_spy_enabled',
    'description': 'Enable or disable the Remote Spy feature.',
    'inputSchema': {
      'type': 'object',
      'properties': { 'enabled': { 'type': 'boolean', 'description': 'Whether to enable or disable Remote Spy' } },
      'required': ['enabled'],
    },
  },
];

/** Creates and configures the MCP server with all tools and resources. */
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
    { 'name': 'rbxdev-ls', 'version': '0.2.1' },
    { 'capabilities': { 'tools': {}, 'resources': {} } },
  );

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
      if (bridge.isConnected === false)
        return { 'contents': [{ 'uri': uri, 'mimeType': 'text/plain', 'text': 'Not connected to executor' }] };
      return {
        'contents': [
          {
            'uri': uri,
            'mimeType': 'text/plain',
            'text': formatServicesTree(bridge.liveGameModel.services) || 'No game tree data available',
          },
        ],
      };
    }

    if (uri === 'rbxdev://console/logs') {
      const formatted = logBuffer.slice(-100).map(formatLogEntry).join('\n');
      return { 'contents': [{ 'uri': uri, 'mimeType': 'text/plain', 'text': formatted || 'No console output' }] };
    }

    throw new Error(`Unknown resource: ${uri}`);
  });

  server.setRequestHandler(CallToolRequestSchema, async request => {
    const { name, 'arguments': args } = request.params;

    switch (name) {
      case 'get_bridge_status':
        return textResult(
          JSON.stringify(
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
        );

      case 'execute_code': {
        if (bridge.isConnected === false) return NOT_CONNECTED;
        const code = (args as { code: string }).code;
        if (typeof code !== 'string' || code.trim() === '') return errorResult('Error: code parameter is required');

        try {
          const result = await bridge.execute(code);
          if (result.success) return textResult(result.result ?? '(no output)');
          return errorResult(
            `Execution error: ${result.error?.message ?? 'Unknown error'}${result.error?.stack !== undefined ? `\n\nStack trace:\n${result.error.stack}` : ''}`,
          );
        } catch (err) {
          return errorResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      case 'get_game_tree': {
        if (bridge.isConnected === false) return NOT_CONNECTED;
        const typedArgs = args as { path?: string[]; format?: 'tree' | 'json' } | undefined;
        const path = typedArgs?.path;
        const format = typedArgs?.format ?? 'tree';

        if (path !== undefined && path.length > 0) {
          const node = bridge.liveGameModel.getNode(path);
          if (node === undefined) return errorResult(`Error: Node not found at path: ${path.join('.')}`);
          return textResult(
            format === 'json' ? JSON.stringify(serializeGameTreeNode(node), null, 2) : formatGameTreeNode(node),
          );
        }

        const services = bridge.liveGameModel.services;
        if (format === 'json') {
          const serviceArray: unknown[] = [];
          for (const [, node] of services) serviceArray.push(serializeGameTreeNode(node));
          return textResult(JSON.stringify(serviceArray, null, 2));
        }
        return textResult(formatServicesTree(services) || 'No game tree data available');
      }

      case 'get_properties': {
        if (bridge.isConnected === false) return NOT_CONNECTED;
        const typedArgs = args as { path: string[]; properties?: string[] };
        const pathError = requirePath(typedArgs.path);
        if (pathError !== undefined) return pathError;

        try {
          const result = await bridge.requestProperties(typedArgs.path, typedArgs.properties);
          if (result.success && result.properties !== undefined) {
            const formatted = result.properties
              .map(p => `${p.name}: ${p.value} (${p.valueType}${p.className !== undefined ? `, ${p.className}` : ''})`)
              .join('\n');
            return textResult(formatted || 'No properties returned');
          }
          return errorResult(`Error: ${result.error ?? 'Failed to get properties'}`);
        } catch (err) {
          return errorResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      case 'set_property': {
        if (bridge.isConnected === false) return NOT_CONNECTED;
        const typedArgs = args as { path: string[]; property: string; value: string; valueType: string };
        const pathError = requirePath(typedArgs.path);
        if (pathError !== undefined) return pathError;

        return bridgeCall(
          () => bridge.setProperty(typedArgs.path, typedArgs.property, typedArgs.value, typedArgs.valueType),
          () => `Successfully set ${typedArgs.property} to ${typedArgs.value}`,
          'Failed to set property',
        );
      }

      case 'teleport_player': {
        if (bridge.isConnected === false) return NOT_CONNECTED;
        const typedArgs = args as { path: string[] };
        const pathError = requirePath(typedArgs.path);
        if (pathError !== undefined) return pathError;

        return bridgeCall(
          () => bridge.teleportTo(typedArgs.path),
          () => `Successfully teleported to ${typedArgs.path.join('.')}`,
          'Failed to teleport',
        );
      }

      case 'delete_instance': {
        if (bridge.isConnected === false) return NOT_CONNECTED;
        const typedArgs = args as { path: string[] };
        const pathError = requirePath(typedArgs.path);
        if (pathError !== undefined) return pathError;

        return bridgeCall(
          () => bridge.deleteInstance(typedArgs.path),
          () => `Successfully deleted ${typedArgs.path.join('.')}`,
          'Failed to delete instance',
        );
      }

      case 'reparent_instance': {
        if (bridge.isConnected === false) return NOT_CONNECTED;
        const typedArgs = args as { sourcePath: string[]; targetPath: string[] };
        const sourceError = requirePath(typedArgs.sourcePath);
        if (sourceError !== undefined) return sourceError;
        const targetError = requirePath(typedArgs.targetPath);
        if (targetError !== undefined) return targetError;

        return bridgeCall(
          () => bridge.reparentInstance(typedArgs.sourcePath, typedArgs.targetPath),
          () => `Successfully moved ${typedArgs.sourcePath.join('.')} to ${typedArgs.targetPath.join('.')}`,
          'Failed to reparent instance',
        );
      }

      case 'get_children': {
        if (bridge.isConnected === false) return NOT_CONNECTED;
        const typedArgs = args as { path: string[]; format?: 'tree' | 'json' };
        const format = typedArgs.format ?? 'tree';
        const pathError = requirePath(typedArgs.path);
        if (pathError !== undefined) return pathError;

        try {
          const result = await bridge.requestChildren(typedArgs.path);
          if (result.success && result.children !== undefined) {
            if (format === 'json')
              return textResult(JSON.stringify(result.children.map(serializeGameTreeNode), null, 2));
            return textResult(result.children.map(child => formatGameTreeNode(child)).join('\n') || 'No children');
          }
          return errorResult(`Error: ${result.error ?? 'Failed to get children'}`);
        } catch (err) {
          return errorResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      case 'get_console_output': {
        const typedArgs = args as { limit?: number; level?: 'info' | 'warn' | 'error' | 'all' } | undefined;
        const limit = typedArgs?.limit ?? 50;
        const level = typedArgs?.level ?? 'all';
        const filtered = level !== 'all' ? logBuffer.filter(entry => entry.level === level) : logBuffer;
        return textResult(filtered.slice(-limit).map(formatLogEntry).join('\n') || 'No console output');
      }

      case 'refresh_game_tree': {
        if (bridge.isConnected === false) return NOT_CONNECTED;
        bridge.requestGameTree();
        return textResult('Game tree refresh requested');
      }

      case 'get_script_source': {
        if (bridge.isConnected === false) return NOT_CONNECTED;
        const typedArgs = args as { path: string[] };
        const pathError = requirePath(typedArgs.path);
        if (pathError !== undefined) return pathError;

        try {
          const result = await bridge.requestScriptSource(typedArgs.path);
          if (result.success && result.source !== undefined) {
            const header =
              result.scriptType !== undefined ? `-- ${result.scriptType}: ${typedArgs.path.join('.')}\n\n` : '';
            return textResult(header + result.source);
          }
          return errorResult(`Error: ${result.error ?? 'Failed to get script source'}`);
        } catch (err) {
          return errorResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      case 'create_instance': {
        if (bridge.isConnected === false) return NOT_CONNECTED;
        const typedArgs = args as { className: string; parentPath: string[]; name?: string };
        if (typeof typedArgs.className !== 'string' || typedArgs.className.trim() === '')
          return errorResult('Error: className parameter is required');
        const pathError = requirePath(typedArgs.parentPath);
        if (pathError !== undefined) return pathError;

        return bridgeCall(
          () => bridge.createInstance(typedArgs.className, typedArgs.parentPath, typedArgs.name),
          result =>
            `Successfully created ${result.instanceName} (${typedArgs.className}) in ${typedArgs.parentPath.join('.')}`,
          'Failed to create instance',
        );
      }

      case 'clone_instance': {
        if (bridge.isConnected === false) return NOT_CONNECTED;
        const typedArgs = args as { path: string[] };
        const pathError = requirePath(typedArgs.path);
        if (pathError !== undefined) return pathError;

        return bridgeCall(
          () => bridge.cloneInstance(typedArgs.path),
          result => `Successfully cloned ${typedArgs.path.join('.')} as ${result.cloneName}`,
          'Failed to clone instance',
        );
      }

      case 'get_remote_calls': {
        const typedArgs = args as { limit?: number } | undefined;
        const calls = bridge.remoteSpyCalls.slice(-(typedArgs?.limit ?? 50));
        if (calls.length === 0)
          return textResult(
            `No remote calls captured. Remote Spy is ${bridge.isRemoteSpyEnabled ? 'enabled' : 'disabled - enable it first with set_remote_spy_enabled'}.`,
          );

        const formatted = calls
          .map(call => {
            const time = new Date(call.timestamp * 1000).toISOString().slice(11, 23);
            return `[${time}] ${call.method} - ${call.remoteName} (${call.remoteType})\n  Code:\n${call.code}`;
          })
          .join('\n\n');
        return textResult(`Recent remote calls (${calls.length}):\n\n${formatted}`);
      }

      case 'set_remote_spy_enabled': {
        if (bridge.isConnected === false) return NOT_CONNECTED;
        const typedArgs = args as { enabled: boolean };
        if (typeof typedArgs.enabled !== 'boolean')
          return errorResult('Error: enabled parameter is required (boolean)');

        return bridgeCall(
          () => bridge.setRemoteSpyEnabled(typedArgs.enabled),
          result => `Remote Spy ${result.enabled === true ? 'enabled' : 'disabled'}`,
          'Failed to set Remote Spy state',
        );
      }

      default:
        return errorResult(`Unknown tool: ${name}`);
    }
  });

  return { server, bridge };
};

/** Starts the MCP server with stdio transport. */
export const startMcpServer = async (): Promise<void> => {
  const port = getConfiguredPort();
  const { server, bridge } = createMcpServer();

  bridge.start(port);
  console.error(`[mcp] Executor bridge started on port ${port}`);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[mcp] MCP server connected via stdio');
};
