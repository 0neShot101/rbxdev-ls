import { hasCapability } from 'rbxdev-server';

import { bridgeCall, NOT_CONNECTED, errorResult, textResult } from '@mcp/utils/results';
import { asRecord, normalizePositiveInteger } from '@mcp/utils/validation';

import type { ToolHandlerMap } from './shared';

export const remoteSpyToolHandlers: ToolHandlerMap = {
  'get_remote_calls': async (args, { bridge }) => {
    const rawArgs = asRecord(args);
    const limit = normalizePositiveInteger(rawArgs?.['limit'], 50, 1000);
    const calls = bridge.remoteSpyCalls.slice(-limit);
    if (calls.length === 0)
      return textResult(
        `No remote calls captured. Remote Spy is ${bridge.isRemoteSpyEnabled ? 'enabled' : 'disabled, enable it first with set_remote_spy_enabled'}.`,
      );

    const formatted = calls
      .map(call => {
        const time = new Date(call.timestamp * 1000).toISOString().slice(11, 23);
        return `[${time}] ${call.method} - ${call.remoteName} (${call.remoteType})\n  Code:\n${call.code}`;
      })
      .join('\n\n');
    return textResult(`Recent remote calls (${calls.length}):\n\n${formatted}`);
  },

  'set_remote_spy_enabled': async (args, { bridge }) => {
    if (bridge.isConnected === false) return NOT_CONNECTED;
    if (hasCapability(bridge.clientCapabilities, 'remoteSpy') === false)
      return errorResult('Error: Remote Spy is not available with the current client');

    const rawArgs = asRecord(args);
    if (typeof rawArgs?.['enabled'] !== 'boolean') {
      return errorResult('Error: enabled parameter is required (boolean)');
    }
    const enabled = rawArgs['enabled'];

    return bridgeCall(
      () => bridge.setRemoteSpyEnabled(enabled),
      result => `Remote Spy ${result.enabled === true ? 'enabled' : 'disabled'}`,
      'Failed to set Remote Spy state',
    );
  },

  'set_remote_spy_block_list': async (args, { bridge }) => {
    if (bridge.isConnected === false) return NOT_CONNECTED;
    if (hasCapability(bridge.clientCapabilities, 'remoteSpy') === false)
      return errorResult('Error: Remote Spy is not available with the current client');

    const rawArgs = asRecord(args);
    if (Array.isArray(rawArgs?.['blocks']) === false) {
      return errorResult('Error: blocks parameter is required (array)');
    }
    const blocks = rawArgs['blocks'] as Array<{ type: 'path' | 'name'; value: string }>;

    return bridgeCall(
      () => bridge.setRemoteSpyBlockList(blocks),
      () => `Block list updated (${blocks.length} entries)`,
      'Failed to set block list',
    );
  },
};
