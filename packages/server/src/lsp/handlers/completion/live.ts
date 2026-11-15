import { CompletionItemKind, MarkupKind } from 'vscode-languageserver';

import { extractRequireExpression, parseGameTreePath } from '@lsp/handlers/completion/paths';

import type { ExecutorBridge, LiveGameModel } from '@typings/bridge';
import type { DocumentManager } from '@typings/lsp';
import type { ClassType } from '@typings/types';
import type { CompletionItem } from 'vscode-languageserver';

/** Suggests services of the connected live game inside a service-name string. */
export const getLiveServiceCompletions = (
  beforeCursor: string,
  liveGameModel: LiveGameModel,
): CompletionItem[] | undefined => {
  if (/game\s*:\s*[Gg]et[Ss]ervice\s*(?:\(\s*)?["'][^"']*$/.test(beforeCursor) === false) return undefined;

  if (liveGameModel.isConnected === false) return undefined;

  const match = beforeCursor.match(/["']([^"']*)$/);
  const prefix = match?.[1]?.toLowerCase() ?? '';

  const services = liveGameModel.services;
  if (services.size === 0) return undefined;

  const items: CompletionItem[] = [];

  for (const [name, node] of services) {
    if (prefix !== '' && name.toLowerCase().startsWith(prefix) === false) continue;

    const childCount = node.children?.length ?? 0;

    items.push({
      'label': name,
      'kind': CompletionItemKind.Module,
      'detail': `(live) ${childCount} children`,
      'insertText': name,
      'sortText': `0_${name}`,
      'documentation': {
        'kind': MarkupKind.Markdown,
        'value': `Live service from connected game\n\n**Class:** \`${node.className}\`\n**Children:** ${childCount}`,
      },
    });
  }

  return items.length > 0 ? items : undefined;
};

/** Suggests live game children inside a bracketed string index. */
export const getBracketCompletions = (
  beforeCursor: string,
  liveGameModel: LiveGameModel,
): CompletionItem[] | undefined => {
  const bracketMatch = beforeCursor.match(
    /([a-zA-Z_]\w*(?:\s*[.:]\s*[a-zA-Z_]\w*|\s*\([^)]*\)|\s*\[[^\]]*\])*)\s*\[\s*["']([^"']*)$/,
  );

  if (bracketMatch === null) return undefined;

  const [, expr, prefix] = bracketMatch;
  if (expr === undefined) return undefined;

  const path = parseGameTreePath(expr.replace(/\s+/g, ''));
  if (path === undefined) return undefined;

  if (liveGameModel.isConnected === false) return undefined;

  const children = liveGameModel.getChildren(path);
  if (children === undefined || children.size === 0) return undefined;

  const items: CompletionItem[] = [];
  const lowerPrefix = (prefix ?? '').toLowerCase();

  for (const [name, node] of children) {
    if (lowerPrefix !== '' && name.toLowerCase().startsWith(lowerPrefix) === false) continue;

    items.push({
      'label': name,
      'kind': CompletionItemKind.Field,
      'detail': `(live) ${node.className}`,
      'insertText': name,
      'sortText': `0_${name}`,
      'documentation': {
        'kind': MarkupKind.Markdown,
        'value': `Live instance: \`${node.className}\``,
      },
    });
  }

  return items.length > 0 ? items : undefined;
};

/** Returns the Roblox class of a live game tree node. */
export const getLiveGameTreeNodeType = (
  path: string[],
  liveGameModel: LiveGameModel,
  documentManager: DocumentManager,
): ClassType | undefined => {
  if (liveGameModel.isConnected === false) return undefined;
  if (path.length === 0) return undefined;

  const node = liveGameModel.getNode(path);
  if (node === undefined) return undefined;

  const classType = documentManager.globalEnv.robloxClasses.get(node.className);
  if (classType !== undefined && classType.kind === 'Class') return classType;

  return undefined;
};

/** Suggests the children of a live game tree node. */
export const getLiveGameTreeCompletions = (
  path: string[],
  prefix: string,
  liveGameModel: LiveGameModel,
): CompletionItem[] => {
  if (liveGameModel.isConnected === false) return [];

  const children = liveGameModel.getChildren(path);
  if (children === undefined) return [];

  const items: CompletionItem[] = [];

  for (const [name, node] of children) {
    if (prefix !== '' && name.toLowerCase().startsWith(prefix.toLowerCase()) === false) continue;

    items.push({
      'label': name,
      'kind': CompletionItemKind.Field,
      'detail': `(live) ${node.className}`,
      'sortText': `0_${name}`,
      'documentation': {
        'kind': MarkupKind.Markdown,
        'value': `Live instance from connected game\n\n**Class:** \`${node.className}\`${node.children !== undefined ? `\n**Children:** ${node.children.length}` : ''}`,
      },
    });
  }

  return items;
};

const moduleInterfaceCache = new Map<string, { items: CompletionItem[]; timestamp: number }>();
const MODULE_CACHE_TTL = 30_000;

/** Suggests members of a required ModuleScript by inspecting it through the executor bridge, cached for 30 seconds. */
export const getRequireModuleCompletions = async (
  beforeCursor: string,
  executorBridge: ExecutorBridge,
): Promise<CompletionItem[] | undefined> => {
  if (executorBridge.isConnected === false) return undefined;

  const moduleRef = extractRequireExpression(beforeCursor);
  if (moduleRef === undefined) return undefined;

  const cacheKey = moduleRef.kind === 'path' ? moduleRef.path.join('.') : String(moduleRef.id);
  const cached = moduleInterfaceCache.get(cacheKey);
  if (cached !== undefined && Date.now() - cached.timestamp < MODULE_CACHE_TTL) return cached.items;

  try {
    const result = await executorBridge.requestModuleInterface(moduleRef);
    if (result.success === false || result.interface === undefined) return undefined;

    const items: CompletionItem[] = [];
    const moduleInterface = result.interface;

    if (moduleInterface.kind === 'table' && moduleInterface.properties !== undefined)
      for (const prop of moduleInterface.properties) {
        if (prop.name.startsWith('__')) continue;
        const item: CompletionItem = {
          'label': prop.name,
          'kind': prop.valueKind === 'function' ? CompletionItemKind.Function : CompletionItemKind.Field,
          'detail': `(runtime) ${prop.valueKind}`,
          'sortText': `0_${prop.name}`,
        };

        if (prop.valueKind === 'function' && prop.functionArity !== undefined)
          item.detail = `(runtime) function (${prop.functionArity} params)`;

        items.push(item);
      }

    if (items.length > 0) {
      moduleInterfaceCache.set(cacheKey, { items, 'timestamp': Date.now() });
      return items;
    }
    return undefined;
  } catch {
    return undefined;
  }
};
