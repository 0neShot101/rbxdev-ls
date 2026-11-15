/** Any JSON value a client may send where the protocol does not fix a shape. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | ReadonlyArray<JsonValue>
  | { readonly [key: string]: JsonValue };

/** One instance in a live game tree snapshot; children are present only when expanded. */
export interface GameTreeNode {
  readonly name: string;
  readonly className: string;
  readonly children?: GameTreeNode[];
  readonly hasChildren?: boolean;
}

/** A Luau runtime error, with source position when the client could parse one. */
export interface RuntimeError {
  readonly message: string;
  readonly file?: string;
  readonly line?: number;
  readonly stack?: string;
}

/** Asks the client to run Luau code and reply with an execute result of the same id. */
export interface ExecuteMessage {
  readonly type: 'execute';
  readonly id: string;
  readonly code: string;
}

/** Asks the client to resend the game tree, optionally limited to named services. */
export interface RequestGameTreeMessage {
  readonly type: 'requestGameTree';
  readonly services?: string[];
}

/** Toggles periodic game tree pushes from the client. */
export interface SetAutoRefreshMessage {
  readonly type: 'setAutoRefresh';
  readonly enabled: boolean;
  readonly intervalMs: number;
}

/** Asks for property values of the instance at a path. */
export interface RequestPropertiesMessage {
  readonly type: 'requestProperties';
  readonly id: string;
  readonly path: ReadonlyArray<string>;
  readonly properties?: ReadonlyArray<string>;
}

/** Identifies a module by instance path or by published asset id. */
export type ModuleReference =
  | { readonly kind: 'path'; readonly path: ReadonlyArray<string> }
  | { readonly kind: 'assetId'; readonly id: number };

/** Asks the client to require a module and describe its exported interface. */
export interface RequestModuleInterfaceMessage {
  readonly type: 'requestModuleInterface';
  readonly id: string;
  readonly moduleRef: ModuleReference;
}

/** Asks the client to assign a serialized value to an instance property. */
export interface SetPropertyMessage {
  readonly type: 'setProperty';
  readonly id: string;
  readonly path: ReadonlyArray<string>;
  readonly property: string;
  readonly value: string;
  readonly valueType: string;
}

/** Asks the client to move the local character to an instance. */
export interface TeleportToMessage {
  readonly type: 'teleportTo';
  readonly id: string;
  readonly path: ReadonlyArray<string>;
}

/** Asks the client to destroy the instance at a path. */
export interface DeleteInstanceMessage {
  readonly type: 'deleteInstance';
  readonly id: string;
  readonly path: ReadonlyArray<string>;
}

/** Asks the client to reparent one instance under another. */
export interface ReparentInstanceMessage {
  readonly type: 'reparentInstance';
  readonly id: string;
  readonly sourcePath: ReadonlyArray<string>;
  readonly targetPath: ReadonlyArray<string>;
}

/** Asks the client for the direct children of an instance. */
export interface RequestChildrenMessage {
  readonly type: 'requestChildren';
  readonly id: string;
  readonly path: ReadonlyArray<string>;
}

/** Asks the client for a script's source or decompiled source. */
export interface RequestScriptSourceMessage {
  readonly type: 'requestScriptSource';
  readonly id: string;
  readonly path: ReadonlyArray<string>;
}

/** Asks the client to create an instance under a parent. */
export interface CreateInstanceMessage {
  readonly type: 'createInstance';
  readonly id: string;
  readonly className: string;
  readonly parentPath: ReadonlyArray<string>;
  readonly name?: string;
}

/** Asks the client to clone the instance at a path. */
export interface CloneInstanceMessage {
  readonly type: 'cloneInstance';
  readonly id: string;
  readonly path: ReadonlyArray<string>;
}

/** Which caller origins the remote spy captures. */
export type RemoteSpySource = 'game' | 'executor' | 'both';

/** Turns remote call capture on or off. */
export interface SetRemoteSpyEnabledMessage {
  readonly type: 'setRemoteSpyEnabled';
  readonly id: string;
  readonly enabled: boolean;
  readonly source?: RemoteSpySource;
}

/** Sets the remote name filter for captured calls. */
export interface SetRemoteSpyFilterMessage {
  readonly type: 'setRemoteSpyFilter';
  readonly id: string;
  readonly filter: string;
}

/** One remote spy block rule, matching a remote by full path or by name. */
export interface RemoteSpyBlockEntry {
  readonly type: 'path' | 'name';
  readonly value: string;
}

/** Replaces the remote spy block list. */
export interface SetRemoteSpyBlockListMessage {
  readonly type: 'setRemoteSpyBlockList';
  readonly id: string;
  readonly blocks: ReadonlyArray<RemoteSpyBlockEntry>;
}

/** A request that changes the Remote Spy policy shared by every editor attached to one executor socket. */
export type RemoteSpyPolicyMessage =
  | SetRemoteSpyEnabledMessage
  | SetRemoteSpyFilterMessage
  | SetRemoteSpyBlockListMessage;

/** Asks Studio to overwrite a script's source. */
export interface SetScriptSourceMessage {
  readonly type: 'setScriptSource';
  readonly id: string;
  readonly path: ReadonlyArray<string>;
  readonly source: string;
}

/** Every message the language server sends to an executor or Studio client. */
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

/** Handshake sent by a client once its WebSocket opens. */
export interface ConnectedMessage {
  readonly type: 'connected';
  readonly executorName: string;
  readonly version?: string;
  readonly clientType?: 'executor' | 'studio';
}

/** Reply to an execute message. */
export interface ExecuteResultMessage {
  readonly type: 'executeResult';
  readonly id: string;
  readonly success: boolean;
  readonly result?: JsonValue;
  readonly error?: RuntimeError;
}

/** Full game tree snapshot pushed by the client. */
export interface GameTreeMessage {
  readonly type: 'gameTree';
  readonly data: GameTreeNode[];
}

/** Unsolicited runtime error raised inside client-executed code. */
export interface RuntimeErrorMessage {
  readonly type: 'runtimeError';
  readonly error: RuntimeError;
}

/** Console output captured by the client. */
export interface LogMessage {
  readonly type: 'log';
  readonly level: 'info' | 'warn' | 'error';
  readonly message: string;
  readonly stack?: string;
  readonly timestamp: number;
}

/** One serialized instance property value. */
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

/** Reply to a properties request. */
export interface PropertiesResultMessage {
  readonly type: 'propertiesResult';
  readonly id: string;
  readonly success: boolean;
  readonly properties?: ReadonlyArray<PropertyEntry>;
  readonly error?: string;
}

/** One exported member of a reflected module. */
export interface ModuleProperty {
  readonly name: string;
  readonly valueKind: 'function' | 'table' | 'string' | 'number' | 'boolean' | 'other';
  readonly functionArity?: number;
}

/** Shape of a required module as reflected by the client. */
export interface ModuleInterface {
  readonly kind: 'table' | 'function' | 'other';
  readonly properties?: ReadonlyArray<ModuleProperty>;
}

/** Reply to a module interface request. */
export interface ModuleInterfaceMessage {
  readonly type: 'moduleInterface';
  readonly id: string;
  readonly success: boolean;
  readonly interface?: ModuleInterface;
  readonly error?: string;
}

/** Reply to a set property request. */
export interface SetPropertyResultMessage {
  readonly type: 'setPropertyResult';
  readonly id: string;
  readonly success: boolean;
  readonly error?: string;
}

/** Reply to a teleport request. */
export interface TeleportToResultMessage {
  readonly type: 'teleportToResult';
  readonly id: string;
  readonly success: boolean;
  readonly error?: string;
}

/** Reply to a delete instance request. */
export interface DeleteInstanceResultMessage {
  readonly type: 'deleteInstanceResult';
  readonly id: string;
  readonly success: boolean;
  readonly error?: string;
}

/** Reply to a reparent instance request. */
export interface ReparentInstanceResultMessage {
  readonly type: 'reparentInstanceResult';
  readonly id: string;
  readonly success: boolean;
  readonly error?: string;
}

/** Reply to a children request. */
export interface ChildrenResultMessage {
  readonly type: 'childrenResult';
  readonly id: string;
  readonly success: boolean;
  readonly children?: GameTreeNode[];
  readonly error?: string;
}

/** Reply to a script source request. */
export interface ScriptSourceResultMessage {
  readonly type: 'scriptSourceResult';
  readonly id: string;
  readonly success: boolean;
  readonly source?: string;
  readonly scriptType?: string;
  readonly error?: string;
}

/** Reply to a create instance request. */
export interface CreateInstanceResultMessage {
  readonly type: 'createInstanceResult';
  readonly id: string;
  readonly success: boolean;
  readonly instanceName?: string;
  readonly error?: string;
}

/** Reply to a clone instance request. */
export interface CloneInstanceResultMessage {
  readonly type: 'cloneInstanceResult';
  readonly id: string;
  readonly success: boolean;
  readonly cloneName?: string;
  readonly error?: string;
}

/** Reply to a remote spy toggle, echoing the resulting state. */
export interface SetRemoteSpyEnabledResultMessage {
  readonly type: 'setRemoteSpyEnabledResult';
  readonly id: string;
  readonly success: boolean;
  readonly enabled?: boolean;
  readonly source?: RemoteSpySource;
  readonly error?: string;
}

/** Reply to a remote spy filter update. */
export interface SetRemoteSpyFilterResultMessage {
  readonly type: 'setRemoteSpyFilterResult';
  readonly id: string;
  readonly success: boolean;
  readonly error?: string;
}

/** Reply to a remote spy block list update. */
export interface SetRemoteSpyBlockListResultMessage {
  readonly type: 'setRemoteSpyBlockListResult';
  readonly id: string;
  readonly success: boolean;
  readonly error?: string;
}

/** One captured remote call with generated replay code. */
export interface RemoteSpyCall {
  readonly source?: 'game' | 'executor' | 'unknown';
  readonly id?: string;
  readonly returnStatus?: 'pending' | 'returned' | 'blocked' | 'unavailable';
  readonly returns?: string;
  readonly returnCount?: number;
  readonly remoteName: string;
  readonly remotePath: ReadonlyArray<string>;
  readonly remoteType: string;
  readonly method: string;
  readonly arguments: string;
  readonly code: string;
  readonly timestamp: number;
}

/** Reply to a set script source request. */
export interface SetScriptSourceResultMessage {
  readonly type: 'setScriptSourceResult';
  readonly id: string;
  readonly success: boolean;
  readonly error?: string;
}

/** Captured remote call pushed by the client. */
export interface RemoteSpyMessage {
  readonly type: 'remoteSpy';
  readonly call: RemoteSpyCall;
}

/** Every message an executor or Studio client sends to the language server. */
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

/** First frame a proxy bridge sends to the primary bridge. */
export interface ProxyHandshakeMessage {
  readonly type: 'proxyHandshake';
}

/** Primary bridge greeting to a proxy, describing the current client connection. */
export interface ProxyWelcomeMessage {
  readonly type: 'proxyWelcome';
  readonly isConnected: boolean;
  readonly executorName: string | undefined;
  readonly clientType?: 'executor' | 'studio';
}

/** Primary bridge notice that its client connected or disconnected. */
export interface ProxyStatusChangeMessage {
  readonly type: 'proxyStatusChange';
  readonly status: 'connected' | 'disconnected';
  readonly executorName?: string;
  readonly clientType?: 'executor' | 'studio';
}

/** Every bridge-level message a primary bridge sends to its proxies. */
export type ProxyMessage = ProxyWelcomeMessage | ProxyStatusChangeMessage;
