/**
 * Public API surface for cross-package consumers (MCP server, etc.).
 *
 * Only symbols that external packages need are re-exported here.
 * Internal modules (@core, @parser, @lsp, @definitions, @workspace)
 * Internal modules (@core, @parser, @lsp, @definitions, @workspace)
 * remain private to the language server.
 */

export { createExecutorBridge } from './executor/server';
export { createProxyBridge } from './executor/proxy';
export { createBridgeCore } from './executor/bridgeCore';
export { hasCapability, resolveCapabilities } from './executor/capabilities';
export { createLiveGameModel } from './executor/gameTree';

export type { ExecutorBridge, LogEntry } from './typings/bridge';
export type { BridgeCapability } from './typings/clientType';
export type { ToolResult } from './typings/handlers';
export type { GameTreeNode } from './typings/protocol';
