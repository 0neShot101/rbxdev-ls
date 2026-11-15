import { hasCapability } from 'rbxdev-server';

import { formatLogEntry } from '@mcp/utils/formatters';
import { errorResult, failureResult, NOT_CONNECTED, orFallback, textResult } from '@mcp/utils/results';
import { decodeLevel, decodeLimit, decodeString } from '@mcp/utils/validation';

import type { ToolHandlerMap } from '@mcp/types/tools';

/** Handlers for bridge status, code execution and console output tools. */
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

    const code = decodeString(args['code'], 'code');
    if (code.ok === false || code.value.trim() === '') return errorResult('Error: code parameter is required');

    try {
      const result = await bridge.execute(code.value);
      if (result.success) return textResult(result.result ?? '(no output)');
      const stack = result.error?.stack;
      return errorResult(
        `Execution error: ${result.error?.message ?? 'Unknown error'}${stack !== undefined ? `\n\nStack trace:\n${stack}` : ''}`,
      );
    } catch (cause) {
      return failureResult(cause);
    }
  },

  'get_console_output': async (args, { logBuffer }) => {
    const limit = decodeLimit(args['limit'], 50, 1000);
    if (limit.ok === false) return limit.error;
    const level = decodeLevel(args['level']);
    if (level.ok === false) return level.error;

    const filtered = level.value === 'all' ? logBuffer : logBuffer.filter(entry => entry.level === level.value);
    return textResult(orFallback(filtered.slice(-limit.value).map(formatLogEntry).join('\n'), 'No console output'));
  },
};
