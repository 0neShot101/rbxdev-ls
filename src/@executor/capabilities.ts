import type { BridgeCapability, ClientCapabilities, ClientType } from '@typings/clientType';

const EXECUTOR_CAPABILITIES: ReadonlySet<BridgeCapability> = new Set<BridgeCapability>([
  'execute',
  'scriptSource',
  'remoteSpy',
  'saveInstance',
  'gameTree',
  'properties',
  'instanceManipulation',
  'teleport',
  'console',
  'moduleInterface',
]);

const STUDIO_CAPABILITIES: ReadonlySet<BridgeCapability> = new Set<BridgeCapability>([
  'execute',
  'scriptSource',
  'scriptWrite',
  'gameTree',
  'properties',
  'instanceManipulation',
  'teleport',
  'console',
  'moduleInterface',
]);

export const resolveCapabilities = (clientType: ClientType): ClientCapabilities => ({
  clientType,
  'capabilities': clientType === 'studio' ? STUDIO_CAPABILITIES : EXECUTOR_CAPABILITIES,
});

export const hasCapability = (caps: ClientCapabilities | undefined, cap: BridgeCapability): boolean => {
  if (caps === undefined) return false;
  return caps.capabilities.has(cap);
};
