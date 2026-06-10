import { formatGameTreeNode, formatServicesTree, serializeGameTreeNode } from '@mcp/utils/formatters';
import { NOT_CONNECTED, errorResult, requirePath, textResult } from '@mcp/utils/results';
import { asRecord } from '@mcp/utils/validation';

import type { ToolHandlerMap } from '@mcp/typings/tools';

export const gameTreeToolHandlers: ToolHandlerMap = {
  'get_game_tree': async (args, { bridge }) => {
    if (bridge.isConnected === false) return NOT_CONNECTED;

    const typedArgs = args as { path?: string[]; format?: 'tree' | 'json' } | undefined;
    const path = typedArgs?.path;
    const format = typedArgs?.format ?? 'tree';

    if (path !== undefined && path.length > 0) {
      const node = bridge.liveGameModel.getNode(path);
      if (node === undefined) return errorResult(`Error: Node not found at path: ${path.join('.')}`);
      return textResult(
        format === 'json' ? JSON.stringify(serializeGameTreeNode(node), null, 2) : formatGameTreeNode(node),
      );
    }

    const services = bridge.liveGameModel.services;
    if (format === 'json') {
      const serialized: unknown[] = [];
      for (const [, node] of services) serialized.push(serializeGameTreeNode(node));
      return textResult(JSON.stringify(serialized, null, 2));
    }

    return textResult(formatServicesTree(services) || 'No game tree data available');
  },

  'get_properties': async (args, { bridge }) => {
    if (bridge.isConnected === false) return NOT_CONNECTED;

    const rawArgs = asRecord(args);
    const pathError = requirePath(rawArgs?.['path']);
    if (pathError !== undefined) return pathError;
    const path = rawArgs?.['path'] as string[];
    const properties = Array.isArray(rawArgs?.['properties']) ? (rawArgs['properties'] as string[]) : undefined;

    try {
      const result = await bridge.requestProperties(path, properties);
      if (result.success && result.properties !== undefined) {
        const formatted = result.properties
          .map(p => `${p.name}: ${p.value} (${p.valueType}${p.className !== undefined ? `, ${p.className}` : ''})`)
          .join('\n');
        return textResult(formatted || 'No properties returned');
      }

      return errorResult(`Error: ${result.error ?? 'Failed to get properties'}`);
    } catch (err) {
      return errorResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  },

  'get_children': async (args, { bridge }) => {
    if (bridge.isConnected === false) return NOT_CONNECTED;

    const rawArgs = asRecord(args);
    const format = rawArgs?.['format'] === 'json' ? 'json' : 'tree';
    const pathError = requirePath(rawArgs?.['path']);
    if (pathError !== undefined) return pathError;
    const path = rawArgs?.['path'] as string[];

    try {
      const result = await bridge.requestChildren(path);
      if (result.success && result.children !== undefined) {
        if (format === 'json') return textResult(JSON.stringify(result.children.map(serializeGameTreeNode), null, 2));
        return textResult(result.children.map(child => formatGameTreeNode(child)).join('\n') || 'No children');
      }

      return errorResult(`Error: ${result.error ?? 'Failed to get children'}`);
    } catch (err) {
      return errorResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  },

  'refresh_game_tree': async (_args, { bridge }) => {
    if (bridge.isConnected === false) return NOT_CONNECTED;
    bridge.requestGameTree();
    return textResult('Game tree refresh requested');
  },
};
