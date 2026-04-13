import { createServer } from 'net';

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import {
  createExecutorBridge,
  createProxyBridge,
  hasCapability,
  type ExecutorBridge,
  type GameTreeNode,
  type LogEntry,
  type ToolResult,
} from 'rbxdev-server';

const DEFAULT_BRIDGE_PORT = 21324;
const MAX_LOG_BUFFER = 1000;

const MCP_INSTRUCTIONS = `You are connected to a live Roblox game instance through the rbxdev MCP server. You can read game state, execute Luau code, and modify instances in real-time.

## Key Concepts

- **Paths**: Instances are referenced by path arrays like ["Workspace", "Part"] or ["Players", "Player1", "Character"]. Think of them like file paths through the game hierarchy.
- **Game Tree**: The game is a hierarchy of services (Workspace, Players, ReplicatedStorage, etc.) containing instances. Use get_game_tree to see the structure before interacting with specific instances.
- **Executor**: A Roblox script executor (e.g., Volt) that runs Luau code inside the game. All code execution happens through this.

## How to Approach Tasks

1. **Always check connection first**: Use get_bridge_status to verify the executor is connected before doing anything.
2. **Explore before acting**: Use get_game_tree, get_children, and get_properties to understand the game state before modifying it. Don't guess at paths, look them up.
3. **Read properties before changing them**: Before using set_property, use get_properties to see the current value and type. This helps you use the correct valueType.
4. **Use get_children for deep exploration**: The game tree only shows a few levels deep. Use get_children to drill into specific parts of the hierarchy.

## Writing Luau Code (execute_code)

- Write Luau (not Lua 5.1). Luau supports type annotations, string interpolation, continue, compound assignments (+=), and generalized iteration.
- The code runs in an executor environment with full Roblox API access: game, workspace, Players, etc.
- To return a value, use \`return\`. The last expression's result is captured. Example: \`return game.Players.LocalPlayer.Name\`
- For multi-step operations, write the full script in one execute_code call rather than multiple calls.
- Common globals: \`game\`, \`workspace\`, \`script\`, \`Instance.new()\`, \`Vector3.new()\`, \`CFrame.new()\`, \`Color3.fromRGB()\`, \`task.wait()\`, \`task.spawn()\`
- Check console output with get_console_output if your code uses print/warn/error.
- If execution fails, read the error message carefully. It usually tells you exactly what went wrong.

## set_property Value Types

When using set_property, the valueType must match:
- \`"string"\`: \`"hello"\`
- \`"number"\`: \`"42"\` or \`"3.14"\`
- \`"boolean"\`: \`"true"\` or \`"false"\`
- \`"Vector3"\`: \`"1, 2, 3"\`
- \`"Color3"\`: \`"255, 0, 0"\` (RGB 0-255)
- \`"CFrame"\`: \`"0, 5, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1"\` (position + rotation matrix)
- \`"UDim2"\`: \`"0, 100, 0, 50"\` (scaleX, offsetX, scaleY, offsetY)
- \`"EnumItem"\`: \`"Enum.Material.Neon"\`

## Remote Spy

The Remote Spy captures FireServer/InvokeServer calls between client and server:
1. Enable it first with set_remote_spy_enabled (enabled: true)
2. Then use get_remote_calls to see captured calls
3. Each call includes the remote name, method (FireServer/InvokeServer), and reproducible Luau code
4. This is useful for understanding client-server communication, reverse engineering game mechanics, and debugging

## Common Patterns

- **Find a player's character**: get_children on ["Players"] to find player names, then ["Workspace", "PlayerName"] for their character model
- **Inspect a part**: get_properties with path ["Workspace", "Part"] to see Size, Position, Color, Material, etc.
- **Run a script**: execute_code to run any Luau code with full API access
- **Build something**: create_instance to make new parts/models, then set_property to configure them
- **Debug**: get_console_output to check print/warn/error output, get_script_source to read script code

## Important Notes

- All operations happen on the CLIENT. Server-side scripts and data are not directly accessible.
- Instance paths are case-sensitive and must match exactly.
- The game tree is a snapshot. Use refresh_game_tree if you've made changes and need updated data.
- delete_instance is permanent and cannot be undone.
- When in doubt, read first with get_properties or get_game_tree before making changes.`;

/**
 * Wraps a text string in the MCP tool result format.
 * @param text - The text content to return.
 * @returns A successful ToolResult containing the text.
 */
export const textResult = (text: string): ToolResult => ({ 'content': [{ 'type': 'text', text }] });

/**
 * Wraps a text string in the MCP tool result format with the error flag set.
 * @param text - The error message to return.
 * @returns A ToolResult marked as an error containing the text.
 */
export const errorResult = (text: string): ToolResult => ({ 'content': [{ 'type': 'text', text }], 'isError': true });

const NOT_CONNECTED = errorResult('Error: No executor connected');

/**
 * Validates that a path argument is a non-empty array, returning an error result if not.
 * @param path - The path argument to validate.
 * @returns An error ToolResult if invalid, or undefined if the path is valid.
 */
export const requirePath = (path: unknown): ToolResult | undefined => {
  if (Array.isArray(path) === false) return errorResult('Error: path parameter is required');
  if (path.length === 0) return errorResult('Error: path parameter is required');
  return undefined;
};

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

const isPortAvailable = (port: number): Promise<boolean> =>
  new Promise(resolve => {
    const tester = createServer();
    tester.once('error', () => resolve(false));
    tester.once('listening', () => tester.close(() => resolve(true)));
    tester.listen(port, '127.0.0.1');
  });

/**
 * Formats a game tree node as an indented human-readable text tree.
 * @param node - The game tree node to format.
 * @param indent - The current indentation depth (defaults to 0).
 * @returns A multi-line string representing the node and its children.
 */
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

/**
 * Serializes a game tree node to a plain JSON-safe object for structured output.
 * @param node - The game tree node to serialize.
 * @returns A plain object with name, className, and optional children.
 */
export const serializeGameTreeNode = (
  node: GameTreeNode,
): { name: string; className: string; hasChildren?: boolean; children?: unknown[] } => ({
  'name': node.name,
  'className': node.className,
  ...(node.hasChildren === true ? { 'hasChildren': true } : {}),
  ...(node.children !== undefined ? { 'children': node.children.map(serializeGameTreeNode) } : {}),
});

/**
 * Formats a log entry as a timestamped string with level and message.
 * @param entry - The log entry to format.
 * @returns A formatted string like "12:34:56.789 [WARN] message".
 */
export const formatLogEntry = (entry: LogEntry): string => {
  const time = new Date(entry.timestamp).toISOString().slice(11, 23);
  return `${time} [${entry.level.toUpperCase()}] ${entry.message}${entry.stack !== undefined ? `\n${entry.stack}` : ''}`;
};

/**
 * Formats all service nodes into a single text tree string.
 * @param services - The map of service name to game tree node.
 * @returns A newline-separated string of all formatted service trees.
 */
export const formatServicesTree = (services: ReadonlyMap<string, GameTreeNode>): string => {
  const lines: string[] = [];
  for (const [, node] of services) lines.push(formatGameTreeNode(node));
  return lines.join('\n');
};

/** The complete list of MCP tools exposed to the AI model for Roblox game interaction. */
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
  {
    'name': 'set_remote_spy_block_list',
    'description': 'Set the list of remotes to block from firing to the server.',
    'inputSchema': {
      'type': 'object',
      'properties': {
        'blocks': {
          'type': 'array',
          'items': {
            'type': 'object',
            'properties': {
              'type': { 'type': 'string', 'enum': ['path', 'name'], 'description': 'Match by path or name' },
              'value': { 'type': 'string', 'description': 'The path or name to block' },
            },
            'required': ['type', 'value'],
          },
          'description': 'Array of block entries',
        },
      },
      'required': ['blocks'],
    },
  },
  {
    'name': 'set_script_source',
    'description':
      'Set the source code of a Script, LocalScript, or ModuleScript. Only available when connected to Roblox Studio.',
    'inputSchema': {
      'type': 'object',
      'properties': {
        'path': { 'type': 'array', 'items': { 'type': 'string' }, 'description': 'Path to the script instance' },
        'source': { 'type': 'string', 'description': 'The new source code to set on the script' },
      },
      'required': ['path', 'source'],
    },
  },
  {
    'name': 'save_instance',
    'description':
      "Save the game's DataModel or a specific instance to a file on the executor's filesystem using saveinstance().",
    'inputSchema': {
      'type': 'object',
      'properties': {
        'path': {
          'type': 'array',
          'items': { 'type': 'string' },
          'description': 'Optional path to a specific instance to save. If omitted, saves the full game.',
        },
        'fileName': {
          'type': 'string',
          'description': 'Output file name (e.g., "game.rbxl", "workspace.rbxm"). Defaults to "game.rbxl".',
        },
        'decompile': { 'type': 'boolean', 'description': 'Whether to decompile scripts. Defaults to true.' },
      },
      'required': [],
    },
  },
];

/** Creates and configures the MCP server with all tools and resources. */
export const createMcpServer = (injectedBridge?: ExecutorBridge): { server: Server; bridge: ExecutorBridge } => {
  const logBuffer: LogEntry[] = [];

  const bridge = injectedBridge ?? createExecutorBridge((message: string) => console.error(`[mcp] ${message}`));

  bridge.onLog(entry => {
    logBuffer.push(entry);
    if (logBuffer.length > MAX_LOG_BUFFER) logBuffer.shift();
  });

  const server = new Server(
    { 'name': 'rbxdev-roblox', 'version': '0.3.0' },
    { 'capabilities': { 'tools': {}, 'resources': {} }, 'instructions': MCP_INSTRUCTIONS },
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
              'clientType': bridge.clientType ?? null,
              'lastUpdate': bridge.liveGameModel.lastUpdate,
              'servicesCount': bridge.liveGameModel.services.size,
            },
            null,
            2,
          ),
        );

      case 'execute_code': {
        if (bridge.isConnected === false) return NOT_CONNECTED;
        if (hasCapability(bridge.clientCapabilities, 'execute') === false)
          return errorResult('Error: Code execution is not available with the current client');
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
          const serialized: unknown[] = [];
          for (const [, node] of services) serialized.push(serializeGameTreeNode(node));
          return textResult(JSON.stringify(serialized, null, 2));
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
            `No remote calls captured. Remote Spy is ${bridge.isRemoteSpyEnabled ? 'enabled' : 'disabled, enable it first with set_remote_spy_enabled'}.`,
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
        if (hasCapability(bridge.clientCapabilities, 'remoteSpy') === false)
          return errorResult('Error: Remote Spy is not available with the current client');
        const typedArgs = args as { enabled: boolean };
        if (typeof typedArgs.enabled !== 'boolean')
          return errorResult('Error: enabled parameter is required (boolean)');

        return bridgeCall(
          () => bridge.setRemoteSpyEnabled(typedArgs.enabled),
          result => `Remote Spy ${result.enabled === true ? 'enabled' : 'disabled'}`,
          'Failed to set Remote Spy state',
        );
      }

      case 'set_remote_spy_block_list': {
        if (bridge.isConnected === false) return NOT_CONNECTED;
        if (hasCapability(bridge.clientCapabilities, 'remoteSpy') === false)
          return errorResult('Error: Remote Spy is not available with the current client');
        const typedArgs = args as { blocks: Array<{ type: 'path' | 'name'; value: string }> };
        if (Array.isArray(typedArgs.blocks) === false)
          return errorResult('Error: blocks parameter is required (array)');

        return bridgeCall(
          () => bridge.setRemoteSpyBlockList(typedArgs.blocks),
          () => `Block list updated (${typedArgs.blocks.length} entries)`,
          'Failed to set block list',
        );
      }

      case 'set_script_source': {
        if (bridge.isConnected === false) return NOT_CONNECTED;
        if (hasCapability(bridge.clientCapabilities, 'scriptWrite') === false)
          return errorResult('Error: Script writing is only available when connected to Roblox Studio');
        const typedArgs = args as { path: string[]; source: string };
        const pathError = requirePath(typedArgs.path);
        if (pathError !== undefined) return pathError;
        if (typeof typedArgs.source !== 'string') return errorResult('Error: source parameter is required');

        return bridgeCall(
          () => bridge.setScriptSource(typedArgs.path, typedArgs.source),
          () => `Successfully updated script source at ${typedArgs.path.join('.')}`,
          'Failed to set script source',
        );
      }

      case 'save_instance': {
        if (bridge.isConnected === false) return NOT_CONNECTED;
        if (hasCapability(bridge.clientCapabilities, 'saveInstance') === false)
          return errorResult('Error: Save instance is not available with the current client');
        const typedArgs = args as { path?: string[]; fileName?: string; decompile?: boolean };
        const fileName = typedArgs.fileName ?? 'game.rbxl';
        const decompile = typedArgs.decompile !== false;

        const optionParts: string[] = [];
        optionParts.push(`FilePath = "${fileName}"`);
        optionParts.push(`Decompile = ${decompile}`);

        if (typedArgs.path !== undefined && typedArgs.path.length > 0) {
          const serviceName = typedArgs.path[0] ?? '';
          let lookup = `game:GetService("${serviceName}")`;
          for (const part of typedArgs.path.slice(1)) lookup += `:FindFirstChild("${part}")`;
          optionParts.push(`Object = ${lookup}`);
        }

        const code = `if saveinstance == nil then return "Error: saveinstance not available" end\nlocal ok, err = pcall(saveinstance, {${optionParts.join(', ')}})\nif ok then return "Saved to ${fileName}" else return "Error: " .. tostring(err) end`;

        try {
          const result = await bridge.execute(code);
          if (result.success) return textResult(result.result ?? `Save initiated to ${fileName}`);
          return errorResult(`Save failed: ${result.error?.message ?? 'Unknown error'}`);
        } catch (err) {
          return errorResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
        }
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

  const log = (message: string): void => console.error(`[mcp] ${message}`);

  const available = await isPortAvailable(port);
  if (available === false) log(`Port ${port} in use, connecting as proxy client`);

  const bridge = available ? createExecutorBridge(log) : createProxyBridge(log);
  const { server } = createMcpServer(bridge);

  bridge.start(port);
  log(`Executor bridge started on port ${port}${available === false ? ' (proxy mode)' : ''}`);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  log('MCP server connected via stdio');
};
