import type { ExecutorBridge, LogEntry, ToolResult } from 'rbxdev-server';

import { errorResult } from '@mcp/utils/results';

import { bridgeToolHandlers } from '@mcp/handlers/tools/bridge';
import { gameTreeToolHandlers } from '@mcp/handlers/tools/gameTree';
import { instanceToolHandlers } from '@mcp/handlers/tools/instances';
import { remoteSpyToolHandlers } from '@mcp/handlers/tools/remoteSpy';
import { scriptToolHandlers } from '@mcp/handlers/tools/scripts';
import type { ToolHandlerMap } from '@mcp/typings/tools';

const toolHandlers: ToolHandlerMap = {
  ...bridgeToolHandlers,
  ...gameTreeToolHandlers,
  ...instanceToolHandlers,
  ...remoteSpyToolHandlers,
  ...scriptToolHandlers,
};

export const handleToolCall = async (
  request: { params: { name: string; arguments?: unknown } },
  bridge: ExecutorBridge,
  logBuffer: ReadonlyArray<LogEntry>,
): Promise<ToolResult> => {
  const handler = toolHandlers[request.params.name];
  if (handler === undefined) return errorResult(`Unknown tool: ${request.params.name}`);
  return handler(request.params.arguments, { bridge, logBuffer });
};
