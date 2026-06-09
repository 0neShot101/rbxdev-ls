import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { createExecutorBridge, createProxyBridge, type ExecutorBridge, type LogEntry } from 'rbxdev-server';

import { MAX_LOG_BUFFER, MCP_INSTRUCTIONS } from '@mcp/constants';
import { readResource, resources } from '@mcp/handlers/resources';
import { handleToolCall } from '@mcp/handlers/toolCalls';
import { tools } from '@mcp/handlers/tools/definitions';
import { formatGameTreeNode, formatLogEntry, formatServicesTree, serializeGameTreeNode } from '@mcp/utils/formatters';
import { errorResult, requirePath, textResult } from '@mcp/utils/results';
import { getConfiguredPort, isPortAvailable } from '@mcp/utils/runtime';

export {
  errorResult,
  formatGameTreeNode,
  formatLogEntry,
  formatServicesTree,
  requirePath,
  serializeGameTreeNode,
  textResult,
  tools,
};

/** Creates and configures the MCP server with all tools and resources. */
export const createMcpServer = (injectedBridge?: ExecutorBridge): { server: McpServer; bridge: ExecutorBridge } => {
  const logBuffer: LogEntry[] = [];
  const bridge = injectedBridge ?? createExecutorBridge((message: string) => console.error(`[mcp] ${message}`));

  bridge.onLog(entry => {
    logBuffer.push(entry);
    if (logBuffer.length > MAX_LOG_BUFFER) logBuffer.shift();
  });

  const server = new McpServer(
    { 'name': 'rbxdev-roblox', 'version': '0.3.0' },
    { 'capabilities': { 'tools': {}, 'resources': {} }, 'instructions': MCP_INSTRUCTIONS },
  );

  server.server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
  server.server.setRequestHandler(ListResourcesRequestSchema, async () => ({ 'resources': [...resources] }));
  server.server.setRequestHandler(ReadResourceRequestSchema, async request => readResource(request, bridge, logBuffer));
  server.server.setRequestHandler(CallToolRequestSchema, async request => handleToolCall(request, bridge, logBuffer));

  return { server, bridge };
};

/** Starts the MCP server with stdio transport. */
export const startMcpServer = async (): Promise<void> => {
  const port = getConfiguredPort();
  const log = (message: string): void => console.error(`[mcp] ${message}`);

  const available = await isPortAvailable(port);
  if (available === false) log(`Port ${port} in use, connecting as proxy client`);

  const bridge = available ? createExecutorBridge(log) : createProxyBridge(log);
  const { server } = createMcpServer(bridge);

  bridge.start(port);
  log(`Executor bridge started on port ${port}${available === false ? ' (proxy mode)' : ''}`);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  log('MCP server connected via stdio');
};
