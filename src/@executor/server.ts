import { WebSocketServer, type WebSocket } from 'ws';

import type {
  BridgeStatus,
  ChildrenResult,
  CloneInstanceResult,
  CreateInstanceResult,
  DeleteResult,
  ExecuteResult,
  ExecutorBridge,
  LogEntry,
  ModuleInterfaceResult,
  PropertiesResult,
  ReparentResult,
  ScriptSourceResult,
  SetPropertyResult,
  SetRemoteSpyEnabledResult,
  SetRemoteSpyFilterResult,
  TeleportResult,
} from '@typings/bridge';
import type { GameTreeNode, ModuleReference, RemoteSpyCall, RuntimeError, ServerMessage } from '@typings/protocol';
import { createLiveGameModel } from './gameTree';
import { parseClientMessage } from './protocol';

interface PendingRequest<T> {
  readonly resolve: (result: T) => void;
  readonly reject: (error: Error) => void;
  readonly timeout: ReturnType<typeof setTimeout>;
}

const MAX_REMOTE_SPY_BUFFER = 500;

/** Creates a new executor bridge instance for managing WebSocket connections with Roblox executors. */
export const createExecutorBridge = (log: (message: string) => void): ExecutorBridge => {
  let server: WebSocketServer | undefined;
  let client: WebSocket | undefined;
  let executorName: string | undefined;
  let handshakeTimeout: ReturnType<typeof setTimeout> | undefined;
  let status: BridgeStatus = 'stopped';
  let remoteSpyEnabled = false;

  const HANDSHAKE_TIMEOUT_MS = 5000;

  const pendingExecutions = new Map<string, PendingRequest<ExecuteResult>>();
  const pendingProperties = new Map<string, PendingRequest<PropertiesResult>>();
  const pendingModuleInterfaces = new Map<string, PendingRequest<ModuleInterfaceResult>>();
  const pendingSetProperties = new Map<string, PendingRequest<SetPropertyResult>>();
  const pendingTeleports = new Map<string, PendingRequest<TeleportResult>>();
  const pendingDeletes = new Map<string, PendingRequest<DeleteResult>>();
  const pendingReparents = new Map<string, PendingRequest<ReparentResult>>();
  const pendingChildren = new Map<string, PendingRequest<ChildrenResult> & { readonly path: ReadonlyArray<string> }>();
  const pendingScriptSources = new Map<string, PendingRequest<ScriptSourceResult>>();
  const pendingCreateInstances = new Map<string, PendingRequest<CreateInstanceResult>>();
  const pendingCloneInstances = new Map<string, PendingRequest<CloneInstanceResult>>();
  const pendingSetRemoteSpyEnabled = new Map<string, PendingRequest<SetRemoteSpyEnabledResult>>();
  const pendingSetRemoteSpyFilter = new Map<string, PendingRequest<SetRemoteSpyFilterResult>>();

  const statusCallbacks: Array<(status: BridgeStatus) => void> = [];
  const errorCallbacks: Array<(error: RuntimeError) => void> = [];
  const gameTreeCallbacks: Array<(nodes: GameTreeNode[]) => void> = [];
  const logCallbacks: Array<(log: LogEntry) => void> = [];
  const remoteSpyCallbacks: Array<(call: RemoteSpyCall) => void> = [];
  const remoteSpyCallsBuffer: RemoteSpyCall[] = [];

  const {
    'model': liveGameModel,
    'update': updateGameModel,
    'mergeChildren': mergeChildrenIntoModel,
    setConnected,
  } = createLiveGameModel();

  const generateId = (): string => Math.random().toString(36).slice(2, 10);

  const setStatus = (newStatus: BridgeStatus): void => {
    if (status === newStatus) return;
    status = newStatus;
    for (const callback of statusCallbacks) callback(newStatus);
  };

  const send = (message: ServerMessage): void => {
    if (client === undefined || client.readyState !== client.OPEN) return;
    client.send(JSON.stringify(message));
  };

  const resolvePending = <T>(pendingMap: Map<string, PendingRequest<T>>, id: string, result: T): void => {
    const pending = pendingMap.get(id);
    if (pending === undefined) return;
    clearTimeout(pending.timeout);
    pendingMap.delete(id);
    pending.resolve(result);
  };

  const notify = <T>(callbacks: ReadonlyArray<(value: T) => void>, value: T): void => {
    for (const callback of callbacks) callback(value);
  };

  const createRequest = <T>(
    pendingMap: Map<string, PendingRequest<T>>,
    timeoutMs: number,
    buildMessage: (id: string) => ServerMessage,
    extra?: Record<string, unknown>,
  ): Promise<T> =>
    new Promise((resolve, reject) => {
      if (client === undefined || client.readyState !== client.OPEN) {
        reject(new Error('No executor connected'));
        return;
      }
      if (executorName === undefined) {
        reject(new Error('Executor connected but handshake not completed'));
        return;
      }
      const id = generateId();
      const timeout = setTimeout(() => {
        pendingMap.delete(id);
        resolve({ 'success': false, 'error': 'Request timed out' } as T);
      }, timeoutMs);
      pendingMap.set(id, { resolve, reject, timeout, ...extra } as PendingRequest<T>);
      send(buildMessage(id));
    });

  const handleMessage = (data: string): void => {
    const message = parseClientMessage(data);
    if (message === undefined) {
      log('[bridge] Received invalid message');
      return;
    }

    switch (message.type) {
      case 'connected':
        if (handshakeTimeout !== undefined) {
          clearTimeout(handshakeTimeout);
          handshakeTimeout = undefined;
        }
        executorName = message.executorName;
        setConnected(true);
        setStatus('connected');
        log(`[bridge] Executor connected: ${message.executorName} v${message.version}`);
        break;

      case 'executeResult':
        resolvePending(pendingExecutions, message.id, {
          'success': message.success,
          ...(message.result !== undefined ? { 'result': message.result } : {}),
          ...(message.error !== undefined ? { 'error': message.error } : {}),
        });
        break;

      case 'gameTree':
        updateGameModel(message.data);
        log(`[bridge] Game tree updated: ${message.data.length} services`);
        notify(gameTreeCallbacks, message.data);
        break;

      case 'runtimeError':
        log(`[bridge] Runtime error: ${message.error.message}`);
        notify(errorCallbacks, message.error);
        break;

      case 'log':
        notify(logCallbacks, {
          'level': message.level,
          'message': message.message,
          'stack': message.stack ?? undefined,
          'timestamp': message.timestamp,
        });
        break;

      case 'propertiesResult':
        resolvePending(pendingProperties, message.id, {
          'success': message.success,
          'properties': message.properties ?? undefined,
          'error': message.error ?? undefined,
        });
        break;

      case 'moduleInterface':
        resolvePending(pendingModuleInterfaces, message.id, {
          'success': message.success,
          'interface': message.interface ?? undefined,
          'error': message.error ?? undefined,
        });
        break;

      case 'setPropertyResult':
        resolvePending(pendingSetProperties, message.id, {
          'success': message.success,
          'error': message.error ?? undefined,
        });
        break;

      case 'teleportToResult':
        resolvePending(pendingTeleports, message.id, {
          'success': message.success,
          'error': message.error ?? undefined,
        });
        break;

      case 'deleteInstanceResult':
        resolvePending(pendingDeletes, message.id, {
          'success': message.success,
          'error': message.error ?? undefined,
        });
        break;

      case 'reparentInstanceResult':
        resolvePending(pendingReparents, message.id, {
          'success': message.success,
          'error': message.error ?? undefined,
        });
        break;

      case 'childrenResult': {
        const pending = pendingChildren.get(message.id);
        if (pending !== undefined) {
          clearTimeout(pending.timeout);
          pendingChildren.delete(message.id);
          if (message.success && message.children !== undefined) mergeChildrenIntoModel(pending.path, message.children);
          pending.resolve({
            'success': message.success,
            'children': message.children ?? undefined,
            'error': message.error ?? undefined,
          });
        }
        break;
      }

      case 'scriptSourceResult':
        resolvePending(pendingScriptSources, message.id, {
          'success': message.success,
          'source': message.source ?? undefined,
          'scriptType': message.scriptType ?? undefined,
          'error': message.error ?? undefined,
        });
        break;

      case 'createInstanceResult':
        resolvePending(pendingCreateInstances, message.id, {
          'success': message.success,
          'instanceName': message.instanceName ?? undefined,
          'error': message.error ?? undefined,
        });
        break;

      case 'cloneInstanceResult':
        resolvePending(pendingCloneInstances, message.id, {
          'success': message.success,
          'cloneName': message.cloneName ?? undefined,
          'error': message.error ?? undefined,
        });
        break;

      case 'setRemoteSpyEnabledResult': {
        const pending = pendingSetRemoteSpyEnabled.get(message.id);
        if (pending !== undefined) {
          clearTimeout(pending.timeout);
          pendingSetRemoteSpyEnabled.delete(message.id);
          if (message.success && message.enabled !== undefined) remoteSpyEnabled = message.enabled;
          pending.resolve({
            'success': message.success,
            'enabled': message.enabled ?? undefined,
            'error': message.error ?? undefined,
          });
        }
        break;
      }

      case 'setRemoteSpyFilterResult':
        resolvePending(pendingSetRemoteSpyFilter, message.id, {
          'success': message.success,
          'error': message.error ?? undefined,
        });
        break;

      case 'remoteSpy':
        remoteSpyCallsBuffer.push(message.call);
        if (remoteSpyCallsBuffer.length > MAX_REMOTE_SPY_BUFFER) remoteSpyCallsBuffer.shift();
        notify(remoteSpyCallbacks, message.call);
        break;
    }
  };

  const start = (port: number): void => {
    if (server !== undefined) return;

    try {
      server = new WebSocketServer({ 'host': '127.0.0.1', port });
      setStatus('waiting');
      log(`[bridge] WebSocket server started on port ${port}`);

      server.on('connection', (ws: WebSocket) => {
        if (client !== undefined) {
          log('[bridge] Replacing existing client connection');
          try {
            client.close(1000, 'Replaced by new connection');
          } catch {
            /* noop */
          }
          client = undefined;
          executorName = undefined;
          if (handshakeTimeout !== undefined) {
            clearTimeout(handshakeTimeout);
            handshakeTimeout = undefined;
          }
        }

        client = ws;
        log('[bridge] Client connecting...');

        handshakeTimeout = setTimeout(() => {
          if (executorName === undefined && client === ws) {
            log('[bridge] Handshake timeout: client did not identify within 5s, disconnecting');
            ws.close(1000, 'Handshake timeout');
          }
        }, HANDSHAKE_TIMEOUT_MS);

        ws.on('message', (data: Buffer | string) => {
          handleMessage(typeof data === 'string' ? data : data.toString('utf-8'));
        });

        ws.on('close', () => {
          log('[bridge] Client disconnected');
          if (handshakeTimeout !== undefined) {
            clearTimeout(handshakeTimeout);
            handshakeTimeout = undefined;
          }
          client = undefined;
          executorName = undefined;
          setConnected(false);
          setStatus('waiting');

          for (const [id, pending] of pendingExecutions) {
            clearTimeout(pending.timeout);
            pending.reject(new Error('Client disconnected'));
            pendingExecutions.delete(id);
          }
        });

        ws.on('error', (err: Error) => {
          log(`[bridge] WebSocket error: ${err.message}`);
        });
      });

      server.on('error', (err: Error) => {
        log(`[bridge] Server error: ${err.message}`);
        setStatus('error');
      });
    } catch (err) {
      log(`[bridge] Failed to start server: ${err instanceof Error ? err.message : String(err)}`);
      setStatus('error');
    }
  };

  const stop = (): void => {
    if (server === undefined) return;
    if (handshakeTimeout !== undefined) {
      clearTimeout(handshakeTimeout);
      handshakeTimeout = undefined;
    }
    if (client !== undefined) {
      client.close(1000, 'Server shutting down');
      client = undefined;
    }
    server.close();
    server = undefined;
    executorName = undefined;
    setConnected(false);
    setStatus('stopped');
    log('[bridge] Server stopped');
  };

  const execute = (code: string): Promise<ExecuteResult> =>
    new Promise((resolve, reject) => {
      if (client === undefined || client.readyState !== client.OPEN) {
        reject(new Error('No executor connected'));
        return;
      }
      if (executorName === undefined) {
        reject(new Error('Executor connected but handshake not completed'));
        return;
      }
      const id = generateId();
      const timeout = setTimeout(() => {
        pendingExecutions.delete(id);
        reject(new Error('Execution timed out'));
      }, 30000);
      pendingExecutions.set(id, { resolve, reject, timeout });
      send({ 'type': 'execute', id, code });
    });

  const requestGameTree = (): void => {
    send({ 'type': 'requestGameTree' });
  };

  const requestProperties = (
    path: ReadonlyArray<string>,
    properties?: ReadonlyArray<string>,
  ): Promise<PropertiesResult> =>
    createRequest(pendingProperties, 5000, id => ({
      'type': 'requestProperties' as const,
      id,
      'path': [...path],
      ...(properties !== undefined ? { 'properties': properties as ReadonlyArray<string> } : {}),
    }));

  const requestModuleInterface = (moduleRef: ModuleReference): Promise<ModuleInterfaceResult> =>
    createRequest(pendingModuleInterfaces, 2000, id => ({
      'type': 'requestModuleInterface' as const,
      id,
      moduleRef,
    }));

  const setProperty = (
    path: ReadonlyArray<string>,
    property: string,
    value: string,
    valueType: string,
  ): Promise<SetPropertyResult> =>
    createRequest(pendingSetProperties, 2000, id => ({
      'type': 'setProperty' as const,
      id,
      'path': [...path],
      property,
      value,
      valueType,
    }));

  const teleportTo = (path: ReadonlyArray<string>): Promise<TeleportResult> =>
    createRequest(pendingTeleports, 2000, id => ({
      'type': 'teleportTo' as const,
      id,
      'path': [...path],
    }));

  const deleteInstance = (path: ReadonlyArray<string>): Promise<DeleteResult> =>
    createRequest(pendingDeletes, 2000, id => ({
      'type': 'deleteInstance' as const,
      id,
      'path': [...path],
    }));

  const reparentInstance = (
    sourcePath: ReadonlyArray<string>,
    targetPath: ReadonlyArray<string>,
  ): Promise<ReparentResult> =>
    createRequest(pendingReparents, 2000, id => ({
      'type': 'reparentInstance' as const,
      id,
      'sourcePath': [...sourcePath],
      'targetPath': [...targetPath],
    }));

  const requestChildren = (path: ReadonlyArray<string>): Promise<ChildrenResult> =>
    createRequest(
      pendingChildren,
      2000,
      id => ({
        'type': 'requestChildren' as const,
        id,
        'path': [...path],
      }),
      { path },
    );

  const requestScriptSource = (path: ReadonlyArray<string>): Promise<ScriptSourceResult> =>
    createRequest(pendingScriptSources, 10000, id => ({
      'type': 'requestScriptSource' as const,
      id,
      'path': [...path],
    }));

  const createInstanceFn = (
    className: string,
    parentPath: ReadonlyArray<string>,
    name?: string,
  ): Promise<CreateInstanceResult> =>
    createRequest(pendingCreateInstances, 2000, id => ({
      'type': 'createInstance' as const,
      id,
      className,
      'parentPath': [...parentPath],
      ...(name !== undefined ? { name } : {}),
    }));

  const cloneInstance = (path: ReadonlyArray<string>): Promise<CloneInstanceResult> =>
    createRequest(pendingCloneInstances, 2000, id => ({
      'type': 'cloneInstance' as const,
      id,
      'path': [...path],
    }));

  const setRemoteSpyEnabledFn = (enabled: boolean): Promise<SetRemoteSpyEnabledResult> =>
    createRequest(pendingSetRemoteSpyEnabled, 2000, id => ({
      'type': 'setRemoteSpyEnabled' as const,
      id,
      enabled,
    }));

  const setRemoteSpyFilterFn = (filter: string): Promise<SetRemoteSpyFilterResult> =>
    createRequest(pendingSetRemoteSpyFilter, 2000, id => ({
      'type': 'setRemoteSpyFilter' as const,
      id,
      filter,
    }));

  const onStatusChange = (callback: (status: BridgeStatus) => void): void => {
    statusCallbacks.push(callback);
  };
  const onRuntimeError = (callback: (error: RuntimeError) => void): void => {
    errorCallbacks.push(callback);
  };
  const onGameTreeUpdate = (callback: (nodes: GameTreeNode[]) => void): void => {
    gameTreeCallbacks.push(callback);
  };
  const onLog = (callback: (log: LogEntry) => void): void => {
    logCallbacks.push(callback);
  };
  const onRemoteSpy = (callback: (call: RemoteSpyCall) => void): void => {
    remoteSpyCallbacks.push(callback);
  };

  return {
    get 'isRunning'() {
      return server !== undefined;
    },
    get 'isConnected'() {
      return client !== undefined && client.readyState === client.OPEN && executorName !== undefined;
    },
    get 'executorName'() {
      return executorName;
    },
    liveGameModel,
    start,
    stop,
    execute,
    requestGameTree,
    requestProperties,
    requestModuleInterface,
    setProperty,
    teleportTo,
    deleteInstance,
    reparentInstance,
    requestChildren,
    requestScriptSource,
    'createInstance': createInstanceFn,
    cloneInstance,
    'setRemoteSpyEnabled': setRemoteSpyEnabledFn,
    'setRemoteSpyFilter': setRemoteSpyFilterFn,
    get 'isRemoteSpyEnabled'() {
      return remoteSpyEnabled;
    },
    get 'remoteSpyCalls'() {
      return remoteSpyCallsBuffer;
    },
    onStatusChange,
    onRuntimeError,
    onGameTreeUpdate,
    onLog,
    onRemoteSpy,
  };
};
