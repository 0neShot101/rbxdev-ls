import { hasCapability } from 'rbxdev-server';

import { bridgeCall, errorResult, NOT_CONNECTED, requirePath, textResult } from '@mcp/utils/results';

import type { ToolHandlerMap } from '@mcp/typings/tools';

export const scriptToolHandlers: ToolHandlerMap = {
  'get_script_source': async (args, { bridge }) => {
    if (bridge.isConnected === false) return NOT_CONNECTED;

    const typedArgs = args as { path: string[] };
    const pathError = requirePath(typedArgs.path);
    if (pathError !== undefined) return pathError;

    try {
      const result = await bridge.requestScriptSource(typedArgs.path);
      if (result.success && result.source !== undefined) {
        const header =
          result.scriptType !== undefined ? `-- ${result.scriptType}: ${typedArgs.path.join('.')}\n\n` : '';
        return textResult(header + result.source);
      }

      return errorResult(`Error: ${result.error ?? 'Failed to get script source'}`);
    } catch (err) {
      return errorResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  },

  'set_script_source': async (args, { bridge }) => {
    if (bridge.isConnected === false) return NOT_CONNECTED;
    if (hasCapability(bridge.clientCapabilities, 'scriptWrite') === false)
      return errorResult('Error: Script writing is only available when connected to Roblox Studio');

    const typedArgs = args as { path: string[]; source: string };
    const pathError = requirePath(typedArgs.path);
    if (pathError !== undefined) return pathError;
    if (typeof typedArgs.source !== 'string') return errorResult('Error: source parameter is required');

    return bridgeCall(
      () => bridge.setScriptSource(typedArgs.path, typedArgs.source),
      () => `Successfully updated script source at ${typedArgs.path.join('.')}`,
      'Failed to set script source',
    );
  },
};
