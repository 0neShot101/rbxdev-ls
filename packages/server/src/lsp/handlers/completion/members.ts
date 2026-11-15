import { CompletionItemKind, CompletionItemTag, InsertTextFormat, MarkupKind } from 'vscode-languageserver';

import { COMMON_CHILDREN } from '@definitions/commonChildren';
import { resolveExpressionType, resolveTypeReference } from '@lsp/handlers/completion/expression';
import { formatFunctionDetail, formatFunctionSnippet, typeToCompletionKind } from '@lsp/handlers/completion/format';
import { debugLog, traceVarExpression, VARIABLE_NAME_HINTS } from '@lsp/handlers/completion/inference';
import { getLiveGameTreeCompletions, getLiveGameTreeNodeType } from '@lsp/handlers/completion/live';
import { extractExpressionChain, parseGameTreePath } from '@lsp/handlers/completion/paths';

import type { MemberContext } from '@typings/completion';
import type { DocumentManager } from '@typings/lsp';
import type { ClassType, TableType } from '@typings/types';
import type { CompletionItem, CompletionList } from 'vscode-languageserver';

const getTableCompletions = (table: TableType, prefix: string): CompletionItem[] => {
  const items: CompletionItem[] = [];

  for (const [name, prop] of table.properties) {
    if (prefix !== '' && name.toLowerCase().startsWith(prefix.toLowerCase()) === false) continue;

    const item: CompletionItem = {
      'label': name,
      'kind': typeToCompletionKind(prop.type),
    };

    if (prop.type.kind === 'Function') {
      item.detail = formatFunctionDetail(prop.type);
      item.insertText = formatFunctionSnippet(name, prop.type);
      item.insertTextFormat = InsertTextFormat.Snippet;
    }

    if (prop.deprecated === true) {
      item.tags = [CompletionItemTag.Deprecated];
      if (prop.deprecationMessage !== undefined) item.detail = `(deprecated) ${prop.deprecationMessage}`;
      else item.detail = '(deprecated)';
    }

    items.push(item);
  }

  return items;
};

const getCommonChildrenForClass = (
  className: string,
  getSuperclass: (name: string) => string | undefined,
): Map<string, string> => {
  const result = new Map<string, string>();
  let currentClass: string | undefined = className;

  while (currentClass !== undefined) {
    const children = COMMON_CHILDREN.get(currentClass);
    if (children !== undefined)
      for (const [childName, childType] of children)
        if (result.has(childName) === false) result.set(childName, childType);
    currentClass = getSuperclass(currentClass);
  }

  return result;
};

const getClassCompletions = (
  cls: ClassType,
  prefix: string,
  useColon: boolean,
  documentManager?: DocumentManager,
): CompletionItem[] => {
  const items: CompletionItem[] = [];
  const addedNames = new Set<string>();

  for (const [name, prop] of cls.properties) {
    if (prefix !== '' && name.toLowerCase().startsWith(prefix.toLowerCase()) === false) continue;

    const item: CompletionItem = {
      'label': name,
      'kind': typeToCompletionKind(prop.type),
    };

    if (prop.type.kind === 'Function') {
      item.detail = formatFunctionDetail(prop.type);
      item.insertText = formatFunctionSnippet(name, prop.type);
      item.insertTextFormat = InsertTextFormat.Snippet;
    }

    if (prop.deprecated === true) {
      item.tags = [CompletionItemTag.Deprecated];
      if (prop.deprecationMessage !== undefined) item.detail = `(deprecated) ${prop.deprecationMessage}`;
      else item.detail = '(deprecated)';
    }

    item.data = { 'resolve': 'member', 'class': cls.name, 'member': name };

    items.push(item);
    addedNames.add(name);
  }

  for (const [name, method] of cls.methods) {
    if (prefix !== '' && name.toLowerCase().startsWith(prefix.toLowerCase()) === false) continue;

    const item: CompletionItem = {
      'label': name,
      'kind': CompletionItemKind.Method,
      'detail': formatFunctionDetail(method.func),
      'insertText': formatFunctionSnippet(name, method.func),
      'insertTextFormat': InsertTextFormat.Snippet,
    };

    if (method.deprecated === true) {
      item.tags = [CompletionItemTag.Deprecated];
      if (method.deprecationMessage !== undefined) item.detail = `(deprecated) ${method.deprecationMessage}`;
      else item.detail = '(deprecated)';
    }

    item.data = { 'resolve': 'member', 'class': cls.name, 'member': name };

    items.push(item);
    addedNames.add(name);
  }

  if (cls.superclass !== undefined) {
    const inherited = getClassCompletions(cls.superclass, prefix, useColon, documentManager);
    for (const item of inherited)
      if (addedNames.has(item.label) === false) {
        items.push(item);
        addedNames.add(item.label);
      }
  }

  if (useColon === false && documentManager !== undefined) {
    const getSuperclass = (className: string): string | undefined => {
      const classType = documentManager.globalEnv.robloxClasses.get(className);
      if (classType !== undefined && classType.kind === 'Class' && classType.superclass !== undefined)
        return classType.superclass.name;
      return undefined;
    };

    const commonChildren = getCommonChildrenForClass(cls.name, getSuperclass);
    for (const [childName, childTypeName] of commonChildren) {
      if (addedNames.has(childName)) continue;
      if (prefix !== '' && childName.toLowerCase().startsWith(prefix.toLowerCase()) === false) continue;

      items.push({
        'label': childName,
        'kind': CompletionItemKind.Field,
        'detail': `(child) ${childTypeName}`,
        'sortText': `z${childName}`,
        'documentation': {
          'kind': MarkupKind.Markdown,
          'value': `Common child instance of type \`${childTypeName}\`\n\nAccessed via \`FindFirstChild("${childName}")\` or direct indexing.`,
        },
      });
      addedNames.add(childName);
    }
  }

  return items;
};

/** Completes members of the expression before the cursor; `undefined` continues with general completions. */
export const completeMembers = async (context: MemberContext): Promise<CompletionList | undefined> => {
  const { document, content, beforeCursor, uri, documentManager, executorBridge, log } = context;
  const liveGameModel = executorBridge.liveGameModel;

  const chainInfo = extractExpressionChain(beforeCursor);
  log(`chainInfo: ${JSON.stringify(chainInfo)}`);
  if (chainInfo !== null && chainInfo !== undefined) {
    let gameTreePath = parseGameTreePath(chainInfo.expression);

    if (gameTreePath === undefined) {
      const traceFirst = chainInfo.expression.split(/[.:]/)[0]?.trim();
      if (traceFirst !== undefined) {
        const tracedExpr = traceVarExpression(traceFirst, content);
        if (tracedExpr !== undefined) {
          const fullExpr = chainInfo.expression.replace(traceFirst, tracedExpr);
          gameTreePath = parseGameTreePath(fullExpr) ?? undefined;
          log(`Traced '${traceFirst}' → '${tracedExpr}', gameTreePath: ${JSON.stringify(gameTreePath)}`);
        }
      }
    }

    log(`gameTreePath: ${JSON.stringify(gameTreePath)}`);

    let resolvedType = resolveExpressionType(chainInfo.expression, documentManager, document, content, log, uri);
    log(`resolvedType: ${resolvedType?.kind}${resolvedType?.kind === 'Class' ? ` (${resolvedType.name})` : ''}`);

    if (resolvedType !== undefined && resolvedType.kind === 'TypeReference')
      resolvedType = resolveTypeReference(resolvedType, documentManager);

    if (resolvedType !== undefined) {
      if (resolvedType.kind === 'Class') {
        const classItems = getClassCompletions(
          resolvedType,
          chainInfo.prefix,
          chainInfo.isMethodAccess,
          documentManager,
        );

        if (gameTreePath !== undefined && chainInfo.isMethodAccess === false) {
          const liveItems = getLiveGameTreeCompletions(gameTreePath, chainInfo.prefix, liveGameModel);
          log(`liveItems count: ${liveItems.length}`);

          const seenNames = new Set(liveItems.map(i => i.label));
          const uniqueClassItems = classItems.filter(i => seenNames.has(i.label) === false);

          return {
            'isIncomplete': true,
            'items': [...liveItems, ...uniqueClassItems],
          };
        }

        return {
          'isIncomplete': true,
          'items': classItems,
        };
      }
      if (resolvedType.kind === 'Table')
        return {
          'isIncomplete': true,
          'items': getTableCompletions(resolvedType, chainInfo.prefix),
        };
    }

    if (resolvedType === undefined && executorBridge.isConnected) {
      const firstName = chainInfo.expression.split(/[.:]/)[0]?.trim();
      if (firstName !== undefined) {
        const assignExpr = traceVarExpression(firstName, content);
        log(`Traced '${firstName}' to: ${assignExpr ?? 'undefined'}`);

        const reqExprMatch = assignExpr?.match(/^require\s*\(\s*([^)]+)\s*\)(.*)/);
        if (reqExprMatch !== null && reqExprMatch !== undefined && reqExprMatch[1] !== undefined) {
          const rawModulePath = reqExprMatch[1].trim();
          const rawChain = (reqExprMatch[2] ?? '').trim();
          const parenIdx = rawChain.indexOf('(');
          const chainedCall = parenIdx >= 0 ? rawChain.slice(0, parenIdx) + '()' : rawChain;
          log(`Trying executor bridge for require: ${rawModulePath}${chainedCall}`);
          try {
            const serviceNames = [
              'ReplicatedStorage',
              'ReplicatedFirst',
              'ServerStorage',
              'ServerScriptService',
              'StarterGui',
              'StarterPack',
              'StarterPlayer',
              'Lighting',
              'SoundService',
              'Workspace',
              'Players',
              'Chat',
              'Teams',
            ];
            const preamble: string[] = [];
            for (const svc of serviceNames)
              if (rawModulePath.startsWith(svc)) {
                preamble.push(`local ${svc} = game:GetService("${svc}")`);
                break;
              }
            const modulePath = rawModulePath;

            const inspectScript = [
              ...preamble,
              `local mod = require(${modulePath})`,
              chainedCall.length > 0 ? `mod = mod${chainedCall}` : '',
              'local result = {}',
              'local visited = {}',
              'local current = mod',
              'while current and type(current) == "table" do',
              '  if visited[current] then break end',
              '  visited[current] = true',
              '  for k, v in pairs(current) do',
              '    if type(k) == "string" and not result[k] and k:sub(1,2) ~= "__" then',
              '      result[k] = type(v)',
              '    end',
              '  end',
              '  local mt = getmetatable(current)',
              '  current = mt and type(mt) == "table" and mt.__index or nil',
              'end',
              'return game:GetService("HttpService"):JSONEncode(result)',
            ]
              .filter(l => l.length > 0)
              .join('\n');

            const execResult = await executorBridge.execute(inspectScript);
            log(
              `Bridge exec result: success=${execResult.success}, result=${execResult.result ?? 'undefined'}, error=${execResult.error?.message ?? 'none'}`,
            );
            if (execResult.success && execResult.result !== undefined) {
              const members: Record<string, string> = JSON.parse(execResult.result);
              const items: CompletionItem[] = [];
              for (const [name, valueType] of Object.entries(members))
                items.push({
                  'label': name,
                  'kind': valueType === 'function' ? CompletionItemKind.Function : CompletionItemKind.Field,
                  'detail': valueType,
                  'sortText': `0_${name}`,
                });
              if (items.length > 0) return { 'isIncomplete': true, items };
            }
          } catch {
            log(`Executor bridge inspect request failed`);
          }
        }
      }
    }

    if (gameTreePath !== undefined) {
      const liveNodeType = getLiveGameTreeNodeType(gameTreePath, liveGameModel, documentManager);
      log(
        `liveNodeType: ${liveNodeType?.kind ?? 'undefined'}${liveNodeType?.kind === 'Class' ? ` (${liveNodeType.name})` : ''}`,
      );

      if (liveNodeType !== undefined) {
        const classItems = getClassCompletions(
          liveNodeType,
          chainInfo.prefix,
          chainInfo.isMethodAccess,
          documentManager,
        );

        if (chainInfo.isMethodAccess === false) {
          const liveItems = getLiveGameTreeCompletions(gameTreePath, chainInfo.prefix, liveGameModel);
          log(`liveItems (from type) count: ${liveItems.length}`);

          const seenNames = new Set(liveItems.map(i => i.label));
          const uniqueClassItems = classItems.filter(i => seenNames.has(i.label) === false);

          return {
            'isIncomplete': true,
            'items': [...liveItems, ...uniqueClassItems],
          };
        }

        return {
          'isIncomplete': true,
          'items': classItems,
        };
      }

      if (chainInfo.isMethodAccess === false) {
        const liveItems = getLiveGameTreeCompletions(gameTreePath, chainInfo.prefix, liveGameModel);
        log(`liveItems (fallback) count: ${liveItems.length}`);

        const lastPathSegment = gameTreePath[gameTreePath.length - 1];
        let staticClassItems: CompletionItem[] = [];

        if (lastPathSegment !== undefined) {
          const classType = documentManager.globalEnv.robloxClasses.get(lastPathSegment);
          if (classType !== undefined && classType.kind === 'Class') {
            staticClassItems = getClassCompletions(classType, chainInfo.prefix, false, documentManager);
            log(`staticClassItems (from path) count: ${staticClassItems.length}`);
          }
        }

        if (liveItems.length > 0 || staticClassItems.length > 0) {
          const seenNames = new Set(liveItems.map(i => i.label));
          const uniqueStaticItems = staticClassItems.filter(i => seenNames.has(i.label) === false);

          return {
            'isIncomplete': true,
            'items': [...liveItems, ...uniqueStaticItems],
          };
        }
      }
    }

    const hasChain =
      chainInfo.expression.includes('.') || chainInfo.expression.includes(':') || chainInfo.expression.includes('[');

    if (hasChain) return { 'isIncomplete': false, 'items': [] };

    const classType = documentManager.globalEnv.robloxClasses.get(chainInfo.expression);
    if (classType !== undefined && classType.kind === 'Class')
      return {
        'isIncomplete': true,
        'items': getClassCompletions(classType, chainInfo.prefix, chainInfo.isMethodAccess, documentManager),
      };

    const hintedClass = VARIABLE_NAME_HINTS.get(chainInfo.expression.toLowerCase());
    if (hintedClass !== undefined) {
      const hintedClassType = documentManager.globalEnv.robloxClasses.get(hintedClass);
      if (hintedClassType !== undefined && hintedClassType.kind === 'Class')
        return {
          'isIncomplete': true,
          'items': getClassCompletions(hintedClassType, chainInfo.prefix, chainInfo.isMethodAccess, documentManager),
        };
    }
  }

  debugLog('Fallback: trying simple member/method patterns');
  const memberMatch = beforeCursor.match(/(\w+)\.(\w*)$/);
  const methodMatch = beforeCursor.match(/(\w+):(\w*)$/);
  debugLog('methodMatch:', methodMatch);

  if (memberMatch !== null) {
    const [, objectName, prefix] = memberMatch;
    if (objectName === undefined) return { 'isIncomplete': false, 'items': [] };

    if (document?.typeCheckResult !== undefined) {
      const localType = document.typeCheckResult.allSymbols.get(objectName);
      if (localType !== undefined) {
        const resolved = resolveTypeReference(localType, documentManager);
        if (resolved.kind === 'Table')
          return {
            'isIncomplete': true,
            'items': getTableCompletions(resolved, prefix ?? ''),
          };
        if (resolved.kind === 'Class')
          return {
            'isIncomplete': true,
            'items': getClassCompletions(resolved, prefix ?? '', false, documentManager),
          };
      }
    }

    const symbol = documentManager.globalEnv.env.globalScope.symbols.get(objectName);
    if (symbol !== undefined) {
      if (symbol.type.kind === 'Table')
        return {
          'isIncomplete': true,
          'items': getTableCompletions(symbol.type, prefix ?? ''),
        };
      if (symbol.type.kind === 'Class')
        return {
          'isIncomplete': true,
          'items': getClassCompletions(symbol.type, prefix ?? '', false, documentManager),
        };
    }

    const classType = documentManager.globalEnv.robloxClasses.get(objectName);
    if (classType !== undefined && classType.kind === 'Class')
      return {
        'isIncomplete': true,
        'items': getClassCompletions(classType, prefix ?? '', false, documentManager),
      };

    const hintedClass = VARIABLE_NAME_HINTS.get(objectName.toLowerCase());
    if (hintedClass !== undefined) {
      const hintedClassType = documentManager.globalEnv.robloxClasses.get(hintedClass);
      if (hintedClassType !== undefined && hintedClassType.kind === 'Class')
        return {
          'isIncomplete': true,
          'items': getClassCompletions(hintedClassType, prefix ?? '', false, documentManager),
        };
    }
  }

  if (methodMatch !== null) {
    const [, objectName, prefix] = methodMatch;
    if (objectName === undefined) return { 'isIncomplete': false, 'items': [] };

    if (document?.typeCheckResult !== undefined) {
      const localType = document.typeCheckResult.allSymbols.get(objectName);
      if (localType !== undefined) {
        const resolved = resolveTypeReference(localType, documentManager);
        if (resolved.kind === 'Class')
          return {
            'isIncomplete': true,
            'items': getClassCompletions(resolved, prefix ?? '', true, documentManager),
          };
        if (resolved.kind === 'Table')
          return {
            'isIncomplete': true,
            'items': getTableCompletions(resolved, prefix ?? ''),
          };
      }
    }

    const symbol = documentManager.globalEnv.env.globalScope.symbols.get(objectName);
    if (symbol !== undefined && symbol.type.kind === 'Class')
      return {
        'isIncomplete': true,
        'items': getClassCompletions(symbol.type, prefix ?? '', true, documentManager),
      };

    const classType = documentManager.globalEnv.robloxClasses.get(objectName);
    if (classType !== undefined && classType.kind === 'Class')
      return {
        'isIncomplete': true,
        'items': getClassCompletions(classType, prefix ?? '', true, documentManager),
      };

    const hintedClass = VARIABLE_NAME_HINTS.get(objectName.toLowerCase());
    if (hintedClass !== undefined) {
      const hintedClassType = documentManager.globalEnv.robloxClasses.get(hintedClass);
      if (hintedClassType !== undefined && hintedClassType.kind === 'Class')
        return {
          'isIncomplete': true,
          'items': getClassCompletions(hintedClassType, prefix ?? '', true, documentManager),
        };
    }
  }

  return undefined;
};
