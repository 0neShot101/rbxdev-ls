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
  MessageRecord,
  ModuleInterfaceMessage,
  PropertiesResultMessage,
  RemoteSpyMessage,
  ReparentInstanceResultMessage,
  RuntimeErrorMessage,
  ScriptSourceResultMessage,
  SetPropertyResultMessage,
  SetRemoteSpyBlockListResultMessage,
  SetRemoteSpyEnabledResultMessage,
  SetRemoteSpyFilterResultMessage,
  SetScriptSourceResultMessage,
  TeleportToResultMessage,
} from '@typings/protocol';

const isRecord = (value: unknown): value is MessageRecord => typeof value === 'object' && value !== null;

const hasStringField = (obj: MessageRecord, field: string): boolean => typeof obj[field] === 'string';

const createResultGuard =
  <T extends ClientMessage>(typeName: string) =>
  (msg: unknown): msg is T =>
    isRecord(msg) && msg['type'] === typeName && hasStringField(msg, 'id') && typeof msg['success'] === 'boolean';

/** Type guard for the initial connected handshake message from an executor or studio client. */
export const isConnectedMessage = (msg: unknown): msg is ConnectedMessage =>
  isRecord(msg) &&
  msg['type'] === 'connected' &&
  hasStringField(msg, 'executorName') &&
  (msg['clientType'] === undefined || msg['clientType'] === 'executor' || msg['clientType'] === 'studio');

/** Type guard for an execute result message. */
export const isExecuteResultMessage = (msg: unknown): msg is ExecuteResultMessage =>
  isRecord(msg) && msg['type'] === 'executeResult' && hasStringField(msg, 'id');

/** Type guard for a game tree snapshot message. */
export const isGameTreeMessage = (msg: unknown): msg is GameTreeMessage =>
  isRecord(msg) && msg['type'] === 'gameTree' && Array.isArray(msg['data']);

/** Type guard for a runtime error notification message. */
export const isRuntimeErrorMessage = (msg: unknown): msg is RuntimeErrorMessage =>
  isRecord(msg) && msg['type'] === 'runtimeError' && typeof msg['error'] === 'object' && msg['error'] !== null;

/** Type guard for a console log message (print/warn/error). */
export const isLogMessage = (msg: unknown): msg is LogMessage =>
  isRecord(msg) && msg['type'] === 'log' && hasStringField(msg, 'level') && hasStringField(msg, 'message');

/** Type guard for a properties result message. */
export const isPropertiesResultMessage = createResultGuard<PropertiesResultMessage>('propertiesResult');
/** Type guard for a module interface result message. */
export const isModuleInterfaceMessage = createResultGuard<ModuleInterfaceMessage>('moduleInterface');
/** Type guard for a set property result message. */
export const isSetPropertyResultMessage = createResultGuard<SetPropertyResultMessage>('setPropertyResult');
/** Type guard for a teleport result message. */
export const isTeleportToResultMessage = createResultGuard<TeleportToResultMessage>('teleportToResult');
/** Type guard for a delete instance result message. */
export const isDeleteInstanceResultMessage = createResultGuard<DeleteInstanceResultMessage>('deleteInstanceResult');
/** Type guard for a reparent instance result message. */
export const isReparentInstanceResultMessage =
  createResultGuard<ReparentInstanceResultMessage>('reparentInstanceResult');
/** Type guard for a children result message. */
export const isChildrenResultMessage = createResultGuard<ChildrenResultMessage>('childrenResult');
/** Type guard for a script source result message. */
export const isScriptSourceResultMessage = createResultGuard<ScriptSourceResultMessage>('scriptSourceResult');
/** Type guard for a create instance result message. */
export const isCreateInstanceResultMessage = createResultGuard<CreateInstanceResultMessage>('createInstanceResult');
/** Type guard for a clone instance result message. */
export const isCloneInstanceResultMessage = createResultGuard<CloneInstanceResultMessage>('cloneInstanceResult');
/** Type guard for a set remote spy enabled result message. */
export const isSetRemoteSpyEnabledResultMessage =
  createResultGuard<SetRemoteSpyEnabledResultMessage>('setRemoteSpyEnabledResult');
/** Type guard for a set remote spy filter result message. */
export const isSetRemoteSpyFilterResultMessage =
  createResultGuard<SetRemoteSpyFilterResultMessage>('setRemoteSpyFilterResult');
/** Type guard for a set remote spy block list result message. */
export const isSetRemoteSpyBlockListResultMessage =
  createResultGuard<SetRemoteSpyBlockListResultMessage>('setRemoteSpyBlockListResult');
/** Type guard for a set script source result message. */
export const isSetScriptSourceResultMessage = createResultGuard<SetScriptSourceResultMessage>('setScriptSourceResult');

/** Type guard for a remote spy call capture message. */
export const isRemoteSpyMessage = (msg: unknown): msg is RemoteSpyMessage =>
  isRecord(msg) && msg['type'] === 'remoteSpy' && typeof msg['call'] === 'object' && msg['call'] !== null;

const clientMessageValidators: Record<string, (msg: unknown) => msg is ClientMessage> = {
  'connected': isConnectedMessage,
  'executeResult': isExecuteResultMessage,
  'gameTree': isGameTreeMessage,
  'runtimeError': isRuntimeErrorMessage,
  'log': isLogMessage,
  'propertiesResult': isPropertiesResultMessage,
  'moduleInterface': isModuleInterfaceMessage,
  'setPropertyResult': isSetPropertyResultMessage,
  'teleportToResult': isTeleportToResultMessage,
  'deleteInstanceResult': isDeleteInstanceResultMessage,
  'reparentInstanceResult': isReparentInstanceResultMessage,
  'childrenResult': isChildrenResultMessage,
  'scriptSourceResult': isScriptSourceResultMessage,
  'createInstanceResult': isCreateInstanceResultMessage,
  'cloneInstanceResult': isCloneInstanceResultMessage,
  'setRemoteSpyEnabledResult': isSetRemoteSpyEnabledResultMessage,
  'setRemoteSpyFilterResult': isSetRemoteSpyFilterResultMessage,
  'setRemoteSpyBlockListResult': isSetRemoteSpyBlockListResultMessage,
  'setScriptSourceResult': isSetScriptSourceResultMessage,
  'remoteSpy': isRemoteSpyMessage,
};

/** Parses a JSON string and validates it as a ClientMessage */
export const parseClientMessage = (data: string): ClientMessage | undefined => {
  try {
    const parsed: unknown = JSON.parse(data);
    if (isRecord(parsed) === false) return undefined;

    const typeName = parsed['type'];
    if (typeof typeName !== 'string') return undefined;

    const validator = clientMessageValidators[typeName];
    if (validator === undefined) return undefined;

    return validator(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};
