import type { ClientCapabilities } from '@typings/clientType';
import type {
  GameTreeNode,
  ModuleInterface,
  ModuleReference,
  PropertyEntry,
  RemoteSpyBlockEntry,
  RemoteSpyCall,
  RuntimeError,
} from '@typings/protocol';

export interface MutableLiveGameModel {
  isConnected: boolean;
  lastUpdate: number;
  services: Map<string, GameTreeNode>;
}

export interface PendingRequest<T> {
  readonly resolve: (result: T) => void;
  readonly reject: (error: Error) => void;
  readonly timeout: ReturnType<typeof setTimeout>;
}

export interface BridgeCore {
  readonly liveGameModel: LiveGameModel;
  readonly handleMessage: (data: string) => void;
  readonly setStatus: (status: BridgeStatus) => void;
  readonly setConnected: (connected: boolean) => void;
  readonly setExecutorName: (name: string | undefined) => void;
  readonly setClientType: (type: import('@typings/clientType').ClientType | undefined) => void;
  readonly getExecutorName: () => string | undefined;
  readonly getClientType: () => import('@typings/clientType').ClientType | undefined;
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
  readonly setRemoteSpyEnabled: (enabled: boolean) => Promise<SetRemoteSpyEnabledResult>;
  readonly setRemoteSpyFilter: (filter: string) => Promise<SetRemoteSpyFilterResult>;
  readonly setRemoteSpyBlockList: (blocks: ReadonlyArray<RemoteSpyBlockEntry>) => Promise<SetRemoteSpyBlockListResult>;
  readonly onStatusChange: (callback: (status: BridgeStatus) => void) => void;
  readonly onRuntimeError: (callback: (error: RuntimeError) => void) => void;
  readonly onGameTreeUpdate: (callback: (nodes: GameTreeNode[]) => void) => void;
  readonly onLog: (callback: (log: LogEntry) => void) => void;
  readonly onRemoteSpy: (callback: (call: RemoteSpyCall) => void) => void;
}

export interface BridgeResult {
  readonly success: boolean;
  readonly error?: string | undefined;
}

export interface ExecuteResult {
  readonly success: boolean;
  readonly result?: string;
  readonly error?: RuntimeError;
}

export interface LogEntry {
  readonly level: 'info' | 'warn' | 'error';
  readonly message: string;
  readonly stack?: string | undefined;
  readonly timestamp: number;
}

export interface PropertiesResult extends BridgeResult {
  readonly properties?: ReadonlyArray<PropertyEntry> | undefined;
}

export interface ModuleInterfaceResult extends BridgeResult {
  readonly interface?: ModuleInterface | undefined;
}

export interface SetPropertyResult extends BridgeResult {}

export interface TeleportResult extends BridgeResult {}

export interface DeleteResult extends BridgeResult {}

export interface ReparentResult extends BridgeResult {}

export interface ChildrenResult extends BridgeResult {
  readonly children?: ReadonlyArray<GameTreeNode> | undefined;
}

export interface ScriptSourceResult extends BridgeResult {
  readonly source?: string | undefined;
  readonly scriptType?: string | undefined;
}

export interface CreateInstanceResult extends BridgeResult {
  readonly instanceName?: string | undefined;
}

export interface CloneInstanceResult extends BridgeResult {
  readonly cloneName?: string | undefined;
}

export interface SetRemoteSpyEnabledResult extends BridgeResult {
  readonly enabled?: boolean | undefined;
}

export interface SetRemoteSpyFilterResult extends BridgeResult {}

export interface SetRemoteSpyBlockListResult extends BridgeResult {}

export interface SetScriptSourceResult extends BridgeResult {}

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
  setRemoteSpyEnabled: (enabled: boolean) => Promise<SetRemoteSpyEnabledResult>;
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

export type BridgeStatus = 'stopped' | 'waiting' | 'connected' | 'error';

export interface LiveGameModel {
  readonly isConnected: boolean;
  readonly lastUpdate: number;
  readonly services: ReadonlyMap<string, GameTreeNode>;
  getNode: (path: string[]) => GameTreeNode | undefined;
  getChildren: (path: string[]) => ReadonlyMap<string, GameTreeNode> | undefined;
}
