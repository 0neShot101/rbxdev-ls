import { createBridgeCore } from '@executor/bridgeCore';
import { isSetRemoteSpyBlockListResultMessage, parseClientMessage } from '@executor/protocol';
import { describe, expect, test } from 'bun:test';
import type { RemoteSpyCall, RemoteSpySource, ServerMessage } from '@typings/protocol';

const noop = (): void => {};

describe('Remote Spy Block List - Protocol Guards', () => {
  test('isSetRemoteSpyBlockListResultMessage accepts valid message', () => {
    const msg = { 'type': 'setRemoteSpyBlockListResult', 'id': 'abc123', 'success': true };
    expect(isSetRemoteSpyBlockListResultMessage(msg)).toBe(true);
  });

  test('isSetRemoteSpyBlockListResultMessage rejects wrong type', () => {
    const msg = { 'type': 'otherMessage', 'id': 'abc123', 'success': true };
    expect(isSetRemoteSpyBlockListResultMessage(msg)).toBe(false);
  });

  test('isSetRemoteSpyBlockListResultMessage rejects missing id', () => {
    const msg = { 'type': 'setRemoteSpyBlockListResult', 'success': true };
    expect(isSetRemoteSpyBlockListResultMessage(msg)).toBe(false);
  });

  test('isSetRemoteSpyBlockListResultMessage rejects missing success', () => {
    const msg = { 'type': 'setRemoteSpyBlockListResult', 'id': 'abc123' };
    expect(isSetRemoteSpyBlockListResultMessage(msg)).toBe(false);
  });

  test('parseClientMessage parses setRemoteSpyBlockListResult', () => {
    const raw = JSON.stringify({ 'type': 'setRemoteSpyBlockListResult', 'id': 'test1', 'success': true });
    const result = parseClientMessage(raw);
    expect(result).toBeDefined();
    expect(result!.type).toBe('setRemoteSpyBlockListResult');
  });

  test('parseClientMessage parses setRemoteSpyBlockListResult with error', () => {
    const raw = JSON.stringify({
      'type': 'setRemoteSpyBlockListResult',
      'id': 'test2',
      'success': false,
      'error': 'not supported',
    });
    const result = parseClientMessage(raw);
    expect(result).toBeDefined();
    expect(result!.type).toBe('setRemoteSpyBlockListResult');
  });
});

describe('Remote Spy Block List - BridgeCore', () => {
  test('bridge core exposes setRemoteSpyBlockList method', () => {
    const core = createBridgeCore(noop, () => false, noop);
    expect(typeof core.setRemoteSpyBlockList).toBe('function');
  });

  test('setRemoteSpyBlockList rejects when not connected', async () => {
    const core = createBridgeCore(noop, () => false, noop);
    try {
      await core.setRemoteSpyBlockList([{ 'type': 'name', 'value': 'TestRemote' }]);
      expect(true).toBe(false);
    } catch (err) {
      expect(err instanceof Error).toBe(true);
      expect((err as Error).message).toContain('No executor connected');
    }
  });

  test('bridge core handles setRemoteSpyBlockListResult message', () => {
    const sent: unknown[] = [];
    const core = createBridgeCore(
      msg => sent.push(msg),
      () => true,
      noop,
    );

    core.setExecutorName('TestExecutor');
    core.setStatus('connected');

    const promise = core.setRemoteSpyBlockList([{ 'type': 'name', 'value': 'ChatEvent' }]);

    expect(sent.length).toBe(1);
    const sentMsg = sent[0] as { type: string; id: string; blocks: unknown[] };
    expect(sentMsg.type).toBe('setRemoteSpyBlockList');
    expect(sentMsg.blocks.length).toBe(1);

    core.handleMessage(
      JSON.stringify({
        'type': 'setRemoteSpyBlockListResult',
        'id': sentMsg.id,
        'success': true,
      }),
    );

    return promise.then(result => {
      expect(result.success).toBe(true);
    });
  });

  test('remote spy calls buffer captures calls', () => {
    const core = createBridgeCore(noop, () => true, noop);
    expect(core.getRemoteSpyCalls().length).toBe(0);

    core.handleMessage(
      JSON.stringify({
        'type': 'remoteSpy',
        'call': {
          'remoteName': 'TestRemote',
          'remotePath': ['ReplicatedStorage', 'TestRemote'],
          'remoteType': 'RemoteEvent',
          'method': 'FireServer',
          'arguments': '"hello"',
          'code': 'game:GetService("ReplicatedStorage").TestRemote:FireServer("hello")',
          'timestamp': 1000,
        },
      }),
    );

    expect(core.getRemoteSpyCalls().length).toBe(1);
    const call = core.getRemoteSpyCalls()[0]!;
    expect(call.remoteName).toBe('TestRemote');
    expect(call.method).toBe('FireServer');
  });

  test('remote spy onRemoteSpy callback fires', () => {
    const core = createBridgeCore(noop, () => true, noop);
    const captured: string[] = [];
    core.onRemoteSpy(call => captured.push(call.remoteName));

    core.handleMessage(
      JSON.stringify({
        'type': 'remoteSpy',
        'call': {
          'remoteName': 'EventA',
          'remotePath': ['ReplicatedStorage', 'EventA'],
          'remoteType': 'RemoteEvent',
          'method': 'FireServer',
          'arguments': '',
          'code': '',
          'timestamp': 1000,
        },
      }),
    );

    expect(captured.length).toBe(1);
    expect(captured[0]).toBe('EventA');
  });
});

describe('Remote Spy - executor session reload', () => {
  const setup = () => {
    const sent: ServerMessage[] = [];
    const logs: string[] = [];
    let progress: (() => void) | undefined;
    const core = createBridgeCore(
      message => {
        sent.push(message);
        progress?.();
      },
      () => true,
      message => {
        logs.push(message);
        progress?.();
      },
    );
    const handshake = (): void =>
      core.handleMessage(JSON.stringify({ 'type': 'connected', 'executorName': 'TestExecutor', 'version': '1' }));
    const reply = (type: string, success = true, enabled?: boolean, source?: RemoteSpySource): void => {
      const request = [...sent].reverse().find(message => message.type === type);
      if (request === undefined || !('id' in request)) throw new Error(`Missing ${type} request`);
      core.handleMessage(
        JSON.stringify({
          'type': `${type}Result`,
          'id': request.id,
          success,
          enabled,
          source,
          'error': success ? undefined : 'executor rejected restore',
        }),
      );
    };
    const advance = async (type: string, success = true): Promise<void> => {
      const { promise, resolve } = Promise.withResolvers<void>();
      progress = resolve;
      reply(type, success);
      await promise;
      progress = undefined;
    };
    handshake();
    return { core, sent, logs, handshake, reply, advance };
  };

  test('replays the last acknowledged capture source after a same-socket reload', async () => {
    const { core, sent, handshake, reply, advance } = setup();
    const enabling = core.setRemoteSpyEnabled(true, 'both');

    expect(sent.at(-1)).toMatchObject({ 'type': 'setRemoteSpyEnabled', 'source': 'both' });
    reply('setRemoteSpyEnabled', true, true, 'both');
    expect((await enabling).source).toBe('both');

    const rejected = core.setRemoteSpyEnabled(true, 'executor');
    reply('setRemoteSpyEnabled', false);
    await rejected;

    handshake();
    await advance('setRemoteSpyFilter');
    await advance('setRemoteSpyBlockList');

    expect(sent.at(-1)).toMatchObject({ 'type': 'setRemoteSpyEnabled', 'enabled': true, 'source': 'both' });
    reply('setRemoteSpyEnabled', true, true, 'both');
  });

  test('restores filter and blocks before enabling on a reused socket', async () => {
    const { core, sent, handshake, reply, advance } = setup();
    expect(sent).toEqual([]);
    const filtering = core.setRemoteSpyFilter('Chat');
    reply('setRemoteSpyFilter');
    await filtering;
    const blocking = core.setRemoteSpyBlockList([{ 'type': 'name', 'value': 'Blocked' }]);
    reply('setRemoteSpyBlockList');
    await blocking;
    const enabling = core.setRemoteSpyEnabled(true);
    reply('setRemoteSpyEnabled', true, true);
    await enabling;
    expect(core.getRemoteSpyEnabled()).toBe(true);

    sent.length = 0;
    handshake();
    expect(core.getRemoteSpyEnabled()).toBe(false);
    expect(sent.map(message => message.type)).toEqual(['setRemoteSpyFilter']);
    expect(sent[0]).toMatchObject({ 'filter': 'Chat' });
    await advance('setRemoteSpyFilter');
    expect(sent[1]).toMatchObject({
      'type': 'setRemoteSpyBlockList',
      'blocks': [{ 'type': 'name', 'value': 'Blocked' }],
    });
    await advance('setRemoteSpyBlockList');
    expect(sent[2]).toMatchObject({ 'type': 'setRemoteSpyEnabled', 'enabled': true });
    reply('setRemoteSpyEnabled', true, true);
    expect(core.getRemoteSpyEnabled()).toBe(true);
  });

  test('retires old requests and ignores late old-session enable results', async () => {
    const { core, sent, handshake, reply, advance } = setup();
    const enabling = core.setRemoteSpyEnabled(true);
    const oldRequest = sent[0];
    if (oldRequest?.type !== 'setRemoteSpyEnabled') throw new Error('Expected enable');
    handshake();
    expect(await enabling).toMatchObject({ 'success': false, 'error': 'Executor session replaced' });
    core.handleMessage(
      JSON.stringify({ 'type': 'setRemoteSpyEnabledResult', 'id': oldRequest.id, 'success': true, 'enabled': true }),
    );
    expect(core.getRemoteSpyEnabled()).toBe(false);
    await advance('setRemoteSpyFilter');
    await advance('setRemoteSpyBlockList');
    expect(sent.at(-1)).toMatchObject({ 'type': 'setRemoteSpyEnabled', 'enabled': false });
    reply('setRemoteSpyEnabled', true, false);
  });

  test('failed reload enable stays off and reports the restore failure', async () => {
    const { core, logs, handshake, reply, advance } = setup();
    const enabling = core.setRemoteSpyEnabled(true);
    reply('setRemoteSpyEnabled', true, true);
    await enabling;
    handshake();
    await advance('setRemoteSpyFilter');
    await advance('setRemoteSpyBlockList');
    await advance('setRemoteSpyEnabled', false);
    expect(core.getRemoteSpyEnabled()).toBe(false);
    expect(logs.some(message => message.includes('Failed to restore Remote Spy: executor rejected restore'))).toBe(
      true,
    );
  });

  test('disconnect retires all spy operations immediately', async () => {
    const { core, reply } = setup();
    const enabling = core.setRemoteSpyEnabled(true);
    reply('setRemoteSpyEnabled', true, true);
    await enabling;
    const pending = [
      core.setRemoteSpyEnabled(false),
      core.setRemoteSpyFilter('pending'),
      core.setRemoteSpyBlockList([]),
    ];
    core.rejectAllPending('Disconnected');
    expect(await Promise.all(pending)).toEqual([
      { 'success': false, 'error': 'Disconnected' },
      { 'success': false, 'error': 'Disconnected' },
      { 'success': false, 'error': 'Disconnected' },
    ]);
    expect(core.getRemoteSpyEnabled()).toBe(false);
  });
});

describe('Remote Spy - InvokeServer return capture', () => {
  const pendingCall: RemoteSpyCall = {
    'id': 'call-1',
    'remoteName': 'Query',
    'remotePath': ['ReplicatedStorage', 'Query'],
    'remoteType': 'RemoteFunction',
    'method': 'InvokeServer',
    'arguments': '',
    'code': 'remote:InvokeServer()',
    'timestamp': 1000,
    'returnStatus': 'pending',
  };

  test('remote function completion updates the correct invocation without duplicate rows', () => {
    const core = createBridgeCore(noop, () => true, noop);
    const second: RemoteSpyCall = { ...pendingCall, 'id': 'call-2' };

    core.handleMessage(JSON.stringify({ 'type': 'remoteSpy', 'call': pendingCall }));
    core.handleMessage(JSON.stringify({ 'type': 'remoteSpy', 'call': second }));
    core.handleMessage(
      JSON.stringify({
        'type': 'remoteSpy',
        'call': { ...second, 'returnStatus': 'returned', 'returns': 'nil, 7, nil', 'returnCount': 3 },
      }),
    );

    expect(core.getRemoteSpyCalls()).toHaveLength(2);
    expect(core.getRemoteSpyCalls()[0]?.returnStatus).toBe('pending');
    expect(core.getRemoteSpyCalls()[1]?.returns).toBe('nil, 7, nil');
    expect(core.getRemoteSpyCalls()[1]?.returnCount).toBe(3);
  });

  test('completion of an evicted pending call reaches subscribers without re-entering the buffer', () => {
    const core = createBridgeCore(noop, () => true, noop);
    const delivered: RemoteSpyCall[] = [];
    core.onRemoteSpy(call => delivered.push(call));
    const evicted: RemoteSpyCall = { ...pendingCall, 'id': 'evicted' };

    core.handleMessage(JSON.stringify({ 'type': 'remoteSpy', 'call': evicted }));
    for (let index = 0; index < 500; index += 1)
      core.handleMessage(JSON.stringify({ 'type': 'remoteSpy', 'call': { ...evicted, 'id': `call-${index}` } }));
    expect(core.getRemoteSpyCalls()).toHaveLength(500);
    expect(core.getRemoteSpyCalls().some(call => call.id === 'evicted')).toBe(false);

    delivered.length = 0;
    core.handleMessage(
      JSON.stringify({
        'type': 'remoteSpy',
        'call': { ...evicted, 'returnStatus': 'returned', 'returns': '42', 'returnCount': 1 },
      }),
    );

    expect(delivered).toHaveLength(1);
    expect(delivered[0]).toMatchObject({ 'id': 'evicted', 'returnStatus': 'returned', 'returns': '42' });
    expect(core.getRemoteSpyCalls()).toHaveLength(500);
    expect(core.getRemoteSpyCalls().some(call => call.id === 'evicted')).toBe(false);
  });
});

test('capture-source acknowledgements reject invalid modes and accept the supported modes', () => {
  const acknowledgement = (source: string): string =>
    JSON.stringify({
      'type': 'setRemoteSpyEnabledResult',
      'id': 'source-test',
      'success': true,
      'enabled': true,
      source,
    });

  for (const source of ['game', 'executor', 'both'])
    expect(parseClientMessage(acknowledgement(source))?.type).toBe('setRemoteSpyEnabledResult');

  expect(parseClientMessage(acknowledgement('invalid'))).toBeUndefined();
});
