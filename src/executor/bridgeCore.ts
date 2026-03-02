import type {
  BridgeStatus,
  ChildrenResult,
  CloneInstanceResult,
  CreateInstanceResult,
  DeleteResult,
  ExecuteResult,
  LogEntry,
  ModuleInterfaceResult,
  PropertiesResult,
  ReparentResult,
  ScriptSourceResult,
  SetPropertyResult,
  SetRemoteSpyBlockListResult,
  SetRemoteSpyEnabledResult,
  SetRemoteSpyFilterResult,
  SetScriptSourceResult,
  TeleportResult,
} from '@typings/bridge';
import type { ClientCapabilities, ClientType } from '@typings/clientType';
import type {
  GameTreeNode,
  ModuleReference,
  RemoteSpyBlockEntry,
  RemoteSpyCall,
  RuntimeError,
  ServerMessage,
} from '@typings/protocol';
import { resolveCapabilities } from './capabilities';
import { createLiveGameModel } from './gameTree';
import { parseClientMessage } from './protocol';

interface PendingRequest<T> {
  readonly resolve: (result: T) => void;
  readonly reject: (error: Error) => void;
  readonly timeout: ReturnType<typeof setTimeout>;
}

const MAX_REMOTE_SPY_BUFFER = 500;

export interface BridgeCore {
  readonly liveGameModel: ReturnType<typeof createLiveGameModel>['model'];
  readonly handleMessage: (data: string) => void;
  readonly setStatus: (status: BridgeStatus) => void;
  readonly setConnected: (connected: boolean) => void;
  readonly setExecutorName: (name: string | undefined) => void;
  readonly setClientType: (type: ClientType | undefined) => void;
  readonly getExecutorName: () => string | undefined;
  readonly getClientType: () => ClientType | undefined;
  readonly getClientCapabilities: () => ClientCapabilities | undefined;
  readonly getStatus: () => BridgeStatus;
  readonly getRemoteSpyEnabled: () => boolean;
  readonly getRemoteSpyCalls: () => ReadonlyArray<RemoteSpyCall>;
  readonly rejectAllPending: (reason: string) => void;
  readonly execute: (code: string) => Promise<ExecuteResult>;
  readonly requestGameTree: () => void;
  readonly requestProperties: (
    path: ReadonlyArray<string>,
    properties?: ReadonlyArray<string>,
  ) => Promise<PropertiesResult>;
  readonly requestModuleInterface: (moduleRef: ModuleReference) => Promise<ModuleInterfaceResult>;
  readonly setProperty: (
    path: ReadonlyArray<string>,
    property: string,
    value: string,
    valueType: string,
  ) => Promise<SetPropertyResult>;
  readonly teleportTo: (path: ReadonlyArray<string>) => Promise<TeleportResult>;
  readonly deleteInstance: (path: ReadonlyArray<string>) => Promise<DeleteResult>;
  readonly reparentInstance: (
    sourcePath: ReadonlyArray<string>,
    targetPath: ReadonlyArray<string>,
  ) => Promise<ReparentResult>;
  readonly requestChildren: (path: ReadonlyArray<string>) => Promise<ChildrenResult>;
  readonly requestScriptSource: (path: ReadonlyArray<string>) => Promise<ScriptSourceResult>;
  readonly createInstance: (
    className: string,
    parentPath: ReadonlyArray<string>,
    name?: string,
  ) => Promise<CreateInstanceResult>;
  readonly cloneInstance: (path: ReadonlyArray<string>) => Promise<CloneInstanceResult>;
  readonly setScriptSource: (path: ReadonlyArray<string>, source: string) => Promise<SetScriptSourceResult>;
  readonly setRemoteSpyEnabled: (enabled: boolean) => Promise<SetRemoteSpyEnabledResult>;
  readonly setRemoteSpyFilter: (filter: string) => Promise<SetRemoteSpyFilterResult>;
  readonly setRemoteSpyBlockList: (blocks: ReadonlyArray<RemoteSpyBlockEntry>) => Promise<SetRemoteSpyBlockListResult>;
  readonly onStatusChange: (callback: (status: BridgeStatus) => void) => void;
  readonly onRuntimeError: (callback: (error: RuntimeError) => void) => void;
  readonly onGameTreeUpdate: (callback: (nodes: GameTreeNode[]) => void) => void;
  readonly onLog: (callback: (log: LogEntry) => void) => void;
  readonly onRemoteSpy: (callback: (call: RemoteSpyCall) => void) => void;
}

export const createBridgeCore = (
  sendFn: (message: ServerMessage) => void,
  isReady: () => boolean,
  log: (message: string) => void,
): BridgeCore => {
  let executorName: string | undefined;
  let clientType: ClientType | undefined;
  let clientCapabilities: ClientCapabilities | undefined;
  let status: BridgeStatus = 'stopped';
  let remoteSpyEnabled = false;

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
  const pendingSetRemoteSpyBlockList = new Map<string, PendingRequest<SetRemoteSpyBlockListResult>>();
  const pendingSetScriptSources = new Map<string, PendingRequest<SetScriptSourceResult>>();

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
      if (isReady() === false) return reject(new Error('No executor connected'));
      if (executorName === undefined) return reject(new Error('Executor connected but handshake not completed'));
      const id = generateId();
      const timeout = setTimeout(() => {
        pendingMap.delete(id);
        resolve({ 'success': false, 'error': 'Request timed out' } as T);
      }, timeoutMs);
      pendingMap.set(id, { resolve, reject, timeout, ...extra } as PendingRequest<T>);
      sendFn(buildMessage(id));
    });

  const handleMessage = (data: string): void => {
    const message = parseClientMessage(data);
    if (message === undefined) return log('[bridge] Received invalid message');

    switch (message.type) {
      case 'connected': {
        executorName = message.executorName;
        clientType = message.clientType ?? 'executor';
        clientCapabilities = resolveCapabilities(clientType);
        setConnected(true);
        setStatus('connected');
        const clientLabel = clientType === 'studio' ? 'Studio' : 'Executor';
        log(`[bridge] ${clientLabel} connected: ${message.executorName} v${message.version}`);
        break;
      }

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

      case 'setRemoteSpyBlockListResult':
        resolvePending(pendingSetRemoteSpyBlockList, message.id, {
          'success': message.success,
          'error': message.error ?? undefined,
        });
        break;

      case 'setScriptSourceResult':
        resolvePending(pendingSetScriptSources, message.id, {
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

  const rejectAllPending = (reason: string): void => {
    for (const [id, pending] of pendingExecutions) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(reason));
      pendingExecutions.delete(id);
    }
  };

  const execute = (code: string): Promise<ExecuteResult> =>
    new Promise((resolve, reject) => {
      if (isReady() === false) return reject(new Error('No executor connected'));
      if (executorName === undefined) return reject(new Error('Executor connected but handshake not completed'));
      const id = generateId();
      const timeout = setTimeout(() => {
        pendingExecutions.delete(id);
        reject(new Error('Execution timed out'));
      }, 30000);
      pendingExecutions.set(id, { resolve, reject, timeout });
      sendFn({ 'type': 'execute', id, code });
    });

  const requestGameTree = (): void => {
    sendFn({ 'type': 'requestGameTree' });
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

  const setRemoteSpyBlockListFn = (blocks: ReadonlyArray<RemoteSpyBlockEntry>): Promise<SetRemoteSpyBlockListResult> =>
    createRequest(pendingSetRemoteSpyBlockList, 2000, id => ({
      'type': 'setRemoteSpyBlockList' as const,
      id,
      blocks,
    }));

  const setScriptSourceFn = (path: ReadonlyArray<string>, source: string): Promise<SetScriptSourceResult> =>
    createRequest(pendingSetScriptSources, 10000, id => ({
      'type': 'setScriptSource' as const,
      id,
      'path': [...path],
      source,
    }));

  return {
    liveGameModel,
    handleMessage,
    setStatus,
    'setConnected': (connected: boolean) => setConnected(connected),
    'setExecutorName': (name: string | undefined) => {
      executorName = name;
      if (name === undefined) {
        clientType = undefined;
        clientCapabilities = undefined;
      }
    },
    'setClientType': (type: ClientType | undefined) => {
      clientType = type;
      clientCapabilities = type !== undefined ? resolveCapabilities(type) : undefined;
    },
    'getExecutorName': () => executorName,
    'getClientType': () => clientType,
    'getClientCapabilities': () => clientCapabilities,
    'getStatus': () => status,
    'getRemoteSpyEnabled': () => remoteSpyEnabled,
    'getRemoteSpyCalls': () => remoteSpyCallsBuffer,
    rejectAllPending,
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
    'setScriptSource': setScriptSourceFn,
    'setRemoteSpyEnabled': setRemoteSpyEnabledFn,
    'setRemoteSpyFilter': setRemoteSpyFilterFn,
    'setRemoteSpyBlockList': setRemoteSpyBlockListFn,
    'onStatusChange': (callback: (status: BridgeStatus) => void) => {
      statusCallbacks.push(callback);
    },
    'onRuntimeError': (callback: (error: RuntimeError) => void) => {
      errorCallbacks.push(callback);
    },
    'onGameTreeUpdate': (callback: (nodes: GameTreeNode[]) => void) => {
      gameTreeCallbacks.push(callback);
    },
    'onLog': (callback: (log: LogEntry) => void) => {
      logCallbacks.push(callback);
    },
    'onRemoteSpy': (callback: (call: RemoteSpyCall) => void) => {
      remoteSpyCallbacks.push(callback);
    },
  };
};
