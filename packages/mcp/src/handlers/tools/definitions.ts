import type { Tool } from '@modelcontextprotocol/sdk/types.js';

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
