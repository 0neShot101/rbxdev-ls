import type { ClientCapabilities, ClientType } from '@typings/clientType';
import type {
  GameTreeNode,
  ModuleInterface,
  ModuleReference,
  PropertyEntry,
  RemoteSpyBlockEntry,
  RemoteSpyCall,
  RemoteSpyPolicyMessage,
  RemoteSpySource,
  RuntimeError,
} from '@typings/protocol';

/** Writable view of the live game model, owned by the bridge core that receives tree snapshots. */
export interface MutableLiveGameModel {
  isConnected: boolean;
  lastUpdate: number;
  services: Map<string, GameTreeNode>;
}

/** A live game model plus the operations its owning bridge uses to change it. */
export interface LiveGameModelHandle {
  readonly model: LiveGameModel;
  readonly update: (nodes: GameTreeNode[]) => void;
  readonly mergeChildren: (path: ReadonlyArray<string>, children: GameTreeNode[]) => void;
  readonly setConnected: (connected: boolean) => void;
  readonly clear: () => void;
}

/** A request awaiting its correlated reply from the connected client, with its timeout handle. */
export interface PendingRequest<T> {
  readonly resolve: (result: T) => void;
  readonly reject: (error: Error) => void;
  readonly timeout: ReturnType<typeof setTimeout>;
}

/** A Remote Spy policy request a proxy forwarded through the primary bridge, awaiting the executor's acknowledgement. */
export interface ForwardedSpyRequest {
  readonly request: RemoteSpyPolicyMessage;
  readonly timeout: ReturnType<typeof setTimeout>;
}

/** Transport-independent bridge state machine: correlates requests with replies and dispatches client messages. */
export interface BridgeCore {
  readonly liveGameModel: LiveGameModel;
  readonly handleMessage: (data: string) => void;
  /** Records a proxy-forwarded spy policy request so its acknowledgement updates the policy replayed after reload. */
  readonly observeForwardedRequest: (data: string) => void;
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
  readonly setAutoRefresh: (enabled: boolean, intervalMs: number) => void;
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
  readonly setRemoteSpyEnabled: (enabled: boolean, source?: RemoteSpySource) => Promise<SetRemoteSpyEnabledResult>;
  readonly setRemoteSpyFilter: (filter: string) => Promise<SetRemoteSpyFilterResult>;
  readonly setRemoteSpyBlockList: (blocks: ReadonlyArray<RemoteSpyBlockEntry>) => Promise<SetRemoteSpyBlockListResult>;
  readonly onStatusChange: (callback: (status: BridgeStatus) => void) => void;
  readonly onRuntimeError: (callback: (error: RuntimeError) => void) => void;
  readonly onGameTreeUpdate: (callback: (nodes: GameTreeNode[]) => void) => void;
  readonly onLog: (callback: (log: LogEntry) => void) => void;
  readonly onRemoteSpy: (callback: (call: RemoteSpyCall) => void) => void;
}

/** Common outcome of a bridge request: success flag plus an optional client-reported error. */
export interface BridgeResult {
  readonly success: boolean;
  readonly error?: string | undefined;
}

/** Outcome of executing code on the client; failures carry a structured runtime error. */
export interface ExecuteResult {
  readonly success: boolean;
  readonly result?: string;
  readonly error?: RuntimeError;
}

/** One console log line forwarded from the client. */
export interface LogEntry {
  readonly level: 'info' | 'warn' | 'error';
  readonly message: string;
  readonly stack?: string | undefined;
  readonly timestamp: number;
}

/** Outcome of a property listing request. */
export interface PropertiesResult extends BridgeResult {
  readonly properties?: ReadonlyArray<PropertyEntry> | undefined;
}

/** Outcome of a module interface inspection request. */
export interface ModuleInterfaceResult extends BridgeResult {
  readonly interface?: ModuleInterface | undefined;
}

/** Outcome of a property assignment request. */
export interface SetPropertyResult extends BridgeResult {}

/** Outcome of a teleport request. */
export interface TeleportResult extends BridgeResult {}

/** Outcome of an instance deletion request. */
export interface DeleteResult extends BridgeResult {}

/** Outcome of an instance reparent request. */
export interface ReparentResult extends BridgeResult {}

/** Outcome of a children listing request. */
export interface ChildrenResult extends BridgeResult {
  readonly children?: ReadonlyArray<GameTreeNode> | undefined;
}

/** Outcome of a script source read request. */
export interface ScriptSourceResult extends BridgeResult {
  readonly source?: string | undefined;
  readonly scriptType?: string | undefined;
}

/** Outcome of an instance creation request. */
export interface CreateInstanceResult extends BridgeResult {
  readonly instanceName?: string | undefined;
}

/** Outcome of an instance clone request. */
export interface CloneInstanceResult extends BridgeResult {
  readonly cloneName?: string | undefined;
}

/** Outcome of toggling the remote spy. */
export interface SetRemoteSpyEnabledResult extends BridgeResult {
  readonly enabled?: boolean | undefined;
  readonly source?: RemoteSpySource | undefined;
}

/** Outcome of setting the remote spy filter. */
export interface SetRemoteSpyFilterResult extends BridgeResult {}

/** Outcome of replacing the remote spy block list. */
export interface SetRemoteSpyBlockListResult extends BridgeResult {}

/** Outcome of a script source write request. */
export interface SetScriptSourceResult extends BridgeResult {}

/** Public bridge surface shared by the language server, MCP server and proxy bridges. */
export interface ExecutorBridge {
  readonly isRunning: boolean;
  readonly isConnected: boolean;
  readonly executorName: string | undefined;
  readonly clientType: 'executor' | 'studio' | undefined;
  readonly clientCapabilities: ClientCapabilities | undefined;
  readonly liveGameModel: LiveGameModel;
  start: (port: number) => void;
  stop: () => void;
  execute: (code: string) => Promise<ExecuteResult>;
  requestGameTree: () => void;
  setAutoRefresh: (enabled: boolean, intervalMs: number) => void;
  requestProperties: (path: ReadonlyArray<string>, properties?: ReadonlyArray<string>) => Promise<PropertiesResult>;
  requestModuleInterface: (moduleRef: ModuleReference) => Promise<ModuleInterfaceResult>;
  setProperty: (
    path: ReadonlyArray<string>,
    property: string,
    value: string,
    valueType: string,
  ) => Promise<SetPropertyResult>;
  teleportTo: (path: ReadonlyArray<string>) => Promise<TeleportResult>;
  deleteInstance: (path: ReadonlyArray<string>) => Promise<DeleteResult>;
  reparentInstance: (sourcePath: ReadonlyArray<string>, targetPath: ReadonlyArray<string>) => Promise<ReparentResult>;
  requestChildren: (path: ReadonlyArray<string>) => Promise<ChildrenResult>;
  requestScriptSource: (path: ReadonlyArray<string>) => Promise<ScriptSourceResult>;
  createInstance: (
    className: string,
    parentPath: ReadonlyArray<string>,
    name?: string,
  ) => Promise<CreateInstanceResult>;
  cloneInstance: (path: ReadonlyArray<string>) => Promise<CloneInstanceResult>;
  setScriptSource: (path: ReadonlyArray<string>, source: string) => Promise<SetScriptSourceResult>;
  setRemoteSpyEnabled: (enabled: boolean, source?: RemoteSpySource) => Promise<SetRemoteSpyEnabledResult>;
  setRemoteSpyFilter: (filter: string) => Promise<SetRemoteSpyFilterResult>;
  setRemoteSpyBlockList: (blocks: ReadonlyArray<RemoteSpyBlockEntry>) => Promise<SetRemoteSpyBlockListResult>;
  readonly isRemoteSpyEnabled: boolean;
  readonly remoteSpyCalls: ReadonlyArray<RemoteSpyCall>;
  onStatusChange: (callback: (status: BridgeStatus) => void) => void;
  onRuntimeError: (callback: (error: RuntimeError) => void) => void;
  onGameTreeUpdate: (callback: (nodes: GameTreeNode[]) => void) => void;
  onLog: (callback: (log: LogEntry) => void) => void;
  onRemoteSpy: (callback: (call: RemoteSpyCall) => void) => void;
}

/** Lifecycle state of the bridge listener or proxy connection. */
export type BridgeStatus = 'stopped' | 'waiting' | 'connected' | 'error';

/** Read-only snapshot of the connected game's instance tree. */
export interface LiveGameModel {
  readonly isConnected: boolean;
  readonly lastUpdate: number;
  readonly services: ReadonlyMap<string, GameTreeNode>;
  getNode: (path: string[]) => GameTreeNode | undefined;
  getChildren: (path: string[]) => ReadonlyMap<string, GameTreeNode> | undefined;
}
