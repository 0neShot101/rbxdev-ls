import type { ClientCapabilities } from './clientType';
import type {
  GameTreeNode,
  ModuleInterface,
  ModuleReference,
  PropertyEntry,
  RemoteSpyBlockEntry,
  RemoteSpyCall,
  RuntimeError,
} from './protocol';

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
