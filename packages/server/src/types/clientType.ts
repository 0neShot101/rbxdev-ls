/** Kind of bridge client: an in-game executor or the Roblox Studio plugin. */
export type ClientType = 'executor' | 'studio';

/** Feature a connected bridge client advertises support for. */
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

/** Client kind and the feature set it advertised on connection. */
export interface ClientCapabilities {
  readonly clientType: ClientType;
  readonly capabilities: ReadonlySet<BridgeCapability>;
}
