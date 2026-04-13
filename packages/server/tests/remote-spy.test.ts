import { createBridgeCore } from '@executor/bridgeCore';
import { isSetRemoteSpyBlockListResultMessage, parseClientMessage } from '@executor/protocol';
import { describe, expect, test } from 'bun:test';

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
