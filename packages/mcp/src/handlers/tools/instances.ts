import { hasCapability } from 'rbxdev-server';

import { createLuaLookupFromPath, escapeLuaString } from '@mcp/utils/lua';
import { bridgeCall, errorResult, failureResult, NOT_CONNECTED, textResult } from '@mcp/utils/results';
import {
  decodeOptionalBoolean,
  decodeOptionalString,
  decodeOptionalStrings,
  decodePath,
  decodeString,
} from '@mcp/utils/validation';

import type { SaveInstanceInput, ToolHandlerMap } from '@mcp/types/tools';

const buildSaveInstanceCode = (input: SaveInstanceInput): string => {
  const optionParts = [`FilePath = "${escapeLuaString(input.fileName)}"`, `Decompile = ${input.decompile}`];
  if (input.path !== undefined && input.path.length > 0)
    optionParts.push(`Object = ${createLuaLookupFromPath(input.path)}`);

  return `if saveinstance == nil then return "Error: saveinstance not available" end\nlocal ok, err = pcall(saveinstance, {${optionParts.join(', ')}})\nif ok then return "Saved to ${escapeLuaString(input.fileName)}" else return "Error: " .. tostring(err) end`;
};

/** Handlers for tools that read, change, create, move or save instances. */
export const instanceToolHandlers: ToolHandlerMap = {
  'set_property': async (args, { bridge }) => {
    if (bridge.isConnected === false) return NOT_CONNECTED;

    const path = decodePath(args['path'], 'path');
    if (path.ok === false) return path.error;
    const property = decodeString(args['property'], 'property');
    if (property.ok === false) return property.error;
    const value = decodeString(args['value'], 'value');
    if (value.ok === false) return value.error;
    const valueType = decodeString(args['valueType'], 'valueType');
    if (valueType.ok === false) return valueType.error;

    return bridgeCall(
      () => bridge.setProperty(path.value, property.value, value.value, valueType.value),
      () => `Successfully set ${property.value} to ${value.value}`,
      'Failed to set property',
    );
  },

  'teleport_player': async (args, { bridge }) => {
    if (bridge.isConnected === false) return NOT_CONNECTED;

    const path = decodePath(args['path'], 'path');
    if (path.ok === false) return path.error;

    return bridgeCall(
      () => bridge.teleportTo(path.value),
      () => `Successfully teleported to ${path.value.join('.')}`,
      'Failed to teleport',
    );
  },

  'delete_instance': async (args, { bridge }) => {
    if (bridge.isConnected === false) return NOT_CONNECTED;

    const path = decodePath(args['path'], 'path');
    if (path.ok === false) return path.error;

    return bridgeCall(
      () => bridge.deleteInstance(path.value),
      () => `Successfully deleted ${path.value.join('.')}`,
      'Failed to delete instance',
    );
  },

  'reparent_instance': async (args, { bridge }) => {
    if (bridge.isConnected === false) return NOT_CONNECTED;

    const source = decodePath(args['sourcePath'], 'sourcePath');
    if (source.ok === false) return source.error;
    const target = decodePath(args['targetPath'], 'targetPath');
    if (target.ok === false) return target.error;

    return bridgeCall(
      () => bridge.reparentInstance(source.value, target.value),
      () => `Successfully moved ${source.value.join('.')} to ${target.value.join('.')}`,
      'Failed to reparent instance',
    );
  },

  'create_instance': async (args, { bridge }) => {
    if (bridge.isConnected === false) return NOT_CONNECTED;

    const className = decodeString(args['className'], 'className');
    if (className.ok === false || className.value.trim() === '')
      return errorResult('Error: className parameter is required');
    const parent = decodePath(args['parentPath'], 'parentPath');
    if (parent.ok === false) return parent.error;
    const name = decodeOptionalString(args['name'], 'name');
    if (name.ok === false) return name.error;

    return bridgeCall(
      () => bridge.createInstance(className.value, parent.value, name.value),
      result => `Successfully created ${result.instanceName} (${className.value}) in ${parent.value.join('.')}`,
      'Failed to create instance',
    );
  },

  'clone_instance': async (args, { bridge }) => {
    if (bridge.isConnected === false) return NOT_CONNECTED;

    const path = decodePath(args['path'], 'path');
    if (path.ok === false) return path.error;

    return bridgeCall(
      () => bridge.cloneInstance(path.value),
      result => `Successfully cloned ${path.value.join('.')} as ${result.cloneName}`,
      'Failed to clone instance',
    );
  },

  'save_instance': async (args, { bridge }) => {
    if (bridge.isConnected === false) return NOT_CONNECTED;
    if (hasCapability(bridge.clientCapabilities, 'saveInstance') === false)
      return errorResult('Error: Save instance is not available with the current client');

    const path = decodeOptionalStrings(args['path'], 'path');
    if (path.ok === false) return path.error;
    const fileName = decodeOptionalString(args['fileName'], 'fileName');
    if (fileName.ok === false) return fileName.error;
    const decompile = decodeOptionalBoolean(args['decompile'], 'decompile', true);
    if (decompile.ok === false) return decompile.error;
    const input: SaveInstanceInput = {
      'path': path.value,
      'fileName': fileName.value ?? 'game.rbxl',
      'decompile': decompile.value,
    };

    try {
      const result = await bridge.execute(buildSaveInstanceCode(input));
      if (result.success) return textResult(result.result ?? `Save initiated to ${input.fileName}`);
      return errorResult(`Save failed: ${result.error?.message ?? 'Unknown error'}`);
    } catch (cause) {
      return failureResult(cause);
    }
  },
};
