import type { ExecutorBridge, LogEntry } from 'rbxdev-server';

import { formatLogEntry, formatServicesTree } from '@mcp/utils/formatters';

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

const textResource = (uri: string, mimeType: string, text: string) => ({
  'contents': [{ 'uri': uri, 'mimeType': mimeType, 'text': text }],
});

export const readResource = async (
  request: { params: { uri: string } },
  bridge: ExecutorBridge,
  logBuffer: ReadonlyArray<LogEntry>,
): Promise<{ contents: Array<{ uri: string; mimeType: string; text: string }> }> => {
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
      formatServicesTree(bridge.liveGameModel.services) || 'No game tree data available',
    );
  }

  if (uri === 'rbxdev://console/logs') {
    const formatted = logBuffer.slice(-100).map(formatLogEntry).join('\n');
    return textResource(uri, 'text/plain', formatted || 'No console output');
  }

  throw new Error(`Unknown resource: ${uri}`);
};
