import { createBridgeCore, hasCapability, resolveCapabilities, type BridgeCapability } from 'rbxdev-server';
import { describe, expect, test } from 'bun:test';
import { tools } from '../src/server';

const noop = (): void => {};

describe('ClientType & Capabilities', () => {
  describe('resolveCapabilities', () => {
    test('executor gets all standard capabilities', () => {
      const caps = resolveCapabilities('executor');
      expect(caps.clientType).toBe('executor');
      expect(caps.capabilities.has('execute')).toBe(true);
      expect(caps.capabilities.has('scriptSource')).toBe(true);
      expect(caps.capabilities.has('remoteSpy')).toBe(true);
      expect(caps.capabilities.has('saveInstance')).toBe(true);
      expect(caps.capabilities.has('gameTree')).toBe(true);
      expect(caps.capabilities.has('properties')).toBe(true);
      expect(caps.capabilities.has('instanceManipulation')).toBe(true);
      expect(caps.capabilities.has('teleport')).toBe(true);
      expect(caps.capabilities.has('console')).toBe(true);
      expect(caps.capabilities.has('moduleInterface')).toBe(true);
    });

    test('executor does not have scriptWrite capability', () => {
      const caps = resolveCapabilities('executor');
      expect(caps.capabilities.has('scriptWrite')).toBe(false);
    });

    test('studio gets all non-executor capabilities', () => {
      const caps = resolveCapabilities('studio');
      expect(caps.clientType).toBe('studio');
      expect(caps.capabilities.has('execute')).toBe(true);
      expect(caps.capabilities.has('scriptSource')).toBe(true);
      expect(caps.capabilities.has('scriptWrite')).toBe(true);
      expect(caps.capabilities.has('gameTree')).toBe(true);
      expect(caps.capabilities.has('properties')).toBe(true);
      expect(caps.capabilities.has('instanceManipulation')).toBe(true);
      expect(caps.capabilities.has('teleport')).toBe(true);
      expect(caps.capabilities.has('console')).toBe(true);
      expect(caps.capabilities.has('moduleInterface')).toBe(true);
    });

    test('studio does not have remoteSpy capability', () => {
      const caps = resolveCapabilities('studio');
      expect(caps.capabilities.has('remoteSpy')).toBe(false);
    });

    test('studio does not have saveInstance capability', () => {
      const caps = resolveCapabilities('studio');
      expect(caps.capabilities.has('saveInstance')).toBe(false);
    });
  });

  describe('hasCapability', () => {
    test('returns false for undefined capabilities', () => {
      expect(hasCapability(undefined, 'execute')).toBe(false);
    });

    test('returns true for present capability', () => {
      const caps = resolveCapabilities('executor');
      expect(hasCapability(caps, 'execute')).toBe(true);
    });

    test('returns false for missing capability', () => {
      const caps = resolveCapabilities('studio');
      expect(hasCapability(caps, 'remoteSpy')).toBe(false);
    });

    test('correctly differentiates executor and studio for scriptWrite', () => {
      const executorCaps = resolveCapabilities('executor');
      const studioCaps = resolveCapabilities('studio');
      expect(hasCapability(executorCaps, 'scriptWrite')).toBe(false);
      expect(hasCapability(studioCaps, 'scriptWrite')).toBe(true);
    });

    test('correctly differentiates executor and studio for saveInstance', () => {
      const executorCaps = resolveCapabilities('executor');
      const studioCaps = resolveCapabilities('studio');
      expect(hasCapability(executorCaps, 'saveInstance')).toBe(true);
      expect(hasCapability(studioCaps, 'saveInstance')).toBe(false);
    });

    test('both client types share common capabilities', () => {
      const shared: BridgeCapability[] = [
        'gameTree',
        'properties',
        'instanceManipulation',
        'teleport',
        'console',
        'moduleInterface',
      ];
      const executorCaps = resolveCapabilities('executor');
      const studioCaps = resolveCapabilities('studio');

      for (const cap of shared) {
        expect(hasCapability(executorCaps, cap)).toBe(true);
        expect(hasCapability(studioCaps, cap)).toBe(true);
      }
    });
  });
});

describe('BridgeCore - Client Type', () => {
  test('initial client type is undefined', () => {
    const core = createBridgeCore(noop, () => false, noop);
    expect(core.getClientType()).toBeUndefined();
  });

  test('initial client capabilities is undefined', () => {
    const core = createBridgeCore(noop, () => false, noop);
    expect(core.getClientCapabilities()).toBeUndefined();
  });

  test('connected message without clientType defaults to executor', () => {
    const core = createBridgeCore(noop, () => true, noop);
    core.handleMessage(JSON.stringify({ 'type': 'connected', 'executorName': 'Volt', 'version': '1.0' }));
    expect(core.getClientType()).toBe('executor');
    expect(core.getClientCapabilities()?.clientType).toBe('executor');
  });

  test('connected message with clientType executor sets executor', () => {
    const core = createBridgeCore(noop, () => true, noop);
    core.handleMessage(
      JSON.stringify({ 'type': 'connected', 'executorName': 'Volt', 'version': '1.0', 'clientType': 'executor' }),
    );
    expect(core.getClientType()).toBe('executor');
  });

  test('connected message with clientType studio sets studio', () => {
    const core = createBridgeCore(noop, () => true, noop);
    core.handleMessage(
      JSON.stringify({
        'type': 'connected',
        'executorName': 'RbxdevStudio',
        'version': '0.1.0',
        'clientType': 'studio',
      }),
    );
    expect(core.getClientType()).toBe('studio');
    expect(core.getClientCapabilities()?.clientType).toBe('studio');
  });

  test('studio client has scriptWrite capability', () => {
    const core = createBridgeCore(noop, () => true, noop);
    core.handleMessage(
      JSON.stringify({
        'type': 'connected',
        'executorName': 'RbxdevStudio',
        'version': '0.1.0',
        'clientType': 'studio',
      }),
    );
    const caps = core.getClientCapabilities();
    expect(caps).toBeDefined();
    expect(hasCapability(caps, 'scriptWrite')).toBe(true);
    expect(hasCapability(caps, 'remoteSpy')).toBe(false);
  });

  test('executor client has remoteSpy capability', () => {
    const core = createBridgeCore(noop, () => true, noop);
    core.handleMessage(JSON.stringify({ 'type': 'connected', 'executorName': 'Volt', 'version': '1.0' }));
    const caps = core.getClientCapabilities();
    expect(caps).toBeDefined();
    expect(hasCapability(caps, 'remoteSpy')).toBe(true);
    expect(hasCapability(caps, 'scriptWrite')).toBe(false);
  });

  test('setExecutorName to undefined resets client type and capabilities', () => {
    const core = createBridgeCore(noop, () => true, noop);
    core.handleMessage(
      JSON.stringify({
        'type': 'connected',
        'executorName': 'RbxdevStudio',
        'version': '0.1.0',
        'clientType': 'studio',
      }),
    );
    expect(core.getClientType()).toBe('studio');

    core.setExecutorName(undefined);
    expect(core.getClientType()).toBeUndefined();
    expect(core.getClientCapabilities()).toBeUndefined();
  });

  test('reconnecting with different client type updates capabilities', () => {
    const core = createBridgeCore(noop, () => true, noop);
    core.handleMessage(
      JSON.stringify({
        'type': 'connected',
        'executorName': 'RbxdevStudio',
        'version': '0.1.0',
        'clientType': 'studio',
      }),
    );
    expect(core.getClientType()).toBe('studio');

    core.handleMessage(JSON.stringify({ 'type': 'connected', 'executorName': 'Volt', 'version': '2.0' }));
    expect(core.getClientType()).toBe('executor');
    expect(hasCapability(core.getClientCapabilities(), 'remoteSpy')).toBe(true);
    expect(hasCapability(core.getClientCapabilities(), 'scriptWrite')).toBe(false);
  });
});

describe('Protocol - ConnectedMessage validation', () => {
  test('valid connected message without clientType parses', () => {
    const core = createBridgeCore(noop, () => true, noop);
    core.handleMessage(JSON.stringify({ 'type': 'connected', 'executorName': 'Test', 'version': '1.0' }));
    expect(core.getExecutorName()).toBe('Test');
  });

  test('valid connected message with clientType studio parses', () => {
    const core = createBridgeCore(noop, () => true, noop);
    core.handleMessage(
      JSON.stringify({ 'type': 'connected', 'executorName': 'Studio', 'version': '1.0', 'clientType': 'studio' }),
    );
    expect(core.getExecutorName()).toBe('Studio');
    expect(core.getClientType()).toBe('studio');
  });

  test('connected message with invalid clientType is rejected', () => {
    const core = createBridgeCore(noop, () => true, noop);
    core.handleMessage(
      JSON.stringify({ 'type': 'connected', 'executorName': 'Bad', 'version': '1.0', 'clientType': 'invalid' }),
    );
    expect(core.getExecutorName()).toBeUndefined();
  });

  test('setScriptSourceResult message resolves pending request', () => {
    let sentMessage: unknown;
    const core = createBridgeCore(
      msg => {
        sentMessage = msg;
      },
      () => true,
      noop,
    );
    core.handleMessage(
      JSON.stringify({ 'type': 'connected', 'executorName': 'Studio', 'version': '1.0', 'clientType': 'studio' }),
    );

    const promise = core.setScriptSource(['Workspace', 'Script'], 'print("hello")');
    expect(sentMessage).toBeDefined();

    const sent = sentMessage as { type: string; id: string; path: string[]; source: string };
    core.handleMessage(JSON.stringify({ 'type': 'setScriptSourceResult', 'id': sent.id, 'success': true }));

    return promise.then(result => {
      expect(result.success).toBe(true);
    });
  });

  test('setScriptSourceResult with error resolves with error', () => {
    let sentMessage: unknown;
    const core = createBridgeCore(
      msg => {
        sentMessage = msg;
      },
      () => true,
      noop,
    );
    core.handleMessage(
      JSON.stringify({ 'type': 'connected', 'executorName': 'Studio', 'version': '1.0', 'clientType': 'studio' }),
    );

    const promise = core.setScriptSource(['Workspace', 'Script'], 'bad code');

    const sent = sentMessage as { type: string; id: string };
    core.handleMessage(
      JSON.stringify({
        'type': 'setScriptSourceResult',
        'id': sent.id,
        'success': false,
        'error': 'Permission denied',
      }),
    );

    return promise.then(result => {
      expect(result.success).toBe(false);
      expect(result.error).toBe('Permission denied');
    });
  });
});

describe('MCP Tools - Studio compatibility', () => {
  test('tools array includes set_script_source', () => {
    const scriptSourceTool = tools.find(t => t.name === 'set_script_source');
    expect(scriptSourceTool).toBeDefined();
    expect(scriptSourceTool?.description).toContain('Studio');
  });

  test('set_script_source requires path and source parameters', () => {
    const tool = tools.find(t => t.name === 'set_script_source');
    expect(tool).toBeDefined();
    const schema = tool?.inputSchema as { required?: string[] };
    expect(schema.required).toContain('path');
    expect(schema.required).toContain('source');
  });

  test('tools array has 19 tools total', () => {
    expect(tools.length).toBe(19);
  });

  test('all executor-only tools exist', () => {
    const executorTools = ['execute_code', 'set_remote_spy_enabled', 'set_remote_spy_block_list', 'save_instance'];
    for (const name of executorTools) {
      expect(tools.find(t => t.name === name)).toBeDefined();
    }
  });

  test('all shared tools exist', () => {
    const sharedTools = [
      'get_bridge_status',
      'get_game_tree',
      'get_properties',
      'set_property',
      'teleport_player',
      'delete_instance',
      'reparent_instance',
      'get_children',
      'get_console_output',
      'refresh_game_tree',
      'get_script_source',
      'create_instance',
      'clone_instance',
      'get_remote_calls',
    ];
    for (const name of sharedTools) {
      expect(tools.find(t => t.name === name)).toBeDefined();
    }
  });
});
