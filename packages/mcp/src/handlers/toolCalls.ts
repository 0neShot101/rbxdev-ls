import { bridgeToolHandlers } from '@mcp/handlers/tools/bridge';
import { gameTreeToolHandlers } from '@mcp/handlers/tools/gameTree';
import { instanceToolHandlers } from '@mcp/handlers/tools/instances';
import { remoteSpyToolHandlers } from '@mcp/handlers/tools/remoteSpy';
import { scriptToolHandlers } from '@mcp/handlers/tools/scripts';
import { errorResult } from '@mcp/utils/results';
import { isJsonObject } from '@mcp/utils/validation';

import type { CallToolRequest } from '@modelcontextprotocol/sdk/types.js';
import type { ExecutorBridge, LogEntry, ToolResult } from 'rbxdev-server';

import type { ToolHandlerMap } from '@mcp/types/tools';

const toolHandlers: ToolHandlerMap = {
  ...bridgeToolHandlers,
  ...gameTreeToolHandlers,
  ...instanceToolHandlers,
  ...remoteSpyToolHandlers,
  ...scriptToolHandlers,
};

/**
 * Dispatches an MCP tool call after decoding its arguments as a JSON object.
 * @param request - The SDK tool call request.
 * @param bridge - Bridge used by the tool.
 * @param logBuffer - Recent console output for log tools.
 */
export const handleToolCall = async (
  request: CallToolRequest,
  bridge: ExecutorBridge,
  logBuffer: ReadonlyArray<LogEntry>,
): Promise<ToolResult> => {
  const handler = toolHandlers[request.params.name];
  if (handler === undefined) return errorResult(`Unknown tool: ${request.params.name}`);
  const args = request.params.arguments ?? {};
  if (isJsonObject(args) === false) return errorResult('Error: tool arguments must be a JSON object');
  return handler(args, { bridge, logBuffer });
};
