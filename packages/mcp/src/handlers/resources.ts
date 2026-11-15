import { formatLogEntry, formatServicesTree } from '@mcp/utils/formatters';
import { orFallback } from '@mcp/utils/results';

import type { ReadResourceRequest, ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import type { ExecutorBridge, LogEntry } from 'rbxdev-server';

/** Resources exposed by the MCP server. */
export const resources = [
  {
    'uri': 'rbxdev://bridge/status',
    'name': 'Bridge Status',
    'description': 'Current status of the Roblox executor bridge connection',
    'mimeType': 'application/json',
  },
  {
    'uri': 'rbxdev://game/tree',
    'name': 'Game Tree',
    'description': 'Current game hierarchy structure',
    'mimeType': 'text/plain',
  },
  {
    'uri': 'rbxdev://console/logs',
    'name': 'Console Logs',
    'description': 'Recent console output from the game',
    'mimeType': 'text/plain',
  },
] as const;

const textResource = (uri: string, mimeType: string, text: string): ReadResourceResult => ({
  'contents': [{ 'uri': uri, 'mimeType': mimeType, 'text': text }],
});

/**
 * Reads one of the server's resources.
 * @param request - The SDK resource read request.
 * @param bridge - Bridge providing status and game tree data.
 * @param logBuffer - Recent console output.
 */
export const readResource = async (
  request: ReadResourceRequest,
  bridge: ExecutorBridge,
  logBuffer: ReadonlyArray<LogEntry>,
): Promise<ReadResourceResult> => {
  const { uri } = request.params;

  if (uri === 'rbxdev://bridge/status')
    return textResource(
      uri,
      'application/json',
      JSON.stringify(
        {
          'isRunning': bridge.isRunning,
          'isConnected': bridge.isConnected,
          'executorName': bridge.executorName ?? null,
        },
        null,
        2,
      ),
    );

  if (uri === 'rbxdev://game/tree') {
    if (bridge.isConnected === false) return textResource(uri, 'text/plain', 'Not connected to executor');
    return textResource(
      uri,
      'text/plain',
      orFallback(formatServicesTree(bridge.liveGameModel.services), 'No game tree data available'),
    );
  }

  if (uri === 'rbxdev://console/logs')
    return textResource(
      uri,
      'text/plain',
      orFallback(logBuffer.slice(-100).map(formatLogEntry).join('\n'), 'No console output'),
    );

  throw new Error(`Unknown resource: ${uri}`);
};
