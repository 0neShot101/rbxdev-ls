import { WebSocket, WebSocketServer } from 'ws';

import type { ExecutorBridge } from '@typings/bridge';
import type { ProxyStatusChangeMessage, ProxyWelcomeMessage, ServerMessage } from '@typings/protocol';
import { createBridgeCore } from './bridgeCore';

const HANDSHAKE_TIMEOUT_MS = 5000;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const isProxyWelcome = (msg: unknown): msg is ProxyWelcomeMessage =>
  isRecord(msg) && msg['type'] === 'proxyWelcome' && typeof msg['isConnected'] === 'boolean';

const isProxyStatusChange = (msg: unknown): msg is ProxyStatusChangeMessage =>
  isRecord(msg) && msg['type'] === 'proxyStatusChange' && typeof msg['status'] === 'string';

/** Creates a new executor bridge instance for managing WebSocket connections with Roblox executors. */
export const createExecutorBridge = (log: (message: string) => void): ExecutorBridge => {
  let server: WebSocketServer | undefined;
  let executorClient: WebSocket | undefined;
  let handshakeTimeout: ReturnType<typeof setTimeout> | undefined;
  let proxyWs: WebSocket | undefined;
  let isProxyMode = false;

  const proxyClients = new Set<WebSocket>();

  let sendFn = (_message: ServerMessage): void => {};
  let isReadyFn = (): boolean => false;

  const core = createBridgeCore(
    message => sendFn(message),
    () => isReadyFn(),
    log,
  );

  const setServerTransport = (): void => {
    sendFn = (message: ServerMessage): void => {
      if (executorClient === undefined || executorClient.readyState !== WebSocket.OPEN) return;
      executorClient.send(JSON.stringify(message));
    };
    isReadyFn = (): boolean => executorClient !== undefined && executorClient.readyState === WebSocket.OPEN;
  };

  const setProxyTransport = (): void => {
    sendFn = (message: ServerMessage): void => {
      if (proxyWs === undefined || proxyWs.readyState !== WebSocket.OPEN) return;
      proxyWs.send(JSON.stringify(message));
    };
    isReadyFn = (): boolean =>
      proxyWs !== undefined && proxyWs.readyState === WebSocket.OPEN && core.getExecutorName() !== undefined;
  };

  const broadcastToProxies = (rawData: string): void => {
    for (const proxy of proxyClients) {
      if (proxy.readyState === WebSocket.OPEN) proxy.send(rawData);
    }
  };

  const sendProxyMessage = (message: ProxyStatusChangeMessage | ProxyWelcomeMessage): void => {
    broadcastToProxies(JSON.stringify(message));
  };

  core.onStatusChange(newStatus => {
    if (newStatus === 'connected' && isProxyMode === false) {
      if (handshakeTimeout !== undefined) {
        clearTimeout(handshakeTimeout);
        handshakeTimeout = undefined;
      }
      const name = core.getExecutorName();
      sendProxyMessage({
        'type': 'proxyStatusChange',
        'status': 'connected',
        ...(name !== undefined ? { 'executorName': name } : {}),
        ...(core.getClientType() !== undefined ? { 'clientType': core.getClientType() } : {}),
      });
    }
  });

  const handleProxyConnection = (ws: WebSocket): void => {
    proxyClients.add(ws);
    log(`[bridge] Proxy client connected (total: ${proxyClients.size})`);

    const welcome: ProxyWelcomeMessage = {
      'type': 'proxyWelcome',
      'isConnected': core.getStatus() === 'connected',
      'executorName': core.getExecutorName(),
      ...(core.getClientType() !== undefined ? { 'clientType': core.getClientType() } : {}),
    };
    ws.send(JSON.stringify(welcome));

    ws.on('message', (data: Buffer | string) => {
      if (executorClient === undefined || executorClient.readyState !== WebSocket.OPEN) return;
      executorClient.send(typeof data === 'string' ? data : data.toString('utf-8'));
    });

    ws.on('close', () => {
      proxyClients.delete(ws);
      log(`[bridge] Proxy client disconnected (total: ${proxyClients.size})`);
    });

    ws.on('error', (err: Error) => {
      log(`[bridge] Proxy client error: ${err.message}`);
    });
  };

  const handleExecutorConnection = (ws: WebSocket, firstMessage: string): void => {
    if (executorClient !== undefined) {
      log('[bridge] Replacing existing executor connection');
      try {
        executorClient.close(1000, 'Replaced by new connection');
      } catch {
        /* noop */
      }
      executorClient = undefined;
      core.setExecutorName(undefined);
      if (handshakeTimeout !== undefined) {
        clearTimeout(handshakeTimeout);
        handshakeTimeout = undefined;
      }
    }

    executorClient = ws;
    log('[bridge] Executor connecting...');

    handshakeTimeout = setTimeout(() => {
      if (core.getExecutorName() === undefined && executorClient === ws) {
        log('[bridge] Handshake timeout: client did not identify within 5s, disconnecting');
        ws.close(1000, 'Handshake timeout');
      }
    }, HANDSHAKE_TIMEOUT_MS);

    core.handleMessage(firstMessage);
    broadcastToProxies(firstMessage);

    ws.on('message', (data: Buffer | string) => {
      const raw = typeof data === 'string' ? data : data.toString('utf-8');
      core.handleMessage(raw);
      broadcastToProxies(raw);
    });

    ws.on('close', () => {
      log('[bridge] Executor disconnected');
      if (handshakeTimeout !== undefined) {
        clearTimeout(handshakeTimeout);
        handshakeTimeout = undefined;
      }
      executorClient = undefined;
      core.setExecutorName(undefined);
      core.setConnected(false);
      core.setStatus('waiting');
      core.rejectAllPending('Client disconnected');

      sendProxyMessage({
        'type': 'proxyStatusChange',
        'status': 'disconnected',
      });
    });

    ws.on('error', (err: Error) => {
      log(`[bridge] WebSocket error: ${err.message}`);
    });
  };

  const handleProxyWelcome = (message: ProxyWelcomeMessage): void => {
    if (message.isConnected) {
      core.setExecutorName(message.executorName);
      core.setConnected(true);
      core.setStatus('connected');
      log(`[bridge] Executor already connected via proxy: ${message.executorName ?? 'unknown'}`);
      core.requestGameTree();
    } else {
      core.setStatus('waiting');
      log('[bridge] Connected as proxy, waiting for executor');
    }
  };

  const handleProxyStatusChange = (message: ProxyStatusChangeMessage): void => {
    if (message.status === 'connected') {
      core.setExecutorName(message.executorName);
      core.setConnected(true);
      core.setStatus('connected');
      log(`[bridge] Executor connected via proxy: ${message.executorName ?? 'unknown'}`);
      core.requestGameTree();
    } else {
      core.setExecutorName(undefined);
      core.setConnected(false);
      core.setStatus('waiting');
      core.rejectAllPending('Executor disconnected');
      log('[bridge] Executor disconnected (proxy)');
    }
  };

  const startAsProxy = (port: number): void => {
    isProxyMode = true;
    setProxyTransport();
    log(`[bridge] Port ${port} in use — falling back to proxy mode`);

    try {
      proxyWs = new WebSocket(`ws://127.0.0.1:${port}`);

      proxyWs.on('open', () => {
        if (proxyWs === undefined) return;
        log(`[bridge] Connected to existing bridge on port ${port}`);
        proxyWs.send(JSON.stringify({ 'type': 'proxyHandshake' }));
      });

      proxyWs.on('message', (data: Buffer | string) => {
        const raw = typeof data === 'string' ? data : data.toString('utf-8');

        try {
          const parsed: unknown = JSON.parse(raw);
          if (isProxyWelcome(parsed)) {
            handleProxyWelcome(parsed);
            return;
          }
          if (isProxyStatusChange(parsed)) {
            handleProxyStatusChange(parsed);
            return;
          }
        } catch {
          /* not valid JSON */
        }

        core.handleMessage(raw);
      });

      proxyWs.on('close', () => {
        log('[bridge] Proxy connection lost');
        proxyWs = undefined;
        core.setExecutorName(undefined);
        core.setConnected(false);
        core.setStatus('waiting');
        core.rejectAllPending('Bridge server disconnected');
      });

      proxyWs.on('error', (err: Error) => {
        log(`[bridge] Proxy WebSocket error: ${err.message}`);
      });
    } catch (err) {
      log(`[bridge] Failed to connect as proxy: ${err instanceof Error ? err.message : String(err)}`);
      core.setStatus('error');
    }
  };

  const start = (port: number): void => {
    if (server !== undefined || isProxyMode) return;

    setServerTransport();

    try {
      server = new WebSocketServer({ 'host': '127.0.0.1', port });
      core.setStatus('waiting');
      log(`[bridge] WebSocket server started on port ${port}`);

      server.on('connection', (ws: WebSocket) => {
        ws.once('message', (data: Buffer | string) => {
          const raw = typeof data === 'string' ? data : data.toString('utf-8');

          try {
            const parsed = JSON.parse(raw);
            if (typeof parsed === 'object' && parsed !== null && parsed.type === 'proxyHandshake') {
              handleProxyConnection(ws);
              return;
            }
          } catch {
            /* not valid JSON — treat as executor */
          }

          handleExecutorConnection(ws, raw);
        });
      });

      server.on('error', (err: Error & { code?: string }) => {
        if (err.code === 'EADDRINUSE' && isProxyMode === false) {
          try {
            server?.close();
          } catch {
            /* noop */
          }
          server = undefined;
          startAsProxy(port);
          return;
        }
        log(`[bridge] Server error: ${err.message}`);
        core.setStatus('error');
      });
    } catch (err) {
      log(`[bridge] Failed to start server: ${err instanceof Error ? err.message : String(err)}`);
      core.setStatus('error');
    }
  };

  const stop = (): void => {
    if (isProxyMode) {
      if (proxyWs !== undefined) {
        proxyWs.close(1000, 'Bridge shutting down');
        proxyWs = undefined;
      }
      isProxyMode = false;
    }
    if (handshakeTimeout !== undefined) {
      clearTimeout(handshakeTimeout);
      handshakeTimeout = undefined;
    }
    if (executorClient !== undefined) {
      executorClient.close(1000, 'Server shutting down');
      executorClient = undefined;
    }
    for (const proxy of proxyClients) {
      try {
        proxy.close(1000, 'Server shutting down');
      } catch {
        /* noop */
      }
    }
    proxyClients.clear();
    if (server !== undefined) {
      server.close();
      server = undefined;
    }
    core.setExecutorName(undefined);
    core.setConnected(false);
    core.setStatus('stopped');
    log('[bridge] Bridge stopped');
  };

  return {
    get 'isRunning'() {
      return server !== undefined || isProxyMode;
    },
    get 'isConnected'() {
      if (isProxyMode)
        return proxyWs !== undefined && proxyWs.readyState === WebSocket.OPEN && core.getExecutorName() !== undefined;
      return (
        executorClient !== undefined &&
        executorClient.readyState === WebSocket.OPEN &&
        core.getExecutorName() !== undefined
      );
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
