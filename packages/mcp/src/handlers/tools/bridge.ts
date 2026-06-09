import { hasCapability } from 'rbxdev-server';

import { formatLogEntry } from '@mcp/utils/formatters';
import { NOT_CONNECTED, errorResult, textResult } from '@mcp/utils/results';

import type { ToolHandlerMap } from './shared';

export const bridgeToolHandlers: ToolHandlerMap = {
  'get_bridge_status': async (_args, { bridge }) =>
    textResult(
      JSON.stringify(
        {
          'isRunning': bridge.isRunning,
          'isConnected': bridge.isConnected,
          'executorName': bridge.executorName ?? null,
          'clientType': bridge.clientType ?? null,
          'lastUpdate': bridge.liveGameModel.lastUpdate,
          'servicesCount': bridge.liveGameModel.services.size,
        },
        null,
        2,
      ),
    ),

  'execute_code': async (args, { bridge }) => {
    if (bridge.isConnected === false) return NOT_CONNECTED;
    if (hasCapability(bridge.clientCapabilities, 'execute') === false)
      return errorResult('Error: Code execution is not available with the current client');

    const code = (args as { code: string }).code;
    if (typeof code !== 'string' || code.trim() === '') return errorResult('Error: code parameter is required');

    try {
      const result = await bridge.execute(code);
      if (result.success) return textResult(result.result ?? '(no output)');
      return errorResult(
        `Execution error: ${result.error?.message ?? 'Unknown error'}${result.error?.stack !== undefined ? `\n\nStack trace:\n${result.error.stack}` : ''}`,
      );
    } catch (err) {
      return errorResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  },

  'get_console_output': async (args, { logBuffer }) => {
    const typedArgs = args as { limit?: number; level?: 'info' | 'warn' | 'error' | 'all' } | undefined;
    const limit = typedArgs?.limit ?? 50;
    const level = typedArgs?.level ?? 'all';
    const filtered = level !== 'all' ? logBuffer.filter(entry => entry.level === level) : logBuffer;
    return textResult(filtered.slice(-limit).map(formatLogEntry).join('\n') || 'No console output');
  },
};
