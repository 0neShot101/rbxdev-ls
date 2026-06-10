import { hasCapability } from 'rbxdev-server';

import { createLuaLookupFromPath, escapeLuaString } from '@mcp/utils/lua';
import { bridgeCall, NOT_CONNECTED, errorResult, requirePath, textResult } from '@mcp/utils/results';

import type { ToolHandlerMap } from '@mcp/typings/tools';

const buildSaveInstanceCode = (args: { path?: string[]; fileName?: string; decompile?: boolean }): string => {
  const fileName = args.fileName ?? 'game.rbxl';
  const decompile = args.decompile !== false;

  const optionParts: string[] = [];
  optionParts.push(`FilePath = "${escapeLuaString(fileName)}"`);
  optionParts.push(`Decompile = ${decompile}`);

  if (args.path !== undefined && args.path.length > 0)
    optionParts.push(`Object = ${createLuaLookupFromPath(args.path)}`);

  return `if saveinstance == nil then return "Error: saveinstance not available" end\nlocal ok, err = pcall(saveinstance, {${optionParts.join(', ')}})\nif ok then return "Saved to ${escapeLuaString(fileName)}" else return "Error: " .. tostring(err) end`;
};

export const instanceToolHandlers: ToolHandlerMap = {
  'set_property': async (args, { bridge }) => {
    if (bridge.isConnected === false) return NOT_CONNECTED;

    const typedArgs = args as { path: string[]; property: string; value: string; valueType: string };
    const pathError = requirePath(typedArgs.path);
    if (pathError !== undefined) return pathError;

    return bridgeCall(
      () => bridge.setProperty(typedArgs.path, typedArgs.property, typedArgs.value, typedArgs.valueType),
      () => `Successfully set ${typedArgs.property} to ${typedArgs.value}`,
      'Failed to set property',
    );
  },

  'teleport_player': async (args, { bridge }) => {
    if (bridge.isConnected === false) return NOT_CONNECTED;

    const typedArgs = args as { path: string[] };
    const pathError = requirePath(typedArgs.path);
    if (pathError !== undefined) return pathError;

    return bridgeCall(
      () => bridge.teleportTo(typedArgs.path),
      () => `Successfully teleported to ${typedArgs.path.join('.')}`,
      'Failed to teleport',
    );
  },

  'delete_instance': async (args, { bridge }) => {
    if (bridge.isConnected === false) return NOT_CONNECTED;

    const typedArgs = args as { path: string[] };
    const pathError = requirePath(typedArgs.path);
    if (pathError !== undefined) return pathError;

    return bridgeCall(
      () => bridge.deleteInstance(typedArgs.path),
      () => `Successfully deleted ${typedArgs.path.join('.')}`,
      'Failed to delete instance',
    );
  },

  'reparent_instance': async (args, { bridge }) => {
    if (bridge.isConnected === false) return NOT_CONNECTED;

    const typedArgs = args as { sourcePath: string[]; targetPath: string[] };
    const sourceError = requirePath(typedArgs.sourcePath);
    if (sourceError !== undefined) return sourceError;
    const targetError = requirePath(typedArgs.targetPath);
    if (targetError !== undefined) return targetError;

    return bridgeCall(
      () => bridge.reparentInstance(typedArgs.sourcePath, typedArgs.targetPath),
      () => `Successfully moved ${typedArgs.sourcePath.join('.')} to ${typedArgs.targetPath.join('.')}`,
      'Failed to reparent instance',
    );
  },

  'create_instance': async (args, { bridge }) => {
    if (bridge.isConnected === false) return NOT_CONNECTED;

    const typedArgs = args as { className: string; parentPath: string[]; name?: string };
    if (typeof typedArgs.className !== 'string' || typedArgs.className.trim() === '')
      return errorResult('Error: className parameter is required');

    const pathError = requirePath(typedArgs.parentPath);
    if (pathError !== undefined) return pathError;

    return bridgeCall(
      () => bridge.createInstance(typedArgs.className, typedArgs.parentPath, typedArgs.name),
      result =>
        `Successfully created ${result.instanceName} (${typedArgs.className}) in ${typedArgs.parentPath.join('.')}`,
      'Failed to create instance',
    );
  },

  'clone_instance': async (args, { bridge }) => {
    if (bridge.isConnected === false) return NOT_CONNECTED;

    const typedArgs = args as { path: string[] };
    const pathError = requirePath(typedArgs.path);
    if (pathError !== undefined) return pathError;

    return bridgeCall(
      () => bridge.cloneInstance(typedArgs.path),
      result => `Successfully cloned ${typedArgs.path.join('.')} as ${result.cloneName}`,
      'Failed to clone instance',
    );
  },

  'save_instance': async (args, { bridge }) => {
    if (bridge.isConnected === false) return NOT_CONNECTED;
    if (hasCapability(bridge.clientCapabilities, 'saveInstance') === false)
      return errorResult('Error: Save instance is not available with the current client');

    const typedArgs = args as { path?: string[]; fileName?: string; decompile?: boolean };
    const fileName = typedArgs.fileName ?? 'game.rbxl';

    try {
      const result = await bridge.execute(buildSaveInstanceCode(typedArgs));
      if (result.success) return textResult(result.result ?? `Save initiated to ${fileName}`);
      return errorResult(`Save failed: ${result.error?.message ?? 'Unknown error'}`);
    } catch (err) {
      return errorResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  },
};
