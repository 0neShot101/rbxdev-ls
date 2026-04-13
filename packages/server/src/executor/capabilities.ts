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

/**
 * Resolves the full capability set for a given client type.
 * @param clientType - The type of connected client (executor or studio).
 * @returns The client capabilities object with the appropriate capability set.
 */
export const resolveCapabilities = (clientType: ClientType): ClientCapabilities => ({
  clientType,
  'capabilities': clientType === 'studio' ? STUDIO_CAPABILITIES : EXECUTOR_CAPABILITIES,
});

/**
 * Checks whether a client has a specific bridge capability.
 * @param caps - The client capabilities to check, or undefined if no client is connected.
 * @param cap - The capability to test for.
 * @returns True if the client has the specified capability.
 */
export const hasCapability = (caps: ClientCapabilities | undefined, cap: BridgeCapability): boolean => {
  if (caps === undefined) return false;
  return caps.capabilities.has(cap);
};
