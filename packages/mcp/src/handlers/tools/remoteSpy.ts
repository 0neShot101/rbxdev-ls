import { hasCapability } from 'rbxdev-server';

import { bridgeCall, errorResult, NOT_CONNECTED, textResult } from '@mcp/utils/results';
import { decodeBlockList, decodeBoolean, decodeLimit } from '@mcp/utils/validation';

import type { ToolHandlerMap } from '@mcp/types/tools';

/** Handlers for Remote Spy capture, toggle and block-list tools. */
export const remoteSpyToolHandlers: ToolHandlerMap = {
  'get_remote_calls': async (args, { bridge }) => {
    const limit = decodeLimit(args['limit'], 50, 1000);
    if (limit.ok === false) return limit.error;

    const calls = bridge.remoteSpyCalls.slice(-limit.value);
    if (calls.length === 0)
      return textResult(
        `No remote calls captured. Remote Spy is ${bridge.isRemoteSpyEnabled ? 'enabled' : 'disabled, enable it first with set_remote_spy_enabled'}.`,
      );

    const formatted = calls
      .map(call => {
        const time = new Date(call.timestamp * 1000).toISOString().slice(11, 23);
        const response =
          call.returnStatus === 'returned'
            ? `\n  Returned (${call.returnCount ?? 0} values):\n${call.returns ?? ''}`
            : call.method === 'InvokeServer'
              ? `\n  Return capture: ${call.returnStatus ?? 'not recorded'}`
              : '\n  One-way event: no return value';

        return `[${time}] ${call.method} - ${call.remoteName} (${call.remoteType})\n  Code:\n${call.code}${response}`;
      })
      .join('\n\n');
    return textResult(`Recent remote calls (${calls.length}):\n\n${formatted}`);
  },

  'set_remote_spy_enabled': async (args, { bridge }) => {
    if (bridge.isConnected === false) return NOT_CONNECTED;
    if (hasCapability(bridge.clientCapabilities, 'remoteSpy') === false)
      return errorResult('Error: Remote Spy is not available with the current client');

    const enabled = decodeBoolean(args['enabled'], 'enabled');
    if (enabled.ok === false) return enabled.error;

    return bridgeCall(
      () => bridge.setRemoteSpyEnabled(enabled.value),
      result => `Remote Spy ${result.enabled === true ? 'enabled' : 'disabled'}`,
      'Failed to set Remote Spy state',
    );
  },

  'set_remote_spy_block_list': async (args, { bridge }) => {
    if (bridge.isConnected === false) return NOT_CONNECTED;
    if (hasCapability(bridge.clientCapabilities, 'remoteSpy') === false)
      return errorResult('Error: Remote Spy is not available with the current client');

    const blocks = decodeBlockList(args['blocks']);
    if (blocks.ok === false) return blocks.error;

    return bridgeCall(
      () => bridge.setRemoteSpyBlockList(blocks.value),
      () => `Block list updated (${blocks.value.length} entries)`,
      'Failed to set block list',
    );
  },
};
