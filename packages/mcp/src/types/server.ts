import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ExecutorBridge } from 'rbxdev-server';

/** A configured MCP server together with the bridge its tools use. */
export interface McpServerHandle {
  readonly server: McpServer;
  readonly bridge: ExecutorBridge;
}
