import { resolveCapabilities } from '@executor/capabilities';
import { createLiveGameModel } from '@executor/gameTree';
import { parseClientMessage, parseRemoteSpyPolicyMessage } from '@executor/protocol';

import type {
  BridgeCore,
  BridgeResult,
  BridgeStatus,
  ChildrenResult,
  CloneInstanceResult,
  CreateInstanceResult,
  DeleteResult,
  ExecuteResult,
  ForwardedSpyRequest,
  LogEntry,
  ModuleInterfaceResult,
  PendingRequest,
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
  CreateInstanceMessage,
  GameTreeNode,
  JsonValue,
  ModuleReference,
  RemoteSpyBlockEntry,
  RemoteSpyCall,
  RemoteSpyPolicyMessage,
  RemoteSpySource,
  RequestPropertiesMessage,
  RuntimeError,
  ServerMessage,
  SetRemoteSpyEnabledResultMessage,
} from '@typings/protocol';
import type { Mutable } from '@typings/types';

const MAX_REMOTE_SPY_BUFFER = 500;

const REMOTE_SPY_REQUEST_TIMEOUT_MS = 2000;

const TIMED_OUT: BridgeResult = { 'success': false, 'error': 'Request timed out' };

const isText = (value: JsonValue): value is string => typeof value === 'string';

const describeResult = (result: JsonValue): string => (isText(result) ? result : JSON.stringify(result));

/**
 * Creates the shared bridge core that handles protocol messages, pending request tracking,
 * and game model state. Both the direct server bridge and proxy bridge delegate to this core.
 * @param sendFn - Transport function for sending messages to the connected client.
 * @param isReady - Returns true when the underlying transport is open and ready.
 * @param log - Logger callback for bridge status messages.
 * @param ownsExecutorSession - Returns true while this core owns the executor socket. Only the owner replays the
 * shared Remote Spy policy after a same-socket reload; proxies stay passive so their stale defaults never race it.
 * @returns The bridge core interface with message handling, request methods, and event callbacks.
 */
export const createBridgeCore = (
  sendFn: (message: ServerMessage) => void,
  isReady: () => boolean,
  log: (message: string) => void,
  ownsExecutorSession: () => boolean = () => true,
): BridgeCore => {
  let executorName: string | undefined;
  let clientType: ClientType | undefined;
  let clientCapabilities: ClientCapabilities | undefined;
  let status: BridgeStatus = 'stopped';
  let remoteSpyEnabled = false;
  /**
   * Settings the editor asked for, kept so they survive a bridge reload that reuses the existing socket.
   * A hot reload swaps the Luau code but keeps the WebSocket (the bridge adopts it), so the transport never
   * reports a disconnect, the editor's connect-transition replay never fires, and the fresh Luau module would
   * otherwise start with auto-refresh off while the editor still believes the tree is auto-refreshing.
   */
  let requestedAutoRefresh: { enabled: boolean; intervalMs: number } | undefined;
  let handshakes = 0;
  let spySession = 0;
  let requestedSpyEnabled = false;
  let requestedSpySource: RemoteSpySource = 'game';
  let requestedSpyFilter = '';
  let requestedSpyBlocks: ReadonlyArray<RemoteSpyBlockEntry> = [];

  const pendingExecutions = new Map<string, PendingRequest<ExecuteResult>>();
  const pendingProperties = new Map<string, PendingRequest<PropertiesResult>>();
  const pendingModuleInterfaces = new Map<string, PendingRequest<ModuleInterfaceResult>>();
  const pendingSetProperties = new Map<string, PendingRequest<SetPropertyResult>>();
  const pendingTeleports = new Map<string, PendingRequest<TeleportResult>>();
  const pendingDeletes = new Map<string, PendingRequest<DeleteResult>>();
  const pendingReparents = new Map<string, PendingRequest<ReparentResult>>();
  const pendingChildren = new Map<string, PendingRequest<ChildrenResult>>();
  const childPaths = new Map<string, ReadonlyArray<string>>();
  const pendingScriptSources = new Map<string, PendingRequest<ScriptSourceResult>>();
  const pendingCreateInstances = new Map<string, PendingRequest<CreateInstanceResult>>();
  const pendingCloneInstances = new Map<string, PendingRequest<CloneInstanceResult>>();
  const pendingSetRemoteSpyEnabled = new Map<string, PendingRequest<SetRemoteSpyEnabledResult>>();
  const pendingSetRemoteSpyFilter = new Map<string, PendingRequest<SetRemoteSpyFilterResult>>();
  const pendingSetRemoteSpyBlockList = new Map<string, PendingRequest<SetRemoteSpyBlockListResult>>();
  const pendingSetScriptSources = new Map<string, PendingRequest<SetScriptSourceResult>>();
  /** Proxy requests share the executor's spy policy, so the owning core adopts them once the executor acknowledges. */
  const forwardedSpyRequests = new Map<string, ForwardedSpyRequest>();

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
    timedOut: T,
  ): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      if (isReady() === false) return reject(new Error('No executor connected'));
      if (executorName === undefined) return reject(new Error('Executor connected but handshake not completed'));
      const id = generateId();
      const timeout = setTimeout(() => {
        pendingMap.delete(id);
        resolve(timedOut);
      }, timeoutMs);
      pendingMap.set(id, { resolve, reject, timeout });
      sendFn(buildMessage(id));
    });

  const resetSpySession = (reason: string): void => {
    spySession += 1;
    remoteSpyEnabled = false;
    for (const pendingMap of [pendingSetRemoteSpyEnabled, pendingSetRemoteSpyFilter, pendingSetRemoteSpyBlockList]) {
      for (const pending of pendingMap.values()) {
        clearTimeout(pending.timeout);
        pending.resolve({ 'success': false, 'error': reason });
      }
      pendingMap.clear();
    }
    for (const forwarded of forwardedSpyRequests.values()) clearTimeout(forwarded.timeout);
    forwardedSpyRequests.clear();
  };

  const takeForwardedSpyRequest = (id: string): RemoteSpyPolicyMessage | undefined => {
    const forwarded = forwardedSpyRequests.get(id);
    if (forwarded === undefined) return undefined;
    clearTimeout(forwarded.timeout);
    forwardedSpyRequests.delete(id);
    return forwarded.request;
  };

  const acknowledgeSpyEnabled = (message: SetRemoteSpyEnabledResultMessage): void => {
    if (message.success === false || message.enabled === undefined) return;
    remoteSpyEnabled = message.enabled;
    requestedSpyEnabled = message.enabled;
    if (message.source !== undefined) requestedSpySource = message.source;
  };

  const handleMessage = (data: string): void => {
    const message = parseClientMessage(data);
    if (message === undefined) return log('[bridge] Received invalid message');

    switch (message.type) {
      case 'connected': {
        const reloadSpy = handshakes > 0 && status === 'connected';
        resetSpySession('Executor session replaced');
        executorName = message.executorName;
        clientType = message.clientType ?? 'executor';
        clientCapabilities = resolveCapabilities(clientType);
        setConnected(true);
        setStatus('connected');
        handshakes += 1;
        /** A second handshake on the same transport means reloaded bridge code inherited the socket. */
        const isReloaded = handshakes > 1;
        if (isReloaded && requestedAutoRefresh !== undefined)
          sendFn({ 'type': 'setAutoRefresh', ...requestedAutoRefresh });
        if (reloadSpy && ownsExecutorSession() && clientCapabilities.capabilities.has('remoteSpy'))
          void restoreSpySession(spySession);
        const clientLabel = clientType === 'studio' ? 'Studio' : 'Executor';
        log(`[bridge] ${clientLabel} connected: ${message.executorName} v${message.version ?? 'unknown'}`);
        break;
      }

      case 'executeResult': {
        const outcome: Mutable<ExecuteResult> = { 'success': message.success };
        if (message.result !== undefined) outcome.result = describeResult(message.result);
        if (message.error !== undefined) outcome.error = message.error;
        resolvePending(pendingExecutions, message.id, outcome);
        break;
      }

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
        const path = childPaths.get(message.id);
        if (message.success && message.children !== undefined && path !== undefined)
          mergeChildrenIntoModel(path, message.children);
        resolvePending(pendingChildren, message.id, {
          'success': message.success,
          'children': message.children ?? undefined,
          'error': message.error ?? undefined,
        });
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
        if (pending === undefined) {
          /** Proxies receive every acknowledgement but none of the requests, so they mirror the executor's state. */
          const forwarded = takeForwardedSpyRequest(message.id);
          if (forwarded?.type === 'setRemoteSpyEnabled' || ownsExecutorSession() === false)
            acknowledgeSpyEnabled(message);
          break;
        }
        clearTimeout(pending.timeout);
        pendingSetRemoteSpyEnabled.delete(message.id);
        acknowledgeSpyEnabled(message);
        pending.resolve({
          'success': message.success,
          'enabled': message.enabled ?? undefined,
          'source': message.source ?? undefined,
          'error': message.error ?? undefined,
        });
        break;
      }

      case 'setRemoteSpyFilterResult': {
        const forwarded = takeForwardedSpyRequest(message.id);
        if (forwarded?.type === 'setRemoteSpyFilter' && message.success) requestedSpyFilter = forwarded.filter;
        resolvePending(pendingSetRemoteSpyFilter, message.id, {
          'success': message.success,
          'error': message.error ?? undefined,
        });
        break;
      }

      case 'setRemoteSpyBlockListResult': {
        const forwarded = takeForwardedSpyRequest(message.id);
        if (forwarded?.type === 'setRemoteSpyBlockList' && message.success)
          requestedSpyBlocks = forwarded.blocks.map(entry => ({ 'type': entry.type, 'value': entry.value }));
        resolvePending(pendingSetRemoteSpyBlockList, message.id, {
          'success': message.success,
          'error': message.error ?? undefined,
        });
        break;
      }

      case 'setScriptSourceResult':
        resolvePending(pendingSetScriptSources, message.id, {
          'success': message.success,
          'error': message.error ?? undefined,
        });
        break;

      case 'remoteSpy': {
        const index =
          message.call.id === undefined ? -1 : remoteSpyCallsBuffer.findIndex(call => call.id === message.call.id);

        if (index >= 0) remoteSpyCallsBuffer[index] = message.call;
        else if (message.call.returnStatus !== 'returned' && message.call.returnStatus !== 'unavailable') {
          remoteSpyCallsBuffer.push(message.call);
          if (remoteSpyCallsBuffer.length > MAX_REMOTE_SPY_BUFFER) remoteSpyCallsBuffer.shift();
        }

        /** A completion whose call was evicted is not buffered again, but subscribers may still hold the row. */
        notify(remoteSpyCallbacks, message.call);
        break;
      }
    }
  };

  const rejectAllPending = (reason: string): void => {
    resetSpySession(reason);
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

  const requestGameTree = (): void => sendFn({ 'type': 'requestGameTree' });

  const setAutoRefresh = (enabled: boolean, intervalMs: number): void => {
    requestedAutoRefresh = { enabled, intervalMs };
    sendFn({ 'type': 'setAutoRefresh', enabled, intervalMs });
  };

  const requestProperties = (
    path: ReadonlyArray<string>,
    properties?: ReadonlyArray<string>,
  ): Promise<PropertiesResult> =>
    createRequest(
      pendingProperties,
      5000,
      id => {
        const message: Mutable<RequestPropertiesMessage> = { 'type': 'requestProperties', id, 'path': [...path] };
        if (properties !== undefined) message.properties = properties;
        return message;
      },
      TIMED_OUT,
    );

  const requestModuleInterface = (moduleRef: ModuleReference): Promise<ModuleInterfaceResult> =>
    createRequest(
      pendingModuleInterfaces,
      2000,
      id => ({ 'type': 'requestModuleInterface', id, moduleRef }),
      TIMED_OUT,
    );

  const setProperty = (
    path: ReadonlyArray<string>,
    property: string,
    value: string,
    valueType: string,
  ): Promise<SetPropertyResult> =>
    createRequest(
      pendingSetProperties,
      2000,
      id => ({ 'type': 'setProperty', id, 'path': [...path], property, value, valueType }),
      TIMED_OUT,
    );

  const teleportTo = (path: ReadonlyArray<string>): Promise<TeleportResult> =>
    createRequest(pendingTeleports, 2000, id => ({ 'type': 'teleportTo', id, 'path': [...path] }), TIMED_OUT);

  const deleteInstance = (path: ReadonlyArray<string>): Promise<DeleteResult> =>
    createRequest(pendingDeletes, 2000, id => ({ 'type': 'deleteInstance', id, 'path': [...path] }), TIMED_OUT);

  const reparentInstance = (
    sourcePath: ReadonlyArray<string>,
    targetPath: ReadonlyArray<string>,
  ): Promise<ReparentResult> =>
    createRequest(
      pendingReparents,
      2000,
      id => ({ 'type': 'reparentInstance', id, 'sourcePath': [...sourcePath], 'targetPath': [...targetPath] }),
      TIMED_OUT,
    );

  const requestChildren = async (path: ReadonlyArray<string>): Promise<ChildrenResult> => {
    const ids: string[] = [];
    try {
      return await createRequest(
        pendingChildren,
        2000,
        id => {
          ids.push(id);
          childPaths.set(id, path);
          return { 'type': 'requestChildren', id, 'path': [...path] };
        },
        TIMED_OUT,
      );
    } finally {
      for (const id of ids) childPaths.delete(id);
    }
  };

  const requestScriptSource = (path: ReadonlyArray<string>): Promise<ScriptSourceResult> =>
    createRequest(
      pendingScriptSources,
      10000,
      id => ({ 'type': 'requestScriptSource', id, 'path': [...path] }),
      TIMED_OUT,
    );

  const createInstanceFn = (
    className: string,
    parentPath: ReadonlyArray<string>,
    name?: string,
  ): Promise<CreateInstanceResult> =>
    createRequest(
      pendingCreateInstances,
      2000,
      id => {
        const message: Mutable<CreateInstanceMessage> = {
          'type': 'createInstance',
          id,
          className,
          'parentPath': [...parentPath],
        };
        if (name !== undefined) message.name = name;
        return message;
      },
      TIMED_OUT,
    );

  const cloneInstance = (path: ReadonlyArray<string>): Promise<CloneInstanceResult> =>
    createRequest(pendingCloneInstances, 2000, id => ({ 'type': 'cloneInstance', id, 'path': [...path] }), TIMED_OUT);

  const setRemoteSpyEnabledFn = (enabled: boolean, source?: RemoteSpySource): Promise<SetRemoteSpyEnabledResult> =>
    createRequest(
      pendingSetRemoteSpyEnabled,
      REMOTE_SPY_REQUEST_TIMEOUT_MS,
      id =>
        source === undefined
          ? { 'type': 'setRemoteSpyEnabled', id, enabled }
          : { 'type': 'setRemoteSpyEnabled', id, enabled, source },
      TIMED_OUT,
    );

  const setRemoteSpyFilterFn = async (filter: string): Promise<SetRemoteSpyFilterResult> => {
    const session = spySession;
    const result = await createRequest(
      pendingSetRemoteSpyFilter,
      REMOTE_SPY_REQUEST_TIMEOUT_MS,
      id => ({ 'type': 'setRemoteSpyFilter', id, filter }),
      TIMED_OUT,
    );
    if (session === spySession && result.success) requestedSpyFilter = filter;
    return result;
  };

  const setRemoteSpyBlockListFn = async (
    blocks: ReadonlyArray<RemoteSpyBlockEntry>,
  ): Promise<SetRemoteSpyBlockListResult> => {
    const session = spySession;
    const snapshot = blocks.map(entry => ({ ...entry }));
    const result = await createRequest(
      pendingSetRemoteSpyBlockList,
      REMOTE_SPY_REQUEST_TIMEOUT_MS,
      id => ({ 'type': 'setRemoteSpyBlockList', id, 'blocks': snapshot }),
      TIMED_OUT,
    );
    if (session === spySession && result.success) requestedSpyBlocks = snapshot;
    return result;
  };

  const observeForwardedRequest = (data: string): void => {
    const request = parseRemoteSpyPolicyMessage(data);
    if (request === undefined) return;
    takeForwardedSpyRequest(request.id);
    const timeout = setTimeout(() => forwardedSpyRequests.delete(request.id), REMOTE_SPY_REQUEST_TIMEOUT_MS);
    forwardedSpyRequests.set(request.id, { request, timeout });
  };

  /** The reloaded Luau module starts disabled, so policy is restored before capture hooks are reinstalled. */
  const restoreSpySession = async (session: number): Promise<void> => {
    try {
      const filter = await setRemoteSpyFilterFn(requestedSpyFilter);
      if (session !== spySession) return;
      if (filter.success === false) throw new Error(filter.error ?? 'Filter restore failed');
      const blocks = await setRemoteSpyBlockListFn(requestedSpyBlocks);
      if (session !== spySession) return;
      if (blocks.success === false) throw new Error(blocks.error ?? 'Block list restore failed');
      const enabled = await setRemoteSpyEnabledFn(requestedSpyEnabled, requestedSpySource);
      if (session !== spySession) return;
      if (enabled.success === false) throw new Error(enabled.error ?? 'Enable restore failed');
    } catch (error) {
      if (session === spySession)
        log(`[bridge] Failed to restore Remote Spy: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const setScriptSourceFn = (path: ReadonlyArray<string>, source: string): Promise<SetScriptSourceResult> =>
    createRequest(
      pendingSetScriptSources,
      10000,
      id => ({ 'type': 'setScriptSource', id, 'path': [...path], source }),
      TIMED_OUT,
    );

  return {
    liveGameModel,
    handleMessage,
    observeForwardedRequest,
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
    setAutoRefresh,
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
    'onStatusChange': (callback: (status: BridgeStatus) => void) => statusCallbacks.push(callback),
    'onRuntimeError': (callback: (error: RuntimeError) => void) => errorCallbacks.push(callback),
    'onGameTreeUpdate': (callback: (nodes: GameTreeNode[]) => void) => gameTreeCallbacks.push(callback),
    'onLog': (callback: (log: LogEntry) => void) => logCallbacks.push(callback),
    'onRemoteSpy': (callback: (call: RemoteSpyCall) => void) => remoteSpyCallbacks.push(callback),
  };
};
