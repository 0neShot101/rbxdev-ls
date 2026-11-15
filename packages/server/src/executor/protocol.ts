import type {
  ChildrenResultMessage,
  ClientMessage,
  CloneInstanceResultMessage,
  ConnectedMessage,
  CreateInstanceResultMessage,
  DeleteInstanceResultMessage,
  ExecuteResultMessage,
  GameTreeMessage,
  LogMessage,
  ModuleInterfaceMessage,
  PropertiesResultMessage,
  ProxyHandshakeMessage,
  ProxyMessage,
  ProxyStatusChangeMessage,
  ProxyWelcomeMessage,
  RemoteSpyBlockEntry,
  RemoteSpyMessage,
  RemoteSpyPolicyMessage,
  ReparentInstanceResultMessage,
  RuntimeErrorMessage,
  ScriptSourceResultMessage,
  SetPropertyResultMessage,
  SetRemoteSpyBlockListResultMessage,
  SetRemoteSpyEnabledResultMessage,
  SetRemoteSpyFilterResultMessage,
  SetScriptSourceResultMessage,
  TeleportToResultMessage,
  JsonValue,
} from '@typings/protocol';

/**
 * Decodes a WebSocket text frame.
 * @param data - Frame payload as delivered by `ws`.
 */
export const frameText = (data: Buffer | string): string => (Buffer.isBuffer(data) ? data.toString('utf-8') : data);

const isObject = (value: unknown): value is object => typeof value === 'object' && value !== null;
const isString = (value: unknown): value is string => typeof value === 'string';
const isNumber = (value: unknown): value is number => typeof value === 'number';
const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';
const isArray = (value: unknown): value is ReadonlyArray<JsonValue> => Array.isArray(value);
const isJsonValue = (value: unknown): value is JsonValue =>
  value === null || isString(value) || isNumber(value) || isBoolean(value) || isObject(value);
const isClientType = (value: unknown): value is 'executor' | 'studio' => value === 'executor' || value === 'studio';
const isLogLevel = (value: unknown): value is LogMessage['level'] =>
  value === 'info' || value === 'warn' || value === 'error';
const isStatus = (value: unknown): value is ProxyStatusChangeMessage['status'] =>
  value === 'connected' || value === 'disconnected';

const hasField = <Key extends string, Value>(
  value: unknown,
  key: Key,
  guard: (field: unknown) => field is Value,
): value is Record<Key, Value> => isObject(value) && guard(Object.getOwnPropertyDescriptor(value, key)?.value);

const hasOptionalField = <Key extends string, Value>(
  value: unknown,
  key: Key,
  guard: (field: unknown) => field is Value,
): value is Partial<Record<Key, Value>> => {
  if (isObject(value) === false) return false;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor === undefined || descriptor.value === undefined || guard(descriptor.value);
};

const hasType = <Name extends string>(value: unknown, name: Name): value is { readonly 'type': Name } =>
  isObject(value) && 'type' in value && value.type === name;

const isResult = <Name extends string>(
  value: unknown,
  name: Name,
): value is { readonly 'type': Name; readonly id: string; readonly success: boolean; readonly error?: string } =>
  hasType(value, name) &&
  hasField(value, 'id', isString) &&
  hasField(value, 'success', isBoolean) &&
  hasOptionalField(value, 'error', isString);

/** Type guard for the initial connected handshake message; executors without a reported version omit it. */
export const isConnectedMessage = (value: unknown): value is ConnectedMessage =>
  hasType(value, 'connected') &&
  hasField(value, 'executorName', isString) &&
  hasOptionalField(value, 'version', isString) &&
  hasOptionalField(value, 'clientType', isClientType);

/** Type guard for an execute result message; its result may be any JSON value and its error is structured. */
export const isExecuteResultMessage = (value: unknown): value is ExecuteResultMessage =>
  hasType(value, 'executeResult') &&
  hasField(value, 'id', isString) &&
  hasField(value, 'success', isBoolean) &&
  hasOptionalField(value, 'result', isJsonValue) &&
  hasOptionalField(value, 'error', isObject);

/** Type guard for a game tree snapshot message. */
export const isGameTreeMessage = (value: unknown): value is GameTreeMessage =>
  hasType(value, 'gameTree') && hasField(value, 'data', isArray);

/** Type guard for a runtime error notification message. */
export const isRuntimeErrorMessage = (value: unknown): value is RuntimeErrorMessage =>
  hasType(value, 'runtimeError') && hasField(value, 'error', isObject);

/** Type guard for a console log message (print/warn/error). */
export const isLogMessage = (value: unknown): value is LogMessage =>
  hasType(value, 'log') &&
  hasField(value, 'level', isLogLevel) &&
  hasField(value, 'message', isString) &&
  hasOptionalField(value, 'stack', isString) &&
  hasField(value, 'timestamp', isNumber);

/** Type guard for a properties result message. */
export const isPropertiesResultMessage = (value: unknown): value is PropertiesResultMessage =>
  isResult(value, 'propertiesResult') && hasOptionalField(value, 'properties', isArray);
/** Type guard for a module interface result message. */
export const isModuleInterfaceMessage = (value: unknown): value is ModuleInterfaceMessage =>
  isResult(value, 'moduleInterface') && hasOptionalField(value, 'interface', isObject);
/** Type guard for a set property result message. */
export const isSetPropertyResultMessage = (value: unknown): value is SetPropertyResultMessage =>
  isResult(value, 'setPropertyResult');
/** Type guard for a teleport result message. */
export const isTeleportToResultMessage = (value: unknown): value is TeleportToResultMessage =>
  isResult(value, 'teleportToResult');
/** Type guard for a delete instance result message. */
export const isDeleteInstanceResultMessage = (value: unknown): value is DeleteInstanceResultMessage =>
  isResult(value, 'deleteInstanceResult');
/** Type guard for a reparent instance result message. */
export const isReparentInstanceResultMessage = (value: unknown): value is ReparentInstanceResultMessage =>
  isResult(value, 'reparentInstanceResult');
/** Type guard for a children result message. */
export const isChildrenResultMessage = (value: unknown): value is ChildrenResultMessage =>
  isResult(value, 'childrenResult') && hasOptionalField(value, 'children', isArray);
/** Type guard for a script source result message. */
export const isScriptSourceResultMessage = (value: unknown): value is ScriptSourceResultMessage =>
  isResult(value, 'scriptSourceResult') &&
  hasOptionalField(value, 'source', isString) &&
  hasOptionalField(value, 'scriptType', isString);
/** Type guard for a create instance result message. */
export const isCreateInstanceResultMessage = (value: unknown): value is CreateInstanceResultMessage =>
  isResult(value, 'createInstanceResult') && hasOptionalField(value, 'instanceName', isString);
/** Type guard for a clone instance result message. */
export const isCloneInstanceResultMessage = (value: unknown): value is CloneInstanceResultMessage =>
  isResult(value, 'cloneInstanceResult') && hasOptionalField(value, 'cloneName', isString);
const isRemoteSpySource = (value: unknown): value is 'game' | 'executor' | 'both' =>
  value === 'game' || value === 'executor' || value === 'both';

/** Type guard for a set remote spy enabled result message. */
export const isSetRemoteSpyEnabledResultMessage = (value: unknown): value is SetRemoteSpyEnabledResultMessage =>
  isResult(value, 'setRemoteSpyEnabledResult') &&
  hasOptionalField(value, 'enabled', isBoolean) &&
  hasOptionalField(value, 'source', isRemoteSpySource);
/** Type guard for a set remote spy filter result message. */
export const isSetRemoteSpyFilterResultMessage = (value: unknown): value is SetRemoteSpyFilterResultMessage =>
  isResult(value, 'setRemoteSpyFilterResult');
/** Type guard for a set remote spy block list result message. */
export const isSetRemoteSpyBlockListResultMessage = (value: unknown): value is SetRemoteSpyBlockListResultMessage =>
  isResult(value, 'setRemoteSpyBlockListResult');
/** Type guard for a set script source result message. */
export const isSetScriptSourceResultMessage = (value: unknown): value is SetScriptSourceResultMessage =>
  isResult(value, 'setScriptSourceResult');

/** Type guard for a remote spy call capture message. */
export const isRemoteSpyMessage = (value: unknown): value is RemoteSpyMessage =>
  hasType(value, 'remoteSpy') && hasField(value, 'call', isObject);

const clientMessageGuards: ReadonlyArray<(value: unknown) => value is ClientMessage> = [
  isConnectedMessage,
  isExecuteResultMessage,
  isGameTreeMessage,
  isRuntimeErrorMessage,
  isLogMessage,
  isPropertiesResultMessage,
  isModuleInterfaceMessage,
  isSetPropertyResultMessage,
  isTeleportToResultMessage,
  isDeleteInstanceResultMessage,
  isReparentInstanceResultMessage,
  isChildrenResultMessage,
  isScriptSourceResultMessage,
  isCreateInstanceResultMessage,
  isCloneInstanceResultMessage,
  isSetRemoteSpyEnabledResultMessage,
  isSetRemoteSpyFilterResultMessage,
  isSetRemoteSpyBlockListResultMessage,
  isSetScriptSourceResultMessage,
  isRemoteSpyMessage,
];

const isClientMessage = (value: unknown): value is ClientMessage => clientMessageGuards.some(guard => guard(value));

const isProxyWelcome = (value: unknown): value is ProxyWelcomeMessage =>
  hasType(value, 'proxyWelcome') &&
  hasField(value, 'isConnected', isBoolean) &&
  hasOptionalField(value, 'executorName', isString) &&
  hasOptionalField(value, 'clientType', isClientType);

const isProxyStatusChange = (value: unknown): value is ProxyStatusChangeMessage =>
  hasType(value, 'proxyStatusChange') &&
  hasField(value, 'status', isStatus) &&
  hasOptionalField(value, 'executorName', isString) &&
  hasOptionalField(value, 'clientType', isClientType);

const isProxyMessage = (value: unknown): value is ProxyMessage => isProxyWelcome(value) || isProxyStatusChange(value);

const isProxyHandshake = (value: unknown): value is ProxyHandshakeMessage => hasType(value, 'proxyHandshake');

const decode = <Message>(data: string, guard: (value: unknown) => value is Message): Message | undefined => {
  try {
    const parsed: unknown = JSON.parse(data);
    return guard(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};

/** Parses one WebSocket frame sent by an executor or Studio client; undefined when it is not a known message. */
export const parseClientMessage = (data: string): ClientMessage | undefined => decode(data, isClientMessage);

/** Parses one frame sent by a primary bridge to its proxy; undefined for forwarded client traffic. */
export const parseProxyMessage = (data: string): ProxyMessage | undefined => decode(data, isProxyMessage);

/** Parses the first frame of a new connection; defined only when the peer is a proxy bridge. */
export const parseProxyHandshake = (data: string): ProxyHandshakeMessage | undefined => decode(data, isProxyHandshake);

const isRemoteSpyBlockType = (value: unknown): value is RemoteSpyBlockEntry['type'] =>
  value === 'path' || value === 'name';

const isRemoteSpyBlockEntry = (value: unknown): value is RemoteSpyBlockEntry =>
  hasField(value, 'type', isRemoteSpyBlockType) && hasField(value, 'value', isString);

const isRemoteSpyBlockList = (value: unknown): value is ReadonlyArray<RemoteSpyBlockEntry> =>
  Array.isArray(value) && value.every(isRemoteSpyBlockEntry);

const isRemoteSpyPolicyMessage = (value: unknown): value is RemoteSpyPolicyMessage =>
  hasField(value, 'id', isString) &&
  ((hasType(value, 'setRemoteSpyEnabled') &&
    hasField(value, 'enabled', isBoolean) &&
    hasOptionalField(value, 'source', isRemoteSpySource)) ||
    (hasType(value, 'setRemoteSpyFilter') && hasField(value, 'filter', isString)) ||
    (hasType(value, 'setRemoteSpyBlockList') && hasField(value, 'blocks', isRemoteSpyBlockList)));

/** Parses a frame a proxy forwards to the executor; defined only for Remote Spy policy requests. */
export const parseRemoteSpyPolicyMessage = (data: string): RemoteSpyPolicyMessage | undefined =>
  decode(data, isRemoteSpyPolicyMessage);
