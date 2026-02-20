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

type MessageRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is MessageRecord => typeof value === 'object' && value !== null;

const hasStringField = (obj: MessageRecord, field: string): boolean => typeof obj[field] === 'string';

const createResultGuard =
  <T extends ClientMessage>(typeName: string) =>
  (msg: unknown): msg is T =>
    isRecord(msg) && msg['type'] === typeName && hasStringField(msg, 'id') && typeof msg['success'] === 'boolean';

export const isConnectedMessage = (msg: unknown): msg is ConnectedMessage =>
  isRecord(msg) &&
  msg['type'] === 'connected' &&
  hasStringField(msg, 'executorName') &&
  (msg['clientType'] === undefined || msg['clientType'] === 'executor' || msg['clientType'] === 'studio');

export const isExecuteResultMessage = (msg: unknown): msg is ExecuteResultMessage =>
  isRecord(msg) && msg['type'] === 'executeResult' && hasStringField(msg, 'id');

export const isGameTreeMessage = (msg: unknown): msg is GameTreeMessage =>
  isRecord(msg) && msg['type'] === 'gameTree' && Array.isArray(msg['data']);

export const isRuntimeErrorMessage = (msg: unknown): msg is RuntimeErrorMessage =>
  isRecord(msg) && msg['type'] === 'runtimeError' && typeof msg['error'] === 'object' && msg['error'] !== null;

export const isLogMessage = (msg: unknown): msg is LogMessage =>
  isRecord(msg) && msg['type'] === 'log' && hasStringField(msg, 'level') && hasStringField(msg, 'message');

export const isPropertiesResultMessage = createResultGuard<PropertiesResultMessage>('propertiesResult');
export const isModuleInterfaceMessage = createResultGuard<ModuleInterfaceMessage>('moduleInterface');
export const isSetPropertyResultMessage = createResultGuard<SetPropertyResultMessage>('setPropertyResult');
export const isTeleportToResultMessage = createResultGuard<TeleportToResultMessage>('teleportToResult');
export const isDeleteInstanceResultMessage = createResultGuard<DeleteInstanceResultMessage>('deleteInstanceResult');
export const isReparentInstanceResultMessage =
  createResultGuard<ReparentInstanceResultMessage>('reparentInstanceResult');
export const isChildrenResultMessage = createResultGuard<ChildrenResultMessage>('childrenResult');
export const isScriptSourceResultMessage = createResultGuard<ScriptSourceResultMessage>('scriptSourceResult');
export const isCreateInstanceResultMessage = createResultGuard<CreateInstanceResultMessage>('createInstanceResult');
export const isCloneInstanceResultMessage = createResultGuard<CloneInstanceResultMessage>('cloneInstanceResult');
export const isSetRemoteSpyEnabledResultMessage =
  createResultGuard<SetRemoteSpyEnabledResultMessage>('setRemoteSpyEnabledResult');
export const isSetRemoteSpyFilterResultMessage =
  createResultGuard<SetRemoteSpyFilterResultMessage>('setRemoteSpyFilterResult');
export const isSetRemoteSpyBlockListResultMessage =
  createResultGuard<SetRemoteSpyBlockListResultMessage>('setRemoteSpyBlockListResult');
export const isSetScriptSourceResultMessage =
  createResultGuard<SetScriptSourceResultMessage>('setScriptSourceResult');

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
