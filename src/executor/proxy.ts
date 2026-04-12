import { WebSocket } from 'ws';

import type { ExecutorBridge } from '@typings/bridge';
import type { ProxyStatusChangeMessage, ProxyWelcomeMessage } from '@typings/protocol';
import { createBridgeCore } from './bridgeCore';

const RECONNECT_DELAY_MS = 3000;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const isProxyWelcome = (msg: unknown): msg is ProxyWelcomeMessage =>
  isRecord(msg) && msg['type'] === 'proxyWelcome' && typeof msg['isConnected'] === 'boolean';

const isProxyStatusChange = (msg: unknown): msg is ProxyStatusChangeMessage =>
  isRecord(msg) && msg['type'] === 'proxyStatusChange' && typeof msg['status'] === 'string';

/** Creates a proxy bridge that connects as a WebSocket client to an existing bridge server. */
export const createProxyBridge = (log: (message: string) => void): ExecutorBridge => {
  let ws: WebSocket | undefined;
  let targetPort: number | undefined;
  let shouldReconnect = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

  const core = createBridgeCore(
    message => {
      if (ws === undefined || ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify(message));
    },
    () => ws !== undefined && ws.readyState === WebSocket.OPEN && core.getExecutorName() !== undefined,
    log,
  );

  const handleProxyMessage = (message: ProxyWelcomeMessage | ProxyStatusChangeMessage): void => {
    if (message.type === 'proxyWelcome') {
      if (message.isConnected) {
        core.setExecutorName(message.executorName);
        if (message.clientType !== undefined) core.setClientType(message.clientType);
        core.setConnected(true);
        core.setStatus('connected');
        log(`[proxy] Executor already connected: ${message.executorName ?? 'unknown'}`);
        core.requestGameTree();
      } else {
        core.setStatus('waiting');
        log('[proxy] Connected to bridge server, waiting for executor');
      }
      return;
    }

    if (message.status === 'connected') {
      core.setExecutorName(message.executorName);
      if (message.clientType !== undefined) core.setClientType(message.clientType);
      core.setConnected(true);
      core.setStatus('connected');
      log(`[proxy] Executor connected: ${message.executorName ?? 'unknown'}`);
      core.requestGameTree();
    } else {
      core.setExecutorName(undefined);
      core.setClientType(undefined);
      core.setConnected(false);
      core.setStatus('waiting');
      core.rejectAllPending('Executor disconnected');
      log('[proxy] Executor disconnected');
    }
  };

  const connect = (port: number): void => {
    if (ws !== undefined) return;

    try {
      ws = new WebSocket(`ws://127.0.0.1:${port}`);

      ws.on('open', () => {
        if (ws === undefined) return;
        log(`[proxy] Connected to bridge server on port ${port}`);
        ws.send(JSON.stringify({ 'type': 'proxyHandshake' }));
      });

      ws.on('message', (data: Buffer | string) => {
        const raw = typeof data === 'string' ? data : data.toString('utf-8');

        try {
          const parsed: unknown = JSON.parse(raw);
          if (isProxyWelcome(parsed)) {
            handleProxyMessage(parsed);
            return;
          }
          if (isProxyStatusChange(parsed)) {
            handleProxyMessage(parsed);
            return;
          }
        } catch {
          /* not valid JSON */
        }

        core.handleMessage(raw);
      });

      ws.on('close', () => {
        log('[proxy] Disconnected from bridge server');
        ws = undefined;
        core.setExecutorName(undefined);
        core.setConnected(false);
        core.setStatus('waiting');
        core.rejectAllPending('Bridge server disconnected');

        if (shouldReconnect && targetPort !== undefined) {
          reconnectTimer = setTimeout(() => {
            reconnectTimer = undefined;
            if (shouldReconnect && targetPort !== undefined) connect(targetPort);
          }, RECONNECT_DELAY_MS);
        }
      });

      ws.on('error', (err: Error) => {
        log(`[proxy] WebSocket error: ${err.message}`);
      });
    } catch (err) {
      log(`[proxy] Failed to connect: ${err instanceof Error ? err.message : String(err)}`);
      core.setStatus('error');
    }
  };

  const start = (port: number): void => {
    targetPort = port;
    shouldReconnect = true;
    connect(port);
  };

  const stop = (): void => {
    shouldReconnect = false;
    if (reconnectTimer !== undefined) {
      clearTimeout(reconnectTimer);
      reconnectTimer = undefined;
    }
    if (ws !== undefined) {
      ws.close(1000, 'Proxy shutting down');
      ws = undefined;
    }
    targetPort = undefined;
    core.setExecutorName(undefined);
    core.setConnected(false);
    core.setStatus('stopped');
    log('[proxy] Proxy bridge stopped');
  };

  return {
    get 'isRunning'() {
      return ws !== undefined || shouldReconnect;
    },
    get 'isConnected'() {
      return ws !== undefined && ws.readyState === WebSocket.OPEN && core.getExecutorName() !== undefined;
    },
    get 'executorName'() {
      return core.getExecutorName();
    },
    get 'clientType'() {
      return core.getClientType();
    },
    get 'clientCapabilities'() {
      return core.getClientCapabilities();
    },
    'liveGameModel': core.liveGameModel,
    start,
    stop,
    'execute': core.execute,
    'requestGameTree': core.requestGameTree,
    'setAutoRefresh': core.setAutoRefresh,
    'requestProperties': core.requestProperties,
    'requestModuleInterface': core.requestModuleInterface,
    'setProperty': core.setProperty,
    'teleportTo': core.teleportTo,
    'deleteInstance': core.deleteInstance,
    'reparentInstance': core.reparentInstance,
    'requestChildren': core.requestChildren,
    'requestScriptSource': core.requestScriptSource,
    'createInstance': core.createInstance,
    'cloneInstance': core.cloneInstance,
    'setScriptSource': core.setScriptSource,
    'setRemoteSpyEnabled': core.setRemoteSpyEnabled,
    'setRemoteSpyFilter': core.setRemoteSpyFilter,
    'setRemoteSpyBlockList': core.setRemoteSpyBlockList,
    get 'isRemoteSpyEnabled'() {
      return core.getRemoteSpyEnabled();
    },
    get 'remoteSpyCalls'() {
      return core.getRemoteSpyCalls();
    },
    'onStatusChange': core.onStatusChange,
    'onRuntimeError': core.onRuntimeError,
    'onGameTreeUpdate': core.onGameTreeUpdate,
    'onLog': core.onLog,
    'onRemoteSpy': core.onRemoteSpy,
  };
};
