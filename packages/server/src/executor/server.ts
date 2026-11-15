import { createServer } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';

import { createBridgeCore } from '@executor/bridgeCore';
import { frameText, parseProxyHandshake, parseProxyMessage } from '@executor/protocol';

import type { IncomingMessage, Server as HttpServer } from 'node:http';

import type { ExecutorBridge } from '@typings/bridge';
import type { ProxyStatusChangeMessage, ProxyWelcomeMessage, ServerMessage } from '@typings/protocol';
import type { Mutable } from '@typings/types';

const HANDSHAKE_TIMEOUT_MS = 5000;

/** Creates a new executor bridge instance for managing WebSocket connections with Roblox executors. */
export const createExecutorBridge = (log: (message: string) => void): ExecutorBridge => {
  let httpServer: HttpServer | undefined;
  let server: WebSocketServer | undefined;
  let executorClient: WebSocket | undefined;
  let handshakeTimeout: ReturnType<typeof setTimeout> | undefined;
  let proxyWs: WebSocket | undefined;
  let isProxyMode = false;
  let isStoppingHttpServer = false;
  let pendingStartPort: number | undefined;

  const proxyClients = new Set<WebSocket>();

  let sendFn = (_message: ServerMessage): void => {};
  let isReadyFn = (): boolean => false;

  const core = createBridgeCore(
    message => sendFn(message),
    () => isReadyFn(),
    log,
    () => isProxyMode === false,
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
    for (const proxy of proxyClients) if (proxy.readyState === WebSocket.OPEN) proxy.send(rawData);
  };

  const sendProxyMessage = (message: ProxyStatusChangeMessage | ProxyWelcomeMessage): void =>
    broadcastToProxies(JSON.stringify(message));

  const closeHttpServer = (callback?: () => void): void => {
    if (httpServer === undefined) return callback?.();

    const httpServerToClose = httpServer;
    httpServer = undefined;
    isStoppingHttpServer = true;
    httpServerToClose.close(() => {
      isStoppingHttpServer = false;

      const restartPort = pendingStartPort;
      pendingStartPort = undefined;
      callback?.();

      if (restartPort !== undefined) start(restartPort);
    });
  };

  core.onStatusChange(newStatus => {
    if (newStatus === 'connected' && isProxyMode === false) {
      if (handshakeTimeout !== undefined) {
        clearTimeout(handshakeTimeout);
        handshakeTimeout = undefined;
      }
      const name = core.getExecutorName();
      const clientType = core.getClientType();
      const message: Mutable<ProxyStatusChangeMessage> = { 'type': 'proxyStatusChange', 'status': 'connected' };
      if (name !== undefined) message.executorName = name;
      if (clientType !== undefined) message.clientType = clientType;
      sendProxyMessage(message);
    }
  });

  const handleProxyConnection = (ws: WebSocket): void => {
    proxyClients.add(ws);
    log(`[bridge] Proxy client connected (total: ${proxyClients.size})`);

    const clientType = core.getClientType();
    const welcome: Mutable<ProxyWelcomeMessage> = {
      'type': 'proxyWelcome',
      'isConnected': core.getStatus() === 'connected',
      'executorName': core.getExecutorName(),
    };
    if (clientType !== undefined) welcome.clientType = clientType;
    ws.send(JSON.stringify(welcome));

    ws.on('message', (data: Buffer | string) => {
      if (executorClient === undefined || executorClient.readyState !== WebSocket.OPEN) return;
      const raw = frameText(data);
      core.observeForwardedRequest(raw);
      executorClient.send(raw);
    });

    ws.on('close', () => {
      proxyClients.delete(ws);
      log(`[bridge] Proxy client disconnected (total: ${proxyClients.size})`);
    });

    ws.on('error', (error: Error) => log(`[bridge] Proxy client error: ${error.message}`));
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
      const raw = frameText(data);
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

    ws.on('error', (error: Error) => log(`[bridge] WebSocket error: ${error.message}`));
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
    log(`[bridge] Port ${port} in use, falling back to proxy mode`);

    try {
      proxyWs = new WebSocket(`ws://127.0.0.1:${port}`);

      proxyWs.on('open', () => {
        if (proxyWs === undefined) return;
        log(`[bridge] Connected to existing bridge on port ${port}`);
        proxyWs.send(JSON.stringify({ 'type': 'proxyHandshake' }));
      });

      proxyWs.on('message', (data: Buffer | string) => {
        const raw = frameText(data);
        const message = parseProxyMessage(raw);
        if (message === undefined) return core.handleMessage(raw);
        if (message.type === 'proxyWelcome') return handleProxyWelcome(message);
        return handleProxyStatusChange(message);
      });

      proxyWs.on('close', () => {
        log('[bridge] Proxy connection lost');
        proxyWs = undefined;
        core.setExecutorName(undefined);
        core.setConnected(false);
        core.setStatus('waiting');
        core.rejectAllPending('Bridge server disconnected');
      });

      proxyWs.on('error', (error: Error) => log(`[bridge] Proxy WebSocket error: ${error.message}`));
    } catch (cause) {
      log(`[bridge] Failed to connect as proxy: ${cause instanceof Error ? cause.message : String(cause)}`);
      core.setStatus('error');
    }
  };

  const start = (port: number): void => {
    if (isStoppingHttpServer) {
      pendingStartPort = port;
      return;
    }
    if (httpServer !== undefined || server !== undefined || isProxyMode) return;

    setServerTransport();

    try {
      httpServer = createServer((request, response) => {
        if (request.method === 'GET' && request.url === '/health') {
          const payload = JSON.stringify({
            'ok': true,
            'connected': core.getStatus() === 'connected',
            'executorName': core.getExecutorName(),
            'clientType': core.getClientType(),
          });
          response.writeHead(200, {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
            'Cache-Control': 'no-store',
          });
          response.end(payload);
          return;
        }

        response.writeHead(404, { 'Content-Type': 'text/plain' });
        response.end('Not found');
      });

      server = new WebSocketServer({ 'noServer': true });
      core.setStatus('waiting');

      httpServer.on('upgrade', (request: IncomingMessage, socket, head) => {
        if (server === undefined) {
          socket.destroy();
          return;
        }

        server.handleUpgrade(request, socket, head, (ws: WebSocket) => server?.emit('connection', ws, request));
      });

      server.on('connection', (ws: WebSocket) =>
        ws.once('message', (data: Buffer | string) => {
          const raw = frameText(data);
          if (parseProxyHandshake(raw) !== undefined) return handleProxyConnection(ws);
          return handleExecutorConnection(ws, raw);
        }),
      );

      server.on('error', (error: Error & { code?: string }) => {
        if (error.code === 'EADDRINUSE' && isProxyMode === false) {
          try {
            server?.close();
          } catch {
            /* noop */
          }
          server = undefined;
          startAsProxy(port);
          return;
        }
        log(`[bridge] Server error: ${error.message}`);
        core.setStatus('error');
      });

      httpServer.on('error', (error: Error & { code?: string }) => {
        if (error.code === 'EADDRINUSE' && isProxyMode === false) {
          try {
            server?.close();
          } catch {
            /* noop */
          }
          try {
            httpServer?.close();
          } catch {
            /* noop */
          }
          server = undefined;
          httpServer = undefined;
          startAsProxy(port);
          return;
        }
        try {
          server?.close();
        } catch {
          /* noop */
        }
        server = undefined;
        closeHttpServer();
        log(`[bridge] HTTP server error: ${error.message}`);
        core.setStatus('error');
      });
      httpServer.listen(port, '127.0.0.1', () => {
        isStoppingHttpServer = false;
        log(`[bridge] WebSocket server started on port ${port}`);
      });
    } catch (cause) {
      try {
        server?.close();
      } catch {
        /* noop */
      }
      server = undefined;
      closeHttpServer();
      log(`[bridge] Failed to start server: ${cause instanceof Error ? cause.message : String(cause)}`);
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
    for (const proxy of proxyClients)
      try {
        proxy.close(1000, 'Server shutting down');
      } catch {
        /* noop */
      }
    proxyClients.clear();
    if (server !== undefined) {
      server.close();
      server = undefined;
    }
    pendingStartPort = undefined;
    closeHttpServer();
    core.setExecutorName(undefined);
    core.setConnected(false);
    core.setStatus('stopped');
    log('[bridge] Bridge stopped');
  };

  return {
    get 'isRunning'() {
      return httpServer !== undefined || server !== undefined || isProxyMode;
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
