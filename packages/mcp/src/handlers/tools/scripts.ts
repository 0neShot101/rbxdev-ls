import { hasCapability } from 'rbxdev-server';

import { bridgeCall, errorResult, failureResult, NOT_CONNECTED, textResult } from '@mcp/utils/results';
import { decodePath, decodeString } from '@mcp/utils/validation';

import type { ToolHandlerMap } from '@mcp/types/tools';

/** Handlers for tools that read and write script sources. */
export const scriptToolHandlers: ToolHandlerMap = {
  'get_script_source': async (args, { bridge }) => {
    if (bridge.isConnected === false) return NOT_CONNECTED;

    const path = decodePath(args['path'], 'path');
    if (path.ok === false) return path.error;

    try {
      const result = await bridge.requestScriptSource(path.value);
      if (result.success && result.source !== undefined) {
        const header = result.scriptType !== undefined ? `-- ${result.scriptType}: ${path.value.join('.')}\n\n` : '';
        return textResult(header + result.source);
      }

      return errorResult(`Error: ${result.error ?? 'Failed to get script source'}`);
    } catch (cause) {
      return failureResult(cause);
    }
  },

  'set_script_source': async (args, { bridge }) => {
    if (bridge.isConnected === false) return NOT_CONNECTED;
    if (hasCapability(bridge.clientCapabilities, 'scriptWrite') === false)
      return errorResult('Error: Script writing is only available when connected to Roblox Studio');

    const path = decodePath(args['path'], 'path');
    if (path.ok === false) return path.error;
    const source = decodeString(args['source'], 'source');
    if (source.ok === false) return errorResult('Error: source parameter is required');

    return bridgeCall(
      () => bridge.setScriptSource(path.value, source.value),
      () => `Successfully updated script source at ${path.value.join('.')}`,
      'Failed to set script source',
    );
  },
};
