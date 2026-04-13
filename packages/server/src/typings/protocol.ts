export type MessageRecord = Record<string, unknown>;

export interface GameTreeNode {
  readonly name: string;
  readonly className: string;
  readonly children?: GameTreeNode[];
  readonly hasChildren?: boolean;
}

export interface RuntimeError {
  readonly message: string;
  readonly file?: string;
  readonly line?: number;
  readonly stack?: string;
}

export interface ExecuteMessage {
  readonly type: 'execute';
  readonly id: string;
  readonly code: string;
}

export interface RequestGameTreeMessage {
  readonly type: 'requestGameTree';
  readonly services?: string[];
}

export interface SetAutoRefreshMessage {
  readonly type: 'setAutoRefresh';
  readonly enabled: boolean;
  readonly intervalMs: number;
}

export interface RequestPropertiesMessage {
  readonly type: 'requestProperties';
  readonly id: string;
  readonly path: ReadonlyArray<string>;
  readonly properties?: ReadonlyArray<string>;
}

export type ModuleReference =
  | { readonly kind: 'path'; readonly path: ReadonlyArray<string> }
  | { readonly kind: 'assetId'; readonly id: number };

export interface RequestModuleInterfaceMessage {
  readonly type: 'requestModuleInterface';
  readonly id: string;
  readonly moduleRef: ModuleReference;
}

export interface SetPropertyMessage {
  readonly type: 'setProperty';
  readonly id: string;
  readonly path: ReadonlyArray<string>;
  readonly property: string;
  readonly value: string;
  readonly valueType: string;
}

export interface TeleportToMessage {
  readonly type: 'teleportTo';
  readonly id: string;
  readonly path: ReadonlyArray<string>;
}

export interface DeleteInstanceMessage {
  readonly type: 'deleteInstance';
  readonly id: string;
  readonly path: ReadonlyArray<string>;
}

export interface ReparentInstanceMessage {
  readonly type: 'reparentInstance';
  readonly id: string;
  readonly sourcePath: ReadonlyArray<string>;
  readonly targetPath: ReadonlyArray<string>;
}

export interface RequestChildrenMessage {
  readonly type: 'requestChildren';
  readonly id: string;
  readonly path: ReadonlyArray<string>;
}

export interface RequestScriptSourceMessage {
  readonly type: 'requestScriptSource';
  readonly id: string;
  readonly path: ReadonlyArray<string>;
}

export interface CreateInstanceMessage {
  readonly type: 'createInstance';
  readonly id: string;
  readonly className: string;
  readonly parentPath: ReadonlyArray<string>;
  readonly name?: string;
}

export interface CloneInstanceMessage {
  readonly type: 'cloneInstance';
  readonly id: string;
  readonly path: ReadonlyArray<string>;
}

export interface SetRemoteSpyEnabledMessage {
  readonly type: 'setRemoteSpyEnabled';
  readonly id: string;
  readonly enabled: boolean;
}

export interface SetRemoteSpyFilterMessage {
  readonly type: 'setRemoteSpyFilter';
  readonly id: string;
  readonly filter: string;
}

export interface RemoteSpyBlockEntry {
  readonly type: 'path' | 'name';
  readonly value: string;
}

export interface SetRemoteSpyBlockListMessage {
  readonly type: 'setRemoteSpyBlockList';
  readonly id: string;
  readonly blocks: ReadonlyArray<RemoteSpyBlockEntry>;
}

export interface SetScriptSourceMessage {
  readonly type: 'setScriptSource';
  readonly id: string;
  readonly path: ReadonlyArray<string>;
  readonly source: string;
}

export type ServerMessage =
  | ExecuteMessage
  | RequestGameTreeMessage
  | SetAutoRefreshMessage
  | RequestPropertiesMessage
  | RequestModuleInterfaceMessage
  | SetPropertyMessage
  | TeleportToMessage
  | DeleteInstanceMessage
  | ReparentInstanceMessage
  | RequestChildrenMessage
  | RequestScriptSourceMessage
  | CreateInstanceMessage
  | CloneInstanceMessage
  | SetRemoteSpyEnabledMessage
  | SetRemoteSpyFilterMessage
  | SetRemoteSpyBlockListMessage
  | SetScriptSourceMessage;

export interface ConnectedMessage {
  readonly type: 'connected';
  readonly executorName: string;
  readonly version: string;
  readonly clientType?: 'executor' | 'studio';
}

export interface ExecuteResultMessage {
  readonly type: 'executeResult';
  readonly id: string;
  readonly success: boolean;
  readonly result?: string;
  readonly error?: RuntimeError;
}

export interface GameTreeMessage {
  readonly type: 'gameTree';
  readonly data: GameTreeNode[];
}

export interface RuntimeErrorMessage {
  readonly type: 'runtimeError';
  readonly error: RuntimeError;
}

export interface LogMessage {
  readonly type: 'log';
  readonly level: 'info' | 'warn' | 'error';
  readonly message: string;
  readonly stack?: string;
  readonly timestamp: number;
}

export interface PropertyEntry {
  readonly name: string;
  readonly valueType:
    | 'string'
    | 'number'
    | 'boolean'
    | 'nil'
    | 'Instance'
    | 'Vector3'
    | 'CFrame'
    | 'Color3'
    | 'UDim2'
    | 'other';
  readonly value: string;
  readonly className?: string;
}

export interface PropertiesResultMessage {
  readonly type: 'propertiesResult';
  readonly id: string;
  readonly success: boolean;
  readonly properties?: ReadonlyArray<PropertyEntry>;
  readonly error?: string;
}

export interface ModuleProperty {
  readonly name: string;
  readonly valueKind: 'function' | 'table' | 'string' | 'number' | 'boolean' | 'other';
  readonly functionArity?: number;
}

export interface ModuleInterface {
  readonly kind: 'table' | 'function' | 'other';
  readonly properties?: ReadonlyArray<ModuleProperty>;
}

export interface ModuleInterfaceMessage {
  readonly type: 'moduleInterface';
  readonly id: string;
  readonly success: boolean;
  readonly interface?: ModuleInterface;
  readonly error?: string;
}

export interface SetPropertyResultMessage {
  readonly type: 'setPropertyResult';
  readonly id: string;
  readonly success: boolean;
  readonly error?: string;
}

export interface TeleportToResultMessage {
  readonly type: 'teleportToResult';
  readonly id: string;
  readonly success: boolean;
  readonly error?: string;
}

export interface DeleteInstanceResultMessage {
  readonly type: 'deleteInstanceResult';
  readonly id: string;
  readonly success: boolean;
  readonly error?: string;
}

export interface ReparentInstanceResultMessage {
  readonly type: 'reparentInstanceResult';
  readonly id: string;
  readonly success: boolean;
  readonly error?: string;
}

export interface ChildrenResultMessage {
  readonly type: 'childrenResult';
  readonly id: string;
  readonly success: boolean;
  readonly children?: GameTreeNode[];
  readonly error?: string;
}

export interface ScriptSourceResultMessage {
  readonly type: 'scriptSourceResult';
  readonly id: string;
  readonly success: boolean;
  readonly source?: string;
  readonly scriptType?: string;
  readonly error?: string;
}

export interface CreateInstanceResultMessage {
  readonly type: 'createInstanceResult';
  readonly id: string;
  readonly success: boolean;
  readonly instanceName?: string;
  readonly error?: string;
}

export interface CloneInstanceResultMessage {
  readonly type: 'cloneInstanceResult';
  readonly id: string;
  readonly success: boolean;
  readonly cloneName?: string;
  readonly error?: string;
}

export interface SetRemoteSpyEnabledResultMessage {
  readonly type: 'setRemoteSpyEnabledResult';
  readonly id: string;
  readonly success: boolean;
  readonly enabled?: boolean;
  readonly error?: string;
}

export interface SetRemoteSpyFilterResultMessage {
  readonly type: 'setRemoteSpyFilterResult';
  readonly id: string;
  readonly success: boolean;
  readonly error?: string;
}

export interface SetRemoteSpyBlockListResultMessage {
  readonly type: 'setRemoteSpyBlockListResult';
  readonly id: string;
  readonly success: boolean;
  readonly error?: string;
}

export interface RemoteSpyCall {
  readonly remoteName: string;
  readonly remotePath: ReadonlyArray<string>;
  readonly remoteType: string;
  readonly method: string;
  readonly arguments: string;
  readonly code: string;
  readonly timestamp: number;
}

export interface SetScriptSourceResultMessage {
  readonly type: 'setScriptSourceResult';
  readonly id: string;
  readonly success: boolean;
  readonly error?: string;
}

export interface RemoteSpyMessage {
  readonly type: 'remoteSpy';
  readonly call: RemoteSpyCall;
}

export type ClientMessage =
  | ConnectedMessage
  | ExecuteResultMessage
  | GameTreeMessage
  | RuntimeErrorMessage
  | LogMessage
  | PropertiesResultMessage
  | ModuleInterfaceMessage
  | SetPropertyResultMessage
  | TeleportToResultMessage
  | DeleteInstanceResultMessage
  | ReparentInstanceResultMessage
  | ChildrenResultMessage
  | ScriptSourceResultMessage
  | CreateInstanceResultMessage
  | CloneInstanceResultMessage
  | SetRemoteSpyEnabledResultMessage
  | SetRemoteSpyFilterResultMessage
  | SetRemoteSpyBlockListResultMessage
  | SetScriptSourceResultMessage
  | RemoteSpyMessage;

export interface ProxyHandshakeMessage {
  readonly type: 'proxyHandshake';
}

export interface ProxyWelcomeMessage {
  readonly type: 'proxyWelcome';
  readonly isConnected: boolean;
  readonly executorName: string | undefined;
  readonly clientType?: 'executor' | 'studio';
}

export interface ProxyStatusChangeMessage {
  readonly type: 'proxyStatusChange';
  readonly status: 'connected' | 'disconnected';
  readonly executorName?: string;
  readonly clientType?: 'executor' | 'studio';
}
