import { createServer as createHttpServer, get as httpGet } from 'node:http';
import { WebSocket } from 'ws';

import { createBridgeCore } from '@executor/bridgeCore';
import { createProxyBridge } from '@executor/proxy';
import { createExecutorBridge } from '@executor/server';
import type { BridgeStatus, ExecutorBridge } from '@typings/bridge';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

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

const getAvailablePort = async (): Promise<number> =>
  await new Promise((resolve, reject) => {
    const server = createHttpServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        server.close();
        reject(new Error('Failed to resolve ephemeral port'));
        return;
      }

      const port = address.port;
      server.close(error => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });

const getJson = async (port: number, path: string): Promise<{ statusCode: number; body: string }> =>
  await new Promise((resolve, reject) => {
    const req = httpGet(
      {
        'host': '127.0.0.1',
        port,
        path,
      },
      res => {
        const chunks: Buffer[] = [];
        res.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on('end', () => {
          resolve({
            'statusCode': res.statusCode ?? 0,
            'body': Buffer.concat(chunks).toString('utf-8'),
          });
        });
      },
    );

    req.on('error', reject);
  });

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
      msg => logMessages.push(msg),
    );

    core.handleMessage('not json {{{');
    core.handleMessage(JSON.stringify({ 'type': 'unknownType' }));
    core.handleMessage(JSON.stringify({ 'no': 'type field' }));

    expect(logMessages.some(m => m.includes('invalid'))).toBe(true);
  });

  test('handleMessage resolves execute result', async () => {
    const sent: unknown[] = [];
    const core = createBridgeCore(
      msg => sent.push(msg),
      () => true,
      noop,
    );

    core.setExecutorName('Exec');
    core.setStatus('connected');

    const promise = core.execute('print("hi")');

    expect(sent.length).toBe(1);
    const sentMsg = sent[0] as { type: string; id: string; code: string };
    expect(sentMsg.type).toBe('execute');

    core.handleMessage(
      JSON.stringify({
        'type': 'executeResult',
        'id': sentMsg.id,
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
    await expect(core.execute('test')).rejects.toThrow('No executor connected');
  });

  test('execute rejects when no executor name', async () => {
    const core = createBridgeCore(noop, () => true, noop);
    await expect(core.execute('test')).rejects.toThrow('handshake not completed');
  });

  test('rejectAllPending rejects pending executions', async () => {
    const core = createBridgeCore(noop, () => true, noop);
    core.setExecutorName('Exec');

    const promise = core.execute('test');
    core.rejectAllPending('disconnected');

    await expect(promise).rejects.toThrow('disconnected');
  });

  test('requestGameTree sends message', () => {
    const sent: unknown[] = [];
    const core = createBridgeCore(
      msg => sent.push(msg),
      () => true,
      noop,
    );

    core.requestGameTree();
    expect(sent.length).toBe(1);
    expect((sent[0] as { type: string }).type).toBe('requestGameTree');
  });

  test('handleMessage resolves properties result', async () => {
    const sent: unknown[] = [];
    const core = createBridgeCore(
      msg => sent.push(msg),
      () => true,
      noop,
    );
    core.setExecutorName('Exec');

    const promise = core.requestProperties(['Workspace', 'Part']);
    const sentMsg = sent[0] as { id: string };

    core.handleMessage(
      JSON.stringify({
        'type': 'propertiesResult',
        'id': sentMsg.id,
        'success': true,
        'properties': [{ 'name': 'Name', 'valueType': 'string', 'value': 'Part' }],
      }),
    );

    const result = await promise;
    expect(result.success).toBe(true);
    expect(result.properties).toBeDefined();
    expect(result.properties!.length).toBe(1);
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

  afterEach(() => {
    bridge.stop();
  });

  test('bridge starts in waiting state', () => {
    expect(bridge.isRunning).toBe(true);
    expect(bridge.isConnected).toBe(false);
  });

  test('bridge serves health endpoint on the bridge port', async () => {
    const healthPort = await getAvailablePort();
    const healthLogs: string[] = [];
    const healthBridge = createExecutorBridge(msg => healthLogs.push(msg));
    healthBridge.start(healthPort);

    try {
      await waitFor(() => healthLogs.some(log => log.includes(`WebSocket server started on port ${healthPort}`)));
      const response = await getJson(healthPort, '/health');
      const payload = JSON.parse(response.body) as {
        ok: boolean;
        connected: boolean;
        executorName?: string;
        clientType?: string;
      };

      expect(response.statusCode).toBe(200);
      expect(payload.ok).toBe(true);
      expect(payload.connected).toBe(false);
      expect(payload.executorName).toBeUndefined();
      expect(payload.clientType).toBeUndefined();
    } finally {
      healthBridge.stop();
    }
  });

  test('bridge can restart quickly on the same port', async () => {
    bridge.stop();
    bridge.start(port);
    await wait(100);

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

    const messages: unknown[] = [];
    ws.on('message', (data: Buffer | string) => {
      messages.push(JSON.parse(typeof data === 'string' ? data : data.toString('utf-8')));
    });

    ws.send(JSON.stringify({ 'type': 'proxyHandshake' }));
    await wait(100);

    expect(messages.length).toBe(1);
    const welcome = messages[0] as { type: string; isConnected: boolean };
    expect(welcome.type).toBe('proxyWelcome');
    expect(welcome.isConnected).toBe(false);

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

    const messages: unknown[] = [];
    proxy.on('message', (data: Buffer | string) => {
      messages.push(JSON.parse(typeof data === 'string' ? data : data.toString('utf-8')));
    });

    proxy.send(JSON.stringify({ 'type': 'proxyHandshake' }));
    await wait(100);

    expect(messages.length).toBe(1);
    const welcome = messages[0] as { type: string; isConnected: boolean; executorName: string };
    expect(welcome.type).toBe('proxyWelcome');
    expect(welcome.isConnected).toBe(true);
    expect(welcome.executorName).toBe('MyExec');

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

    const proxyMessages: unknown[] = [];
    proxy.on('message', (data: Buffer | string) => {
      proxyMessages.push(JSON.parse(typeof data === 'string' ? data : data.toString('utf-8')));
    });

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
    expect((proxyMessages[0] as { type: string }).type).toBe('gameTree');

    proxy.close();
    executor.close();
    await wait(50);
  });

  test('proxy commands are forwarded to executor', async () => {
    const executor = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise<void>(resolve => executor.on('open', resolve));

    const executorReceived: unknown[] = [];
    executor.on('message', () => {});
    executor.send(
      JSON.stringify({
        'type': 'connected',
        'executorName': 'TestExec',
        'version': '1.0',
      }),
    );
    await wait(100);

    executor.on('message', (data: Buffer | string) => {
      executorReceived.push(JSON.parse(typeof data === 'string' ? data : data.toString('utf-8')));
    });

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
    const forwarded = executorReceived[0] as { type: string; id: string; code: string };
    expect(forwarded.type).toBe('execute');
    expect(forwarded.id).toBe('test-id-1');
    expect(forwarded.code).toBe('print("hello")');

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

    const proxyMessages: unknown[] = [];
    proxy.on('message', (data: Buffer | string) => {
      proxyMessages.push(JSON.parse(typeof data === 'string' ? data : data.toString('utf-8')));
    });

    proxy.send(JSON.stringify({ 'type': 'proxyHandshake' }));
    await wait(100);
    proxyMessages.length = 0;

    executor.close();
    await wait(200);

    const statusChange = proxyMessages.find(m => (m as { type: string }).type === 'proxyStatusChange') as
      | { type: string; status: string }
      | undefined;
    expect(statusChange).toBeDefined();
    expect(statusChange!.status).toBe('disconnected');

    proxy.close();
    await wait(50);
  });

  test('proxy receives status change on new executor connect', async () => {
    const proxy = new WebSocket(`ws://127.0.0.1:${port}`);
    await new Promise<void>(resolve => proxy.on('open', resolve));

    const proxyMessages: unknown[] = [];
    proxy.on('message', (data: Buffer | string) => {
      proxyMessages.push(JSON.parse(typeof data === 'string' ? data : data.toString('utf-8')));
    });

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

    const connected = proxyMessages.find(m => (m as { type: string }).type === 'proxyStatusChange') as
      | { type: string; status: string; executorName?: string }
      | undefined;
    expect(connected).toBeDefined();
    expect(connected!.status).toBe('connected');
    expect(connected!.executorName).toBe('NewExec');

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

    const messages1: unknown[] = [];
    const messages2: unknown[] = [];
    proxy1.on('message', (data: Buffer | string) => {
      messages1.push(JSON.parse(typeof data === 'string' ? data : data.toString('utf-8')));
    });
    proxy2.on('message', (data: Buffer | string) => {
      messages2.push(JSON.parse(typeof data === 'string' ? data : data.toString('utf-8')));
    });

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
    expect((messages1[0] as { type: string }).type).toBe('gameTree');
    expect((messages2[0] as { type: string }).type).toBe('gameTree');

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
    proxy.on('close', () => {
      proxyClosed = true;
    });

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
      const msg = JSON.parse(typeof data === 'string' ? data : data.toString('utf-8'));
      if (msg.type === 'execute') {
        executor.send(
          JSON.stringify({
            'type': 'executeResult',
            'id': msg.id,
            'success': true,
            'result': 'executed!',
          }),
        );
      }
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
      const msg = JSON.parse(typeof data === 'string' ? data : data.toString('utf-8'));
      if (msg.type === 'requestProperties') {
        executor.send(
          JSON.stringify({
            'type': 'propertiesResult',
            'id': msg.id,
            'success': true,
            'properties': [{ 'name': 'Name', 'valueType': 'string', 'value': 'TestPart' }],
          }),
        );
      }
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
    expect(result.properties).toBeDefined();
    expect(result.properties![0]!.name).toBe('Name');

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
    const executePromise = proxy.execute('print("test")').catch(() => {
      rejected = true;
    });
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

  test('proxy has all expected methods', () => {
    const proxy = createProxyBridge(noop);
    expect(typeof proxy.execute).toBe('function');
    expect(typeof proxy.requestGameTree).toBe('function');
    expect(typeof proxy.requestProperties).toBe('function');
    expect(typeof proxy.requestModuleInterface).toBe('function');
    expect(typeof proxy.setProperty).toBe('function');
    expect(typeof proxy.teleportTo).toBe('function');
    expect(typeof proxy.deleteInstance).toBe('function');
    expect(typeof proxy.reparentInstance).toBe('function');
    expect(typeof proxy.requestChildren).toBe('function');
    expect(typeof proxy.requestScriptSource).toBe('function');
    expect(typeof proxy.createInstance).toBe('function');
    expect(typeof proxy.cloneInstance).toBe('function');
    expect(typeof proxy.setRemoteSpyEnabled).toBe('function');
    expect(typeof proxy.setRemoteSpyFilter).toBe('function');
    expect(typeof proxy.setRemoteSpyBlockList).toBe('function');
    expect(typeof proxy.onStatusChange).toBe('function');
    expect(typeof proxy.onRuntimeError).toBe('function');
    expect(typeof proxy.onGameTreeUpdate).toBe('function');
    expect(typeof proxy.onLog).toBe('function');
    expect(typeof proxy.onRemoteSpy).toBe('function');
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

  afterEach(() => {
    ownerBridge.stop();
  });

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
      const msg = JSON.parse(typeof data === 'string' ? data : data.toString('utf-8'));
      if (msg.type === 'execute') {
        executor.send(
          JSON.stringify({
            'type': 'executeResult',
            'id': msg.id,
            'success': true,
            'result': 'fallback works!',
          }),
        );
      }
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

describe('MCP Server - injected bridge', () => {
  test('createMcpServer accepts injected bridge', async () => {
    const { createMcpServer } = await import('@mcp/server');
    const bridge = createExecutorBridge(noop);
    const result = createMcpServer(bridge);
    expect(result.bridge).toBe(bridge);
    expect(result.server).toBeDefined();
  });

  test('createMcpServer uses default bridge when none provided', async () => {
    const { createMcpServer } = await import('@mcp/server');
    const result = createMcpServer();
    expect(result.bridge).toBeDefined();
    expect(typeof result.bridge.execute).toBe('function');
  });
});
