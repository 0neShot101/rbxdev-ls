import { formatGameTreeNode, formatServicesTree, serializeGameTreeNode } from '@mcp/utils/formatters';
import { errorResult, failureResult, NOT_CONNECTED, orFallback, textResult } from '@mcp/utils/results';
import { decodeFormat, decodeOptionalStrings, decodePath } from '@mcp/utils/validation';

import type { ToolHandlerMap } from '@mcp/types/tools';

/** Handlers for tools that browse the game hierarchy and instance properties. */
export const gameTreeToolHandlers: ToolHandlerMap = {
  'get_game_tree': async (args, { bridge }) => {
    if (bridge.isConnected === false) return NOT_CONNECTED;

    const path = decodeOptionalStrings(args['path'], 'path');
    if (path.ok === false) return path.error;
    const format = decodeFormat(args['format']);
    if (format.ok === false) return format.error;

    if (path.value !== undefined && path.value.length > 0) {
      const node = bridge.liveGameModel.getNode([...path.value]);
      if (node === undefined) return errorResult(`Error: Node not found at path: ${path.value.join('.')}`);
      return textResult(
        format.value === 'json' ? JSON.stringify(serializeGameTreeNode(node), null, 2) : formatGameTreeNode(node),
      );
    }

    const services = bridge.liveGameModel.services;
    if (format.value === 'json')
      return textResult(JSON.stringify([...services.values()].map(serializeGameTreeNode), null, 2));

    return textResult(orFallback(formatServicesTree(services), 'No game tree data available'));
  },

  'get_properties': async (args, { bridge }) => {
    if (bridge.isConnected === false) return NOT_CONNECTED;

    const path = decodePath(args['path'], 'path');
    if (path.ok === false) return path.error;
    const properties = decodeOptionalStrings(args['properties'], 'properties');
    if (properties.ok === false) return properties.error;

    try {
      const result = await bridge.requestProperties(path.value, properties.value);
      if (result.success && result.properties !== undefined) {
        const formatted = result.properties
          .map(
            property =>
              `${property.name}: ${property.value} (${property.valueType}${property.className !== undefined ? `, ${property.className}` : ''})`,
          )
          .join('\n');
        return textResult(orFallback(formatted, 'No properties returned'));
      }

      return errorResult(`Error: ${result.error ?? 'Failed to get properties'}`);
    } catch (cause) {
      return failureResult(cause);
    }
  },

  'get_children': async (args, { bridge }) => {
    if (bridge.isConnected === false) return NOT_CONNECTED;

    const format = decodeFormat(args['format']);
    if (format.ok === false) return format.error;
    const path = decodePath(args['path'], 'path');
    if (path.ok === false) return path.error;

    try {
      const result = await bridge.requestChildren(path.value);
      if (result.success && result.children !== undefined) {
        if (format.value === 'json')
          return textResult(JSON.stringify(result.children.map(serializeGameTreeNode), null, 2));
        return textResult(
          orFallback(result.children.map(child => formatGameTreeNode(child)).join('\n'), 'No children'),
        );
      }

      return errorResult(`Error: ${result.error ?? 'Failed to get children'}`);
    } catch (cause) {
      return failureResult(cause);
    }
  },

  'refresh_game_tree': async (_args, { bridge }) => {
    if (bridge.isConnected === false) return NOT_CONNECTED;
    bridge.requestGameTree();
    return textResult('Game tree refresh requested');
  },
};
