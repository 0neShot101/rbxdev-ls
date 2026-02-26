export type ClientType = 'executor' | 'studio';

export type BridgeCapability =
  | 'execute'
  | 'scriptSource'
  | 'scriptWrite'
  | 'remoteSpy'
  | 'saveInstance'
  | 'gameTree'
  | 'properties'
  | 'instanceManipulation'
  | 'teleport'
  | 'console'
  | 'moduleInterface';

export interface ClientCapabilities {
  readonly clientType: ClientType;
  readonly capabilities: ReadonlySet<BridgeCapability>;
}
