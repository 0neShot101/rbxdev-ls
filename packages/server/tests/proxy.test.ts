import { createServer as createHttpServer, get as httpGet } from 'node:http';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { WebSocket } from 'ws';
import { createBridgeCore } from '@executor/bridgeCore';
import { parseClientMessage, parseProxyMessage, parseRemoteSpyPolicyMessage } from '@executor/protocol';
import { createProxyBridge } from '@executor/proxy';
import { createExecutorBridge } from '@executor/server';

import type { AddressInfo } from 'node:net';
import type { SpyExecutor } from '@tests/types/proxy';
import type { BridgeStatus, ExecutorBridge } from '@typings/bridge';
import type {
  ClientMessage,
  ExecuteMessage,
  ProxyMessage,
  RemoteSpyBlockEntry,
  RemoteSpyPolicyMessage,
  RequestPropertiesMessage,
  ServerMessage,
} from '@typings/protocol';

let nextPort = 44100;
const getPort = (): number => nextPort++;

const wait = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

const noop = (): void => {};

const waitFor = async (predicate: () => boolean, timeoutMs = 5000): Promise<void> => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) return;
    await wait(25);
  }

  throw new Error('Condition was not met before timeout');
};

/** Resolves with the rejection message of a promise, or undefined when it fulfils. */
const captureRejection = async (promise: Promise<unknown>): Promise<string | undefined> =>
  await promise.then(
    () => undefined,
    (cause: unknown) => String(cause),
  );

/** Distinguishes a bound TCP address from a pipe path or an unbound server. */
const isAddressInfo = (address: AddressInfo | string | null): address is AddressInfo =>
  typeof address === 'object' && address !== null;

const getAvailablePort = async (): Promise<number> =>
  await new Promise((resolve, reject) => {
    const server = createHttpServer();
    const cleanup = (): void => {
      server.off('error', onError);
      server.off('listening', onListening);
    };

    const onError = (error: Error): void => {
      cleanup();
      if (server.listening) {
        server.close(() => reject(error));
        return;
      }
      reject(error);
    };

    const onListening = (): void => {
      const address = server.address();
      if (!isAddressInfo(address)) {
        cleanup();
        server.close();
        reject(new Error('Failed to resolve ephemeral port'));
        return;
      }

      const port = address.port;
      server.close(error => {
        cleanup();
        if (error !== undefined) {
          reject(error);
          return;
        }
        resolve(port);
      });
    };

    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(0, '127.0.0.1');
  });

const getJson = async (port: number, path: string): Promise<{ statusCode: number; body: string }> =>
  await new Promise((resolve, reject) => {
    const request = httpGet(
      {
        'host': '127.0.0.1',
        port,
        path,
      },
      response => {
        const chunks: Buffer[] = [];
        response.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        response.on('end', () =>
          resolve({
            'statusCode': response.statusCode ?? 0,
            'body': Buffer.concat(chunks).toString('utf-8'),
          }),
        );
      },
    );

    request.on('error', reject);
  });

/** Decodes a frame received by a proxy socket: bridge-level proxy messages or forwarded client traffic. */
const decodeProxyFrame = (data: Buffer | string): ProxyMessage | ClientMessage | undefined =>
  parseProxyMessage(data.toString()) ?? parseClientMessage(data.toString());

/** Recognises the execute request a bridge forwards to an executor socket. */
const isExecuteFrame = (value: unknown): value is Pick<ExecuteMessage, 'type' | 'id' | 'code'> =>
  typeof value === 'object' &&
  value !== null &&
  'type' in value &&
  value.type === 'execute' &&
  'id' in value &&
  typeof value.id === 'string' &&
  'code' in value &&
  typeof value.code === 'string';

/** Recognises the properties request a bridge forwards to an executor socket. */
const isRequestPropertiesFrame = (value: unknown): value is Pick<RequestPropertiesMessage, 'type' | 'id'> =>
  typeof value === 'object' &&
  value !== null &&
  'type' in value &&
  value.type === 'requestProperties' &&
  'id' in value &&
  typeof value.id === 'string';

/** Decodes a request frame received by a fake executor socket; undefined for other server messages. */
const decodeExecutorFrame = (
  data: Buffer | string,
): Pick<ExecuteMessage, 'type' | 'id' | 'code'> | Pick<RequestPropertiesMessage, 'type' | 'id'> | undefined => {
  const value: unknown = JSON.parse(data.toString());
  if (isExecuteFrame(value) || isRequestPropertiesFrame(value)) return value;
  return undefined;
};

const openExecutor = async (port: number, name: string): Promise<WebSocket> => {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  await new Promise<void>(resolve => ws.on('open', resolve));
  ws.send(JSON.stringify({ 'type': 'connected', 'executorName': name, 'version': '1.0' }));
  return ws;
};

describe('BridgeCore', () => {
  test('initial status is stopped', () => {
    const core = createBridgeCore(noop, () => false, noop);
    expect(core.getStatus()).toBe('stopped');
  });

  test('initial executor name is undefined', () => {
    const core = createBridgeCore(noop, () => false, noop);
    expect(core.getExecutorName()).toBeUndefined();
  });

  test('setStatus changes status and fires callback', () => {
    const core = createBridgeCore(noop, () => false, noop);
    const statuses: BridgeStatus[] = [];
    core.onStatusChange(s => statuses.push(s));

    core.setStatus('waiting');
    expect(core.getStatus()).toBe('waiting');
    expect(statuses).toEqual(['waiting']);
  });

  test('setStatus does not fire callback for same status', () => {
    const core = createBridgeCore(noop, () => false, noop);
    const statuses: BridgeStatus[] = [];
    core.onStatusChange(s => statuses.push(s));

    core.setStatus('waiting');
    core.setStatus('waiting');
    expect(statuses).toEqual(['waiting']);
  });

  test('setExecutorName updates executor name', () => {
    const core = createBridgeCore(noop, () => false, noop);
    core.setExecutorName('TestExecutor');
    expect(core.getExecutorName()).toBe('TestExecutor');
  });

  test('setConnected updates live game model', () => {
    const core = createBridgeCore(noop, () => false, noop);
    core.setConnected(true);
    expect(core.liveGameModel.isConnected).toBe(true);
    core.setConnected(false);
    expect(core.liveGameModel.isConnected).toBe(false);
  });

  test('handleMessage processes connected message', () => {
    const core = createBridgeCore(noop, () => true, noop);
    const statuses: BridgeStatus[] = [];
    core.onStatusChange(s => statuses.push(s));

    core.handleMessage(
      JSON.stringify({
        'type': 'connected',
        'executorName': 'MyExec',
        'version': '1.0',
      }),
    );

    expect(core.getExecutorName()).toBe('MyExec');
    expect(core.getStatus()).toBe('connected');
    expect(statuses).toContain('connected');
  });

  test('handleMessage processes gameTree message', () => {
    const core = createBridgeCore(noop, () => true, noop);
    const trees: unknown[] = [];
    core.onGameTreeUpdate(nodes => trees.push(nodes));

    core.handleMessage(
      JSON.stringify({
        'type': 'gameTree',
        'data': [{ 'name': 'Workspace', 'className': 'Workspace' }],
      }),
    );

    expect(trees.length).toBe(1);
    expect(core.liveGameModel.services.has('Workspace')).toBe(true);
  });

  test('handleMessage processes runtimeError message', () => {
    const core = createBridgeCore(noop, () => true, noop);
    const errors: unknown[] = [];
    core.onRuntimeError(err => errors.push(err));

    core.handleMessage(
      JSON.stringify({
        'type': 'runtimeError',
        'error': { 'message': 'test error' },
      }),
    );

    expect(errors.length).toBe(1);
  });

  test('handleMessage processes log message', () => {
    const core = createBridgeCore(noop, () => true, noop);
    const logs: unknown[] = [];
    core.onLog(entry => logs.push(entry));

    core.handleMessage(
      JSON.stringify({
        'type': 'log',
        'level': 'info',
        'message': 'hello',
        'timestamp': Date.now(),
      }),
    );

    expect(logs.length).toBe(1);
  });

  test('handleMessage ignores invalid messages', () => {
    const logMessages: string[] = [];
    const core = createBridgeCore(
      noop,
      () => true,
      message => void logMessages.push(message),
    );

    core.handleMessage('not json {{{');
    core.handleMessage(JSON.stringify({ 'type': 'unknownType' }));
    core.handleMessage(JSON.stringify({ 'no': 'type field' }));

    expect(logMessages.some(m => m.includes('invalid'))).toBe(true);
  });

  test('handleMessage resolves execute result', async () => {
    const sent: ServerMessage[] = [];
    const core = createBridgeCore(
      message => void sent.push(message),
      () => true,
      noop,
    );

    core.setExecutorName('Exec');
    core.setStatus('connected');

    const promise = core.execute('print("hi")');

    expect(sent.length).toBe(1);
    const sentMessage = sent[0];
    if (sentMessage?.type !== 'execute') throw new Error('expected execute message');

    core.handleMessage(
      JSON.stringify({
        'type': 'executeResult',
        'id': sentMessage.id,
        'success': true,
        'result': 'hi',
      }),
    );

    const result = await promise;
    expect(result.success).toBe(true);
    expect(result.result).toBe('hi');
  });

  test('execute rejects when not ready', async () => {
    const core = createBridgeCore(noop, () => false, noop);
    expect(await captureRejection(core.execute('test'))).toContain('No executor connected');
  });

  test('execute rejects when no executor name', async () => {
    const core = createBridgeCore(noop, () => true, noop);
    expect(await captureRejection(core.execute('test'))).toContain('handshake not completed');
  });

  test('rejectAllPending rejects pending executions', async () => {
    const core = createBridgeCore(noop, () => true, noop);
    core.setExecutorName('Exec');

    const promise = core.execute('test');
    core.rejectAllPending('disconnected');

    expect(await captureRejection(promise)).toContain('disconnected');
  });

  test('requestGameTree sends message', () => {
    const sent: ServerMessage[] = [];
    const core = createBridgeCore(
      message => void sent.push(message),
      () => true,
      noop,
    );

    core.requestGameTree();
    expect(sent).toEqual([{ 'type': 'requestGameTree' }]);
  });

  test('handleMessage resolves properties result', async () => {
    const sent: ServerMessage[] = [];
    const core = createBridgeCore(
      message => void sent.push(message),
      () => true,
      noop,
    );
    core.setExecutorName('Exec');

    const promise = core.requestProperties(['Workspace', 'Part']);
    const sentMessage = sent[0];
    if (sentMessage?.type !== 'requestProperties') throw new Error('expected requestProperties message');

    core.handleMessage(
      JSON.stringify({
        'type': 'propertiesResult',
        'id': sentMessage.id,
        'success': true,
        'properties': [{ 'name': 'Name', 'valueType': 'string', 'value': 'Part' }],
      }),
    );

    const result = await promise;
    expect(result.success).toBe(true);
    expect(result.properties?.length).toBe(1);
  });

  test('remote spy tracking', () => {
    const core = createBridgeCore(noop, () => true, noop);
    const calls: unknown[] = [];
    core.onRemoteSpy(call => calls.push(call));

    expect(core.getRemoteSpyEnabled()).toBe(false);
    expect(core.getRemoteSpyCalls().length).toBe(0);

    core.handleMessage(
      JSON.stringify({
        'type': 'remoteSpy',
        'call': {
          'remoteName': 'TestRemote',
          'remotePath': ['ReplicatedStorage', 'TestRemote'],
          'remoteType': 'RemoteEvent',
          'method': 'FireServer',
          'arguments': '()',
          'code': 'game.ReplicatedStorage.TestRemote:FireServer()',
          'timestamp': Date.now(),
        },
      }),
    );

    expect(calls.length).toBe(1);
    expect(core.getRemoteSpyCalls().length).toBe(1);
  });
});

describe('ExecutorBridge - Proxy Support', () => {
  let bridge: ExecutorBridge;
  let port: number;

  beforeEach(() => {
    port = getPort();
    bridge = createExecutorBridge(noop);
    bridge.start(port);
  });

  afterEach(() => bridge.stop());

  test('bridge starts in waiting state', () => {
    expect(bridge.isRunning).toBe(true);
    expect(bridge.isConnected).toBe(false);
  });

  test('bridge serves health endpoint on the bridge port', async () => {
    const healthPort = await getAvailablePort();
    const healthLogs: string[] = [];
    const healthBridge = createExecutorBridge(message => void healthLogs.push(message));
    healthBridge.start(healthPort);

    try {
      await waitFor(() => healthLogs.some(log => log.includes(`WebSocket server started on port ${healthPort}`)));
      const response = await getJson(healthPort, '/health');
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ 'ok': true, 'connected': false });
    } finally {
      healthBridge.stop();
    }
  });

  test('bridge can restart quickly on the same port', async () => {
    bridge.stop();
    bridge.start(port);
    await waitFor(() => bridge.isRunning === true);

    expect(bridge.isRunning).toBe(true);
  });

  test('bridge accepts executor connection', async () => {
    const statuses: BridgeStatus[] = [];
    bridge.onStatusChange(s => statuses.push(s));

    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise<void>(resolve => ws.on('open', resolve));

    ws.send(
      JSON.stringify({
        'type': 'connected',
        'executorName': 'TestExec',
        'version': '1.0',
      }),
    );

    await wait(100);
    expect(bridge.isConnected).toBe(true);
    expect(bridge.executorName).toBe('TestExec');
    expect(statuses).toContain('connected');

    ws.close();
    await wait(100);
  });

  test('bridge identifies proxy via handshake', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise<void>(resolve => ws.on('open', resolve));

    const messages: Array<ProxyMessage | ClientMessage | undefined> = [];
    ws.on('message', (data: Buffer | string) => void messages.push(decodeProxyFrame(data)));

    ws.send(JSON.stringify({ 'type': 'proxyHandshake' }));
    await wait(100);

    expect(messages.length).toBe(1);
    expect(messages[0]).toMatchObject({ 'type': 'proxyWelcome', 'isConnected': false });

    ws.close();
    await wait(50);
  });

  test('proxy welcome includes executor state when connected', async () => {
    const executor = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise<void>(resolve => executor.on('open', resolve));
    executor.send(
      JSON.stringify({
        'type': 'connected',
        'executorName': 'MyExec',
        'version': '1.0',
      }),
    );
    await wait(100);

    const proxy = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise<void>(resolve => proxy.on('open', resolve));

    const messages: Array<ProxyMessage | ClientMessage | undefined> = [];
    proxy.on('message', (data: Buffer | string) => void messages.push(decodeProxyFrame(data)));

    proxy.send(JSON.stringify({ 'type': 'proxyHandshake' }));
    await wait(100);

    expect(messages.length).toBe(1);
    expect(messages[0]).toMatchObject({ 'type': 'proxyWelcome', 'isConnected': true, 'executorName': 'MyExec' });

    proxy.close();
    executor.close();
    await wait(50);
  });

  test('proxy receives executor responses', async () => {
    const executor = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise<void>(resolve => executor.on('open', resolve));
    executor.send(
      JSON.stringify({
        'type': 'connected',
        'executorName': 'TestExec',
        'version': '1.0',
      }),
    );
    await wait(100);

    const proxy = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise<void>(resolve => proxy.on('open', resolve));

    const proxyMessages: Array<ProxyMessage | ClientMessage | undefined> = [];
    proxy.on('message', (data: Buffer | string) => void proxyMessages.push(decodeProxyFrame(data)));

    proxy.send(JSON.stringify({ 'type': 'proxyHandshake' }));
    await wait(100);
    proxyMessages.length = 0;

    executor.send(
      JSON.stringify({
        'type': 'gameTree',
        'data': [{ 'name': 'Workspace', 'className': 'Workspace' }],
      }),
    );
    await wait(100);

    expect(proxyMessages.length).toBe(1);
    expect(proxyMessages[0]?.type).toBe('gameTree');

    proxy.close();
    executor.close();
    await wait(50);
  });

  test('proxy commands are forwarded to executor', async () => {
    const executor = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise<void>(resolve => executor.on('open', resolve));

    const executorReceived: Array<ReturnType<typeof decodeExecutorFrame>> = [];
    executor.on('message', () => {});
    executor.send(
      JSON.stringify({
        'type': 'connected',
        'executorName': 'TestExec',
        'version': '1.0',
      }),
    );
    await wait(100);

    executor.on('message', (data: Buffer | string) => void executorReceived.push(decodeExecutorFrame(data)));

    const proxy = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise<void>(resolve => proxy.on('open', resolve));
    proxy.send(JSON.stringify({ 'type': 'proxyHandshake' }));
    await wait(100);

    proxy.send(
      JSON.stringify({
        'type': 'execute',
        'id': 'test-id-1',
        'code': 'print("hello")',
      }),
    );
    await wait(100);

    expect(executorReceived.length).toBe(1);
    expect(executorReceived[0]).toEqual({ 'type': 'execute', 'id': 'test-id-1', 'code': 'print("hello")' });

    proxy.close();
    executor.close();
    await wait(50);
  });

  test('proxy receives status change on executor disconnect', async () => {
    const executor = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise<void>(resolve => executor.on('open', resolve));
    executor.send(
      JSON.stringify({
        'type': 'connected',
        'executorName': 'TestExec',
        'version': '1.0',
      }),
    );
    await wait(100);

    const proxy = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise<void>(resolve => proxy.on('open', resolve));

    const proxyMessages: Array<ProxyMessage | ClientMessage | undefined> = [];
    proxy.on('message', (data: Buffer | string) => void proxyMessages.push(decodeProxyFrame(data)));

    proxy.send(JSON.stringify({ 'type': 'proxyHandshake' }));
    await wait(100);
    proxyMessages.length = 0;

    executor.close();
    await wait(200);

    const statusChange = proxyMessages.find(message => message?.type === 'proxyStatusChange');
    expect(statusChange).toMatchObject({ 'status': 'disconnected' });

    proxy.close();
    await wait(50);
  });

  test('proxy receives status change on new executor connect', async () => {
    const proxy = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise<void>(resolve => proxy.on('open', resolve));

    const proxyMessages: Array<ProxyMessage | ClientMessage | undefined> = [];
    proxy.on('message', (data: Buffer | string) => void proxyMessages.push(decodeProxyFrame(data)));

    proxy.send(JSON.stringify({ 'type': 'proxyHandshake' }));
    await wait(100);
    proxyMessages.length = 0;

    const executor = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise<void>(resolve => executor.on('open', resolve));
    executor.send(
      JSON.stringify({
        'type': 'connected',
        'executorName': 'NewExec',
        'version': '2.0',
      }),
    );
    await wait(100);

    const connected = proxyMessages.find(message => message?.type === 'proxyStatusChange');
    expect(connected).toMatchObject({ 'status': 'connected', 'executorName': 'NewExec' });

    proxy.close();
    executor.close();
    await wait(50);
  });

  test('multiple proxy clients receive broadcasts', async () => {
    const executor = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise<void>(resolve => executor.on('open', resolve));
    executor.send(
      JSON.stringify({
        'type': 'connected',
        'executorName': 'TestExec',
        'version': '1.0',
      }),
    );
    await wait(100);

    const proxy1 = new WebSocket(`ws://127.0.0.1:${port}`);
    const proxy2 = new WebSocket(`ws://127.0.0.1:${port}`);
    await Promise.all([
      new Promise<void>(resolve => proxy1.on('open', resolve)),
      new Promise<void>(resolve => proxy2.on('open', resolve)),
    ]);

    const messages1: Array<ProxyMessage | ClientMessage | undefined> = [];
    const messages2: Array<ProxyMessage | ClientMessage | undefined> = [];
    proxy1.on('message', (data: Buffer | string) => void messages1.push(decodeProxyFrame(data)));
    proxy2.on('message', (data: Buffer | string) => void messages2.push(decodeProxyFrame(data)));

    proxy1.send(JSON.stringify({ 'type': 'proxyHandshake' }));
    proxy2.send(JSON.stringify({ 'type': 'proxyHandshake' }));
    await wait(100);
    messages1.length = 0;
    messages2.length = 0;

    executor.send(
      JSON.stringify({
        'type': 'gameTree',
        'data': [{ 'name': 'Workspace', 'className': 'Workspace' }],
      }),
    );
    await wait(100);

    expect(messages1.length).toBeGreaterThanOrEqual(1);
    expect(messages2.length).toBeGreaterThanOrEqual(1);
    expect(messages1[0]?.type).toBe('gameTree');
    expect(messages2[0]?.type).toBe('gameTree');

    proxy1.close();
    proxy2.close();
    executor.close();
    await wait(50);
  });

  test('bridge stop closes proxy clients', async () => {
    const proxy = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise<void>(resolve => proxy.on('open', resolve));
    proxy.send(JSON.stringify({ 'type': 'proxyHandshake' }));
    await wait(100);

    let proxyClosed = false;
    proxy.on('close', () => void (proxyClosed = true));

    bridge.stop();
    await wait(200);

    expect(proxyClosed).toBe(true);
  });
});

describe('ProxyBridge', () => {
  let server: ExecutorBridge;
  let proxy: ExecutorBridge;
  let port: number;

  beforeEach(() => {
    port = getPort();
    server = createExecutorBridge(noop);
    server.start(port);
  });

  afterEach(() => {
    if (proxy !== undefined) proxy.stop();
    server.stop();
  });

  test('proxy connects to bridge server', async () => {
    proxy = createProxyBridge(noop);
    proxy.start(port);
    await wait(200);

    expect(proxy.isRunning).toBe(true);
  });

  test('proxy reports not connected when no executor', async () => {
    proxy = createProxyBridge(noop);
    proxy.start(port);
    await wait(200);

    expect(proxy.isConnected).toBe(false);
  });

  test('proxy detects executor already connected', async () => {
    const executor = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise<void>(resolve => executor.on('open', resolve));
    executor.send(
      JSON.stringify({
        'type': 'connected',
        'executorName': 'PreExec',
        'version': '1.0',
      }),
    );
    await wait(100);

    proxy = createProxyBridge(noop);
    const statuses: BridgeStatus[] = [];
    proxy.onStatusChange(s => statuses.push(s));
    proxy.start(port);
    await wait(200);

    expect(proxy.isConnected).toBe(true);
    expect(proxy.executorName).toBe('PreExec');
    expect(statuses).toContain('connected');

    executor.close();
    await wait(100);
  });

  test('proxy transitions to connected when executor joins', async () => {
    proxy = createProxyBridge(noop);
    proxy.start(port);
    await wait(200);

    expect(proxy.isConnected).toBe(false);

    const executor = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise<void>(resolve => executor.on('open', resolve));
    executor.send(
      JSON.stringify({
        'type': 'connected',
        'executorName': 'LateExec',
        'version': '1.0',
      }),
    );
    await wait(200);

    expect(proxy.isConnected).toBe(true);
    expect(proxy.executorName).toBe('LateExec');

    executor.close();
    await wait(100);
  });

  test('proxy transitions to disconnected when executor leaves', async () => {
    const executor = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise<void>(resolve => executor.on('open', resolve));
    executor.send(
      JSON.stringify({
        'type': 'connected',
        'executorName': 'TempExec',
        'version': '1.0',
      }),
    );
    await wait(100);

    proxy = createProxyBridge(noop);
    proxy.start(port);
    await wait(200);
    expect(proxy.isConnected).toBe(true);

    executor.close();
    await wait(300);

    expect(proxy.isConnected).toBe(false);
  });

  test('proxy can execute code through bridge server', async () => {
    const executor = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise<void>(resolve => executor.on('open', resolve));

    executor.on('message', (data: Buffer | string) => {
      const frame = decodeExecutorFrame(data);
      if (frame?.type === 'execute')
        executor.send(
          JSON.stringify({
            'type': 'executeResult',
            'id': frame.id,
            'success': true,
            'result': 'executed!',
          }),
        );
    });

    executor.send(
      JSON.stringify({
        'type': 'connected',
        'executorName': 'ExecRunner',
        'version': '1.0',
      }),
    );
    await wait(100);

    proxy = createProxyBridge(noop);
    proxy.start(port);
    await wait(200);

    const result = await proxy.execute('print("hello")');
    expect(result.success).toBe(true);
    expect(result.result).toBe('executed!');

    executor.close();
    await wait(100);
  });

  test('proxy can request properties through bridge server', async () => {
    const executor = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise<void>(resolve => executor.on('open', resolve));

    executor.on('message', (data: Buffer | string) => {
      const frame = decodeExecutorFrame(data);
      if (frame?.type === 'requestProperties')
        executor.send(
          JSON.stringify({
            'type': 'propertiesResult',
            'id': frame.id,
            'success': true,
            'properties': [{ 'name': 'Name', 'valueType': 'string', 'value': 'TestPart' }],
          }),
        );
    });

    executor.send(
      JSON.stringify({
        'type': 'connected',
        'executorName': 'PropExec',
        'version': '1.0',
      }),
    );
    await wait(100);

    proxy = createProxyBridge(noop);
    proxy.start(port);
    await wait(200);

    const result = await proxy.requestProperties(['Workspace', 'Part']);
    expect(result.success).toBe(true);
    expect(result.properties?.[0]?.name).toBe('Name');

    executor.close();
    await wait(100);
  });

  test('proxy receives game tree updates', async () => {
    const executor = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise<void>(resolve => executor.on('open', resolve));
    executor.send(
      JSON.stringify({
        'type': 'connected',
        'executorName': 'TreeExec',
        'version': '1.0',
      }),
    );
    await wait(100);

    proxy = createProxyBridge(noop);
    proxy.start(port);
    await wait(200);

    const trees: unknown[] = [];
    proxy.onGameTreeUpdate(nodes => trees.push(nodes));

    executor.send(
      JSON.stringify({
        'type': 'gameTree',
        'data': [
          { 'name': 'Workspace', 'className': 'Workspace' },
          { 'name': 'Players', 'className': 'Players' },
        ],
      }),
    );
    await wait(200);

    expect(trees.length).toBe(1);
    expect(proxy.liveGameModel.services.size).toBe(2);
    expect(proxy.liveGameModel.services.has('Workspace')).toBe(true);

    executor.close();
    await wait(100);
  });

  test('proxy receives log messages', async () => {
    const executor = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise<void>(resolve => executor.on('open', resolve));
    executor.send(
      JSON.stringify({
        'type': 'connected',
        'executorName': 'LogExec',
        'version': '1.0',
      }),
    );
    await wait(100);

    proxy = createProxyBridge(noop);
    proxy.start(port);
    await wait(200);

    const logs: unknown[] = [];
    proxy.onLog(entry => logs.push(entry));

    executor.send(
      JSON.stringify({
        'type': 'log',
        'level': 'info',
        'message': 'test log message',
        'timestamp': Date.now(),
      }),
    );
    await wait(200);

    expect(logs.length).toBe(1);

    executor.close();
    await wait(100);
  });

  test('proxy stop cleans up connection', async () => {
    proxy = createProxyBridge(noop);
    proxy.start(port);
    await wait(200);

    proxy.stop();
    await wait(100);

    expect(proxy.isRunning).toBe(false);
    expect(proxy.isConnected).toBe(false);
  });

  test('proxy rejects pending requests when executor disconnects', async () => {
    const executor = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise<void>(resolve => executor.on('open', resolve));
    executor.send(
      JSON.stringify({
        'type': 'connected',
        'executorName': 'DiscoExec',
        'version': '1.0',
      }),
    );
    await wait(100);

    proxy = createProxyBridge(noop);
    proxy.start(port);
    await wait(200);

    let rejected = false;
    const executePromise = proxy.execute('print("test")').catch(() => void (rejected = true));
    await wait(50);

    executor.close();
    await wait(300);
    await executePromise;

    expect(rejected).toBe(true);
  });
});

describe('ProxyBridge - Standalone', () => {
  test('proxy is not connected when server is unavailable', () => {
    const proxy = createProxyBridge(noop);
    expect(proxy.isRunning).toBe(false);
    expect(proxy.isConnected).toBe(false);
  });

  test('proxy starts with isRunning true', () => {
    const unusedPort = getPort();
    const proxy = createProxyBridge(noop);
    proxy.start(unusedPort);
    expect(proxy.isRunning).toBe(true);
    proxy.stop();
  });

  test('proxy liveGameModel starts empty', () => {
    const proxy = createProxyBridge(noop);
    expect(proxy.liveGameModel.isConnected).toBe(false);
    expect(proxy.liveGameModel.services.size).toBe(0);
  });

  test('proxy remoteSpyCalls starts empty', () => {
    const proxy = createProxyBridge(noop);
    expect(proxy.remoteSpyCalls.length).toBe(0);
    expect(proxy.isRemoteSpyEnabled).toBe(false);
  });
});

describe('ExecutorBridge - EADDRINUSE auto-fallback', () => {
  let ownerBridge: ExecutorBridge;
  let port: number;

  beforeEach(() => {
    port = getPort();
    ownerBridge = createExecutorBridge(noop);
    ownerBridge.start(port);
  });

  afterEach(() => ownerBridge.stop());

  test('second bridge falls back to proxy mode on same port', async () => {
    const secondBridge = createExecutorBridge(noop);
    secondBridge.start(port);
    await wait(300);

    expect(secondBridge.isRunning).toBe(true);

    secondBridge.stop();
  });

  test('fallback bridge detects executor connected through owner', async () => {
    const executor = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise<void>(resolve => executor.on('open', resolve));
    executor.send(
      JSON.stringify({
        'type': 'connected',
        'executorName': 'FallbackExec',
        'version': '1.0',
      }),
    );
    await wait(100);

    const secondBridge = createExecutorBridge(noop);
    secondBridge.start(port);
    await wait(300);

    expect(secondBridge.isConnected).toBe(true);
    expect(secondBridge.executorName).toBe('FallbackExec');

    secondBridge.stop();
    executor.close();
    await wait(100);
  });

  test('fallback bridge can execute code through owner', async () => {
    const executor = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise<void>(resolve => executor.on('open', resolve));

    executor.on('message', (data: Buffer | string) => {
      const frame = decodeExecutorFrame(data);
      if (frame?.type === 'execute')
        executor.send(
          JSON.stringify({
            'type': 'executeResult',
            'id': frame.id,
            'success': true,
            'result': 'fallback works!',
          }),
        );
    });

    executor.send(
      JSON.stringify({
        'type': 'connected',
        'executorName': 'FallbackRunner',
        'version': '1.0',
      }),
    );
    await wait(100);

    const secondBridge = createExecutorBridge(noop);
    secondBridge.start(port);
    await wait(300);

    const result = await secondBridge.execute('print("test")');
    expect(result.success).toBe(true);
    expect(result.result).toBe('fallback works!');

    secondBridge.stop();
    executor.close();
    await wait(100);
  });

  test('fallback bridge receives game tree updates', async () => {
    const executor = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise<void>(resolve => executor.on('open', resolve));
    executor.send(
      JSON.stringify({
        'type': 'connected',
        'executorName': 'TreeFallback',
        'version': '1.0',
      }),
    );
    await wait(100);

    const secondBridge = createExecutorBridge(noop);
    secondBridge.start(port);
    await wait(300);

    const trees: unknown[] = [];
    secondBridge.onGameTreeUpdate(nodes => trees.push(nodes));

    executor.send(
      JSON.stringify({
        'type': 'gameTree',
        'data': [{ 'name': 'Workspace', 'className': 'Workspace' }],
      }),
    );
    await wait(200);

    expect(trees.length).toBe(1);
    expect(secondBridge.liveGameModel.services.has('Workspace')).toBe(true);

    secondBridge.stop();
    executor.close();
    await wait(100);
  });

  test('fallback bridge stop cleans up properly', async () => {
    const secondBridge = createExecutorBridge(noop);
    secondBridge.start(port);
    await wait(300);

    secondBridge.stop();
    expect(secondBridge.isRunning).toBe(false);
    expect(secondBridge.isConnected).toBe(false);
  });
});

describe('ExecutorBridge - protocol robustness', () => {
  let bridge: ExecutorBridge;
  let port: number;
  let logs: string[];

  beforeEach(() => {
    port = getPort();
    logs = [];
    bridge = createExecutorBridge(message => void logs.push(message));
    bridge.start(port);
  });

  afterEach(() => bridge.stop());

  test('malformed frames do not crash or drop the connection', async () => {
    const executor = await openExecutor(port, 'GarbageExec');
    await waitFor(() => bridge.isConnected === true);

    executor.on('message', (data: Buffer | string) => {
      const frame = decodeExecutorFrame(data);
      if (frame?.type === 'execute')
        executor.send(
          JSON.stringify({ 'type': 'executeResult', 'id': frame.id, 'success': true, 'result': 'still alive' }),
        );
    });

    executor.send('{not json');
    executor.send('42');
    executor.send(JSON.stringify({ 'noType': true }));
    executor.send(JSON.stringify({ 'type': 'unknownType', 'id': 'x' }));

    await waitFor(() => logs.filter(m => m.includes('invalid message')).length >= 4);

    expect(bridge.isConnected).toBe(true);
    expect(bridge.executorName).toBe('GarbageExec');

    const result = await bridge.execute('print("ping")');
    expect(result.success).toBe(true);
    expect(result.result).toBe('still alive');

    executor.close();
    await waitFor(() => bridge.isConnected === false);
  });

  test('execute rejects when executor disconnects mid-request', async () => {
    const executor = await openExecutor(port, 'DropExec');
    await waitFor(() => bridge.isConnected === true);

    executor.on('message', (data: Buffer | string) => {
      const frame = decodeExecutorFrame(data);
      if (frame?.type === 'execute') executor.close();
    });

    expect(await captureRejection(bridge.execute('while true do end'))).toContain('Client disconnected');

    await waitFor(() => bridge.isConnected === false);
  });

  test('mismatched result id does not resolve the pending request', async () => {
    const executor = await openExecutor(port, 'MismatchExec');
    await waitFor(() => bridge.isConnected === true);

    executor.on('message', (data: Buffer | string) => {
      const frame = decodeExecutorFrame(data);
      if (frame?.type !== 'execute') return;
      executor.send(
        JSON.stringify({ 'type': 'executeResult', 'id': `${frame.id}-wrong`, 'success': true, 'result': 'stray' }),
      );
      setTimeout(
        () =>
          executor.send(
            JSON.stringify({ 'type': 'executeResult', 'id': frame.id, 'success': true, 'result': 'matched' }),
          ),
        50,
      );
    });

    const result = await bridge.execute('print("id")');
    expect(result.result).toBe('matched');
    expect(bridge.isConnected).toBe(true);

    executor.close();
    await waitFor(() => bridge.isConnected === false);
  });

  test('second executor connection replaces the first', async () => {
    const first = await openExecutor(port, 'FirstExec');
    await waitFor(() => bridge.executorName === 'FirstExec');

    const firstClose = new Promise<{ code: number; reason: string }>(resolve =>
      first.once('close', (code: number, reason: Buffer) => resolve({ code, 'reason': reason.toString('utf-8') })),
    );

    const second = await openExecutor(port, 'SecondExec');
    const closeInfo = await firstClose;
    await waitFor(() => bridge.executorName === 'SecondExec');

    expect(closeInfo.code).toBe(1000);
    expect(closeInfo.reason).toBe('Replaced by new connection');
    expect(bridge.isConnected).toBe(true);

    second.on('message', (data: Buffer | string) => {
      const frame = decodeExecutorFrame(data);
      if (frame?.type === 'execute')
        second.send(
          JSON.stringify({ 'type': 'executeResult', 'id': frame.id, 'success': true, 'result': 'routed to second' }),
        );
    });

    const result = await bridge.execute('print("route")');
    expect(result.result).toBe('routed to second');

    second.close();
    await waitFor(() => bridge.isConnected === false);
  });

  test('odd result payload types resolve without throwing', async () => {
    const executor = await openExecutor(port, 'OddExec');
    await waitFor(() => bridge.isConnected === true);

    let replyResult: number | { nested: boolean; list: number[] } = 12345;
    executor.on('message', (data: Buffer | string) => {
      const frame = decodeExecutorFrame(data);
      if (frame?.type === 'execute')
        executor.send(
          JSON.stringify({ 'type': 'executeResult', 'id': frame.id, 'success': true, 'result': replyResult }),
        );
    });

    const numberResult = await bridge.execute('return 1');
    expect(numberResult.success).toBe(true);
    expect(numberResult.result).toBe('12345');

    replyResult = { 'nested': true, 'list': [1, 2, 3] };
    const objectResult = await bridge.execute('return {}');
    expect(objectResult.success).toBe(true);
    expect(objectResult.result).toBe('{"nested":true,"list":[1,2,3]}');

    executor.close();
    await waitFor(() => bridge.isConnected === false);
  });
});

describe('Remote Spy - shared policy across primary and proxies', () => {
  let port: number;
  let bridges: ExecutorBridge[];
  let sockets: WebSocket[];

  beforeEach(async () => {
    port = await getAvailablePort();
    bridges = [];
    sockets = [];
  });

  afterEach(() => {
    for (const socket of sockets) socket.close();
    for (const bridge of bridges.reverse()) bridge.stop();
  });

  const track = (bridge: ExecutorBridge): ExecutorBridge => {
    bridges.push(bridge);
    bridge.start(port);
    return bridge;
  };

  /** Fake executor that acknowledges spy policy like the Luau module, rejecting the filter named `Rejected`. */
  const openSpyExecutor = async (): Promise<SpyExecutor> => {
    const received: RemoteSpyPolicyMessage[] = [];
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    sockets.push(ws);
    ws.on('message', (data: Buffer | string) => {
      const request = parseRemoteSpyPolicyMessage(data.toString());
      if (request === undefined) return;
      received.push(request);
      if (request.type === 'setRemoteSpyEnabled')
        return ws.send(
          JSON.stringify({
            'type': 'setRemoteSpyEnabledResult',
            'id': request.id,
            'success': true,
            'enabled': request.enabled,
            'source': request.source ?? 'game',
          }),
        );
      const rejected = request.type === 'setRemoteSpyFilter' && request.filter === 'Rejected';
      return ws.send(JSON.stringify({ 'type': `${request.type}Result`, 'id': request.id, 'success': !rejected }));
    });
    const { promise, resolve } = Promise.withResolvers<void>();
    ws.on('open', resolve);
    await promise;
    const handshake = (): void =>
      ws.send(JSON.stringify({ 'type': 'connected', 'executorName': 'SpyExec', 'version': '1.0' }));
    handshake();
    return { received, 'reload': handshake };
  };

  const reloadAndSettle = async (executor: SpyExecutor): Promise<void> => {
    executor.received.length = 0;
    executor.reload();
    await waitFor(() => executor.received.some(request => request.type === 'setRemoteSpyEnabled'));
    /** Leave room for any competing replay a proxy might still send. */
    await wait(200);
  };

  test('a passive proxy cannot disable active capture or clear rules on reload', async () => {
    const primary = track(createExecutorBridge(noop));
    await wait(100);
    const passive = track(createExecutorBridge(noop));
    await wait(300);
    const executor = await openSpyExecutor();
    await waitFor(() => primary.isConnected && passive.isConnected);

    expect((await primary.setRemoteSpyFilter('Chat')).success).toBe(true);
    expect((await primary.setRemoteSpyBlockList([{ 'type': 'name', 'value': 'Blocked' }])).success).toBe(true);
    expect(await primary.setRemoteSpyEnabled(true, 'both')).toMatchObject({ 'success': true, 'source': 'both' });
    await waitFor(() => passive.isRemoteSpyEnabled);

    await reloadAndSettle(executor);

    expect(executor.received).toHaveLength(3);
    expect(executor.received).toMatchObject([
      { 'type': 'setRemoteSpyFilter', 'filter': 'Chat' },
      { 'type': 'setRemoteSpyBlockList', 'blocks': [{ 'type': 'name', 'value': 'Blocked' }] },
      { 'type': 'setRemoteSpyEnabled', 'enabled': true, 'source': 'both' },
    ]);
    await waitFor(() => primary.isRemoteSpyEnabled && passive.isRemoteSpyEnabled);
  });

  test('proxy-selected acknowledged source and rules are restored after reload', async () => {
    const primary = track(createExecutorBridge(noop));
    await wait(100);
    const proxy = track(createProxyBridge(noop));
    await wait(200);
    const executor = await openSpyExecutor();
    await waitFor(() => primary.isConnected && proxy.isConnected);

    const blocks: RemoteSpyBlockEntry[] = [{ 'type': 'path', 'value': 'ReplicatedStorage.Spam' }];
    expect((await proxy.setRemoteSpyFilter('Chat')).success).toBe(true);
    expect((await proxy.setRemoteSpyBlockList(blocks)).success).toBe(true);
    expect(await proxy.setRemoteSpyEnabled(true, 'executor')).toMatchObject({ 'success': true, 'source': 'executor' });
    expect((await proxy.setRemoteSpyFilter('Rejected')).success).toBe(false);
    await waitFor(() => primary.isRemoteSpyEnabled);

    await reloadAndSettle(executor);

    expect(executor.received).toHaveLength(3);
    expect(executor.received).toMatchObject([
      { 'type': 'setRemoteSpyFilter', 'filter': 'Chat' },
      { 'type': 'setRemoteSpyBlockList', blocks },
      { 'type': 'setRemoteSpyEnabled', 'enabled': true, 'source': 'executor' },
    ]);
    await waitFor(() => primary.isRemoteSpyEnabled && proxy.isRemoteSpyEnabled);
  });
});

describe('MCP Server - injected bridge', () => {
  test('createMcpServer accepts injected bridge', async () => {
    const { createMcpServer } = await import('@oneshot101/rbxdev-mcp/server');
    const bridge = createExecutorBridge(noop);
    const result = createMcpServer(bridge);
    expect(result.bridge).toBe(bridge);
    expect(result.server).toBeDefined();
  });

  test('createMcpServer uses default bridge when none provided', async () => {
    const { createMcpServer } = await import('@oneshot101/rbxdev-mcp/server');
    const result = createMcpServer();
    expect(result.bridge).toBeDefined();
  });
});
