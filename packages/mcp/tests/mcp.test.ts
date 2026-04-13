import { createLiveGameModel, type GameTreeNode, type LogEntry } from 'rbxdev-server';
import {
  createMcpServer,
  errorResult,
  formatGameTreeNode,
  formatLogEntry,
  formatServicesTree,
  requirePath,
  serializeGameTreeNode,
  textResult,
  tools,
} from '../src/server';
import { describe, expect, test } from 'bun:test';

describe('MCP Server - textResult / errorResult', () => {
  test('textResult wraps text in content array', () => {
    const result = textResult('hello');
    expect(result.content.length).toBe(1);
    expect(result.content[0]!.text).toBe('hello');
  });

  test('textResult content has type "text"', () => {
    const result = textResult('test');
    expect(result.content[0]!.type).toBe('text');
  });

  test('errorResult wraps text with isError flag', () => {
    const result = errorResult('something failed');
    expect(result.content[0]!.text).toBe('something failed');
    expect(result.isError).toBe(true);
  });

  test('errorResult content has type "text"', () => {
    const result = errorResult('err');
    expect(result.content[0]!.type).toBe('text');
  });

  test('textResult does not set isError', () => {
    const result = textResult('ok');
    expect(result.isError).toBeUndefined();
  });
});

describe('MCP Server - requirePath', () => {
  test('returns error for non-array', () => {
    const result = requirePath('not-an-array');
    expect(result).toBeDefined();
    expect(result!.isError).toBe(true);
  });

  test('returns error for empty array', () => {
    const result = requirePath([]);
    expect(result).toBeDefined();
    expect(result!.isError).toBe(true);
  });

  test('returns undefined for valid path array', () => {
    const result = requirePath(['Workspace', 'Part']);
    expect(result).toBeUndefined();
  });

  test('returns error for undefined', () => {
    const result = requirePath(undefined);
    expect(result).toBeDefined();
    expect(result!.isError).toBe(true);
  });

  test('returns error for null', () => {
    const result = requirePath(null);
    expect(result).toBeDefined();
    expect(result!.isError).toBe(true);
  });

  test('returns undefined for single-element path', () => {
    const result = requirePath(['Workspace']);
    expect(result).toBeUndefined();
  });
});

describe('MCP Server - formatGameTreeNode', () => {
  test('formats leaf node', () => {
    const node: GameTreeNode = { 'name': 'MyPart', 'className': 'Part' };
    expect(formatGameTreeNode(node)).toBe('MyPart (Part)');
  });

  test('formats node with children', () => {
    const node: GameTreeNode = {
      'name': 'Workspace',
      'className': 'Workspace',
      'children': [{ 'name': 'Part1', 'className': 'Part' }],
    };
    const result = formatGameTreeNode(node);
    expect(result).toContain('Workspace (Workspace)');
    expect(result).toContain('  Part1 (Part)');
  });

  test('shows [+] for hasChildren with no children loaded', () => {
    const node: GameTreeNode = { 'name': 'Folder', 'className': 'Folder', 'hasChildren': true };
    expect(formatGameTreeNode(node)).toBe('Folder (Folder) [+]');
  });

  test('does not show [+] when children are loaded', () => {
    const node: GameTreeNode = {
      'name': 'Folder',
      'className': 'Folder',
      'hasChildren': true,
      'children': [{ 'name': 'Child', 'className': 'Part' }],
    };
    const result = formatGameTreeNode(node);
    expect(result).not.toContain('[+]');
  });

  test('indents nested children correctly', () => {
    const node: GameTreeNode = {
      'name': 'Root',
      'className': 'DataModel',
      'children': [
        {
          'name': 'Level1',
          'className': 'Folder',
          'children': [{ 'name': 'Level2', 'className': 'Part' }],
        },
      ],
    };
    const result = formatGameTreeNode(node);
    expect(result).toContain('Root (DataModel)');
    expect(result).toContain('  Level1 (Folder)');
    expect(result).toContain('    Level2 (Part)');
  });

  test('handles indent parameter', () => {
    const node: GameTreeNode = { 'name': 'Deep', 'className': 'Part' };
    const result = formatGameTreeNode(node, 3);
    expect(result).toBe('      Deep (Part)');
  });
});

describe('MCP Server - serializeGameTreeNode', () => {
  test('serializes leaf node', () => {
    const node: GameTreeNode = { 'name': 'Part1', 'className': 'Part' };
    const result = serializeGameTreeNode(node);
    expect(result.name).toBe('Part1');
    expect(result.className).toBe('Part');
    expect(result.hasChildren).toBeUndefined();
    expect(result.children).toBeUndefined();
  });

  test('includes hasChildren when true', () => {
    const node: GameTreeNode = { 'name': 'Folder', 'className': 'Folder', 'hasChildren': true };
    const result = serializeGameTreeNode(node);
    expect(result.hasChildren).toBe(true);
  });

  test('includes children array', () => {
    const node: GameTreeNode = {
      'name': 'Parent',
      'className': 'Model',
      'children': [{ 'name': 'Child', 'className': 'Part' }],
    };
    const result = serializeGameTreeNode(node);
    expect(result.children).toBeDefined();
    expect(result.children!.length).toBe(1);
  });

  test('recursively serializes nested children', () => {
    const node: GameTreeNode = {
      'name': 'Root',
      'className': 'DataModel',
      'children': [
        {
          'name': 'Mid',
          'className': 'Folder',
          'children': [{ 'name': 'Leaf', 'className': 'Part' }],
        },
      ],
    };
    const result = serializeGameTreeNode(node);
    const mid = result.children![0] as { name: string; children?: unknown[] };
    expect(mid.name).toBe('Mid');
    expect(mid.children).toBeDefined();
    expect(mid.children!.length).toBe(1);
  });
});

describe('MCP Server - formatLogEntry', () => {
  test('formats info log entry', () => {
    const entry: LogEntry = {
      'level': 'info',
      'message': 'Hello world',
      'timestamp': new Date('2025-01-15T10:30:45.123Z').getTime(),
    };
    const result = formatLogEntry(entry);
    expect(result).toContain('[INFO]');
    expect(result).toContain('Hello world');
    expect(result).toContain('10:30:45.123');
  });

  test('formats warn log entry', () => {
    const entry: LogEntry = {
      'level': 'warn',
      'message': 'Be careful',
      'timestamp': Date.now(),
    };
    const result = formatLogEntry(entry);
    expect(result).toContain('[WARN]');
    expect(result).toContain('Be careful');
  });

  test('includes stack trace when present', () => {
    const entry: LogEntry = {
      'level': 'error',
      'message': 'Failed',
      'stack': 'at line 10\nat line 20',
      'timestamp': Date.now(),
    };
    const result = formatLogEntry(entry);
    expect(result).toContain('[ERROR]');
    expect(result).toContain('Failed');
    expect(result).toContain('at line 10');
  });

  test('does not include stack when undefined', () => {
    const entry: LogEntry = {
      'level': 'info',
      'message': 'No stack',
      'timestamp': Date.now(),
    };
    const result = formatLogEntry(entry);
    expect(result).not.toContain('\n');
  });
});

describe('MCP Server - formatServicesTree', () => {
  test('returns empty string for empty map', () => {
    const services = new Map<string, GameTreeNode>();
    expect(formatServicesTree(services)).toBe('');
  });

  test('formats single service', () => {
    const services = new Map<string, GameTreeNode>();
    services.set('Workspace', { 'name': 'Workspace', 'className': 'Workspace' });
    const result = formatServicesTree(services);
    expect(result).toBe('Workspace (Workspace)');
  });

  test('formats multiple services joined by newline', () => {
    const services = new Map<string, GameTreeNode>();
    services.set('Workspace', { 'name': 'Workspace', 'className': 'Workspace' });
    services.set('Players', { 'name': 'Players', 'className': 'Players' });
    const result = formatServicesTree(services);
    expect(result).toContain('Workspace (Workspace)');
    expect(result).toContain('Players (Players)');
    expect(result.split('\n').length).toBeGreaterThanOrEqual(2);
  });
});

describe('MCP Server - tools array', () => {
  test('has 19 tools', () => {
    expect(tools.length).toBe(19);
  });

  test('all tools have name, description, and inputSchema', () => {
    for (const tool of tools) {
      expect(typeof tool.name).toBe('string');
      expect(tool.name.length).toBeGreaterThan(0);
      expect(typeof tool.description).toBe('string');
      expect(tool.inputSchema).toBeDefined();
    }
  });

  test('tool names match expected set', () => {
    const names = tools.map(t => t.name);
    expect(names).toContain('get_bridge_status');
    expect(names).toContain('execute_code');
    expect(names).toContain('get_game_tree');
    expect(names).toContain('get_properties');
    expect(names).toContain('set_property');
    expect(names).toContain('teleport_player');
    expect(names).toContain('delete_instance');
    expect(names).toContain('reparent_instance');
    expect(names).toContain('get_children');
    expect(names).toContain('get_console_output');
    expect(names).toContain('refresh_game_tree');
    expect(names).toContain('get_script_source');
    expect(names).toContain('create_instance');
    expect(names).toContain('clone_instance');
    expect(names).toContain('get_remote_calls');
    expect(names).toContain('set_remote_spy_enabled');
    expect(names).toContain('set_remote_spy_block_list');
    expect(names).toContain('save_instance');
  });

  test('set_remote_spy_block_list requires blocks parameter', () => {
    const tool = tools.find(t => t.name === 'set_remote_spy_block_list');
    expect(tool).toBeDefined();
    const schema = tool!.inputSchema as { required?: string[] };
    expect(schema.required).toContain('blocks');
  });

  test('save_instance has optional path and fileName parameters', () => {
    const tool = tools.find(t => t.name === 'save_instance');
    expect(tool).toBeDefined();
    const schema = tool!.inputSchema as { properties?: Record<string, unknown>; required?: string[] };
    expect(schema.properties).toBeDefined();
    expect(schema.properties!['path']).toBeDefined();
    expect(schema.properties!['fileName']).toBeDefined();
    expect(schema.properties!['decompile']).toBeDefined();
    expect(schema.required ?? []).not.toContain('path');
    expect(schema.required ?? []).not.toContain('fileName');
  });

  test('all tool names are unique', () => {
    const names = tools.map(t => t.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  test('execute_code requires code parameter', () => {
    const tool = tools.find(t => t.name === 'execute_code');
    expect(tool).toBeDefined();
    const schema = tool!.inputSchema as { required?: string[] };
    expect(schema.required).toContain('code');
  });

  test('get_properties requires path parameter', () => {
    const tool = tools.find(t => t.name === 'get_properties');
    expect(tool).toBeDefined();
    const schema = tool!.inputSchema as { required?: string[] };
    expect(schema.required).toContain('path');
  });
});

describe('MCP Server - createMcpServer', () => {
  test('returns server and bridge objects', () => {
    const result = createMcpServer();
    expect(result.server).toBeDefined();
    expect(result.bridge).toBeDefined();
  });

  test('bridge has expected interface properties', () => {
    const { bridge } = createMcpServer();
    expect(typeof bridge.isRunning).toBe('boolean');
    expect(typeof bridge.isConnected).toBe('boolean');
    expect(bridge.liveGameModel).toBeDefined();
    expect(typeof bridge.start).toBe('function');
    expect(typeof bridge.stop).toBe('function');
    expect(typeof bridge.execute).toBe('function');
  });

  test('bridge starts disconnected', () => {
    const { bridge } = createMcpServer();
    expect(bridge.isConnected).toBe(false);
  });
});

describe('LiveGameModel', () => {
  test('initial state is not connected with no services', () => {
    const { model } = createLiveGameModel();
    expect(model.isConnected).toBe(false);
    expect(model.services.size).toBe(0);
    expect(model.lastUpdate).toBe(0);
  });

  test('update adds services to map', () => {
    const { model, update } = createLiveGameModel();
    update([
      { 'name': 'Workspace', 'className': 'Workspace' },
      { 'name': 'Players', 'className': 'Players' },
    ]);
    expect(model.services.size).toBe(2);
    expect(model.services.has('Workspace')).toBe(true);
    expect(model.services.has('Players')).toBe(true);
  });

  test('update sets lastUpdate timestamp', () => {
    const { model, update } = createLiveGameModel();
    const before = Date.now();
    update([{ 'name': 'Workspace', 'className': 'Workspace' }]);
    expect(model.lastUpdate).toBeGreaterThanOrEqual(before);
  });

  test('setConnected toggles connected state', () => {
    const { model, setConnected } = createLiveGameModel();
    setConnected(true);
    expect(model.isConnected).toBe(true);
    setConnected(false);
    expect(model.isConnected).toBe(false);
  });

  test('setConnected(false) clears services', () => {
    const { model, update, setConnected } = createLiveGameModel();
    update([{ 'name': 'Workspace', 'className': 'Workspace' }]);
    expect(model.services.size).toBe(1);
    setConnected(false);
    expect(model.services.size).toBe(0);
    expect(model.lastUpdate).toBe(0);
  });

  test('clear removes all services', () => {
    const { model, update, clear } = createLiveGameModel();
    update([{ 'name': 'Workspace', 'className': 'Workspace' }]);
    clear();
    expect(model.services.size).toBe(0);
    expect(model.lastUpdate).toBe(0);
  });

  test('getNode finds service by path', () => {
    const { model, update } = createLiveGameModel();
    update([
      {
        'name': 'Workspace',
        'className': 'Workspace',
        'children': [{ 'name': 'Part1', 'className': 'Part' }],
      },
    ]);
    const node = model.getNode(['Workspace', 'Part1']);
    expect(node).toBeDefined();
    expect(node!.name).toBe('Part1');
    expect(node!.className).toBe('Part');
  });

  test('getNode returns undefined for missing path', () => {
    const { model, update } = createLiveGameModel();
    update([{ 'name': 'Workspace', 'className': 'Workspace' }]);
    const node = model.getNode(['Workspace', 'NonExistent']);
    expect(node).toBeUndefined();
  });

  test('getNode handles "game" prefix', () => {
    const { model, update } = createLiveGameModel();
    update([{ 'name': 'Workspace', 'className': 'Workspace' }]);
    const node = model.getNode(['game', 'Workspace']);
    expect(node).toBeDefined();
    expect(node!.name).toBe('Workspace');
  });

  test('getNode returns service root when path has one element', () => {
    const { model, update } = createLiveGameModel();
    update([{ 'name': 'Players', 'className': 'Players' }]);
    const node = model.getNode(['Players']);
    expect(node).toBeDefined();
    expect(node!.name).toBe('Players');
  });

  test('getChildren returns service children map', () => {
    const { model, update } = createLiveGameModel();
    update([
      {
        'name': 'Workspace',
        'className': 'Workspace',
        'children': [
          { 'name': 'Part1', 'className': 'Part' },
          { 'name': 'Part2', 'className': 'Part' },
        ],
      },
    ]);
    const children = model.getChildren(['Workspace']);
    expect(children).toBeDefined();
    expect(children!.size).toBe(2);
    expect(children!.has('Part1')).toBe(true);
    expect(children!.has('Part2')).toBe(true);
  });

  test('getChildren returns root services for empty path', () => {
    const { model, update } = createLiveGameModel();
    update([
      { 'name': 'Workspace', 'className': 'Workspace' },
      { 'name': 'Players', 'className': 'Players' },
    ]);
    const children = model.getChildren([]);
    expect(children).toBeDefined();
    expect(children!.size).toBe(2);
  });

  test('mergeChildren updates children on target node', () => {
    const { model, update, mergeChildren } = createLiveGameModel();
    update([{ 'name': 'Workspace', 'className': 'Workspace', 'hasChildren': true }]);

    mergeChildren(['Workspace'], [{ 'name': 'NewChild', 'className': 'Part' }]);

    const node = model.getNode(['Workspace']);
    expect(node).toBeDefined();
    expect(node!.children).toBeDefined();
    expect(node!.children!.length).toBe(1);
    expect(node!.children![0]!.name).toBe('NewChild');
  });

  test('getNode returns undefined for empty path', () => {
    const { model } = createLiveGameModel();
    expect(model.getNode([])).toBeUndefined();
  });

  test('update replaces previous services', () => {
    const { model, update } = createLiveGameModel();
    update([{ 'name': 'Workspace', 'className': 'Workspace' }]);
    expect(model.services.size).toBe(1);
    update([{ 'name': 'Players', 'className': 'Players' }]);
    expect(model.services.size).toBe(1);
    expect(model.services.has('Workspace')).toBe(false);
    expect(model.services.has('Players')).toBe(true);
  });
});
