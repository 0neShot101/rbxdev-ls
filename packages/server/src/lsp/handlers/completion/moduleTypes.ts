import { AnyType, createFunctionType, createTableType } from '@analyzer/values';
import { splitMemberExpression } from '@lsp/handlers/completion/paths';
import { resolveLocalModule } from '@workspace/moduleIndex';

import type { DocumentManager } from '@typings/lsp';
import type { LuauType, PropertyType } from '@typings/types';
import type { ModuleInfo } from '@typings/workspace';

const moduleExportsToTableType = (moduleInfo: ModuleInfo): LuauType => {
  const properties = new Map<string, PropertyType>();
  for (const exp of moduleInfo.exports) {
    let propType: LuauType;
    switch (exp.kind) {
      case 'function':
        propType = createFunctionType([], AnyType);
        break;
      case 'table':
        propType = createTableType(new Map());
        break;
      default:
        propType = AnyType;
        break;
    }
    properties.set(exp.name, { 'type': propType, 'readonly': true, 'optional': false });
  }
  return createTableType(properties);
};

/** Resolves the exported table type of a `require` argument through the workspace module index. */
export const resolveRequireModuleType = (
  requireArg: string,
  documentManager: DocumentManager,
  documentUri?: string,
): LuauType | undefined => {
  const stringMatch = requireArg.match(/^["'](\.\.?\/[^"']+)["']$/);
  const relativePath = stringMatch?.[1];
  if (relativePath !== undefined && documentUri !== undefined) {
    let filePath: string;
    try {
      filePath = decodeURIComponent(new URL(documentUri).pathname);
      if (filePath.match(/^\/[A-Za-z]:/) !== null) filePath = filePath.slice(1);
    } catch {
      return undefined;
    }

    const moduleInfo = resolveLocalModule(relativePath, filePath);
    if (moduleInfo !== undefined && moduleInfo.exports.length > 0) return moduleExportsToTableType(moduleInfo);
    return undefined;
  }

  const gamePrefix = requireArg.match(/^game\s*[.[]/);
  const rawExpr =
    gamePrefix !== null ? requireArg.slice(gamePrefix[0].length - (gamePrefix[0].endsWith('[') ? 1 : 0)) : requireArg;

  const pathParts = splitMemberExpression(rawExpr).filter(p => p.length > 0);

  if (pathParts.length === 0) return undefined;

  const moduleIndex = documentManager.getModuleIndex();

  const stripScriptSuffix = (name: string): string => name.replace(/\.(client|server)$/, '');

  for (const [, moduleInfo] of moduleIndex) {
    const dmPath = moduleInfo.dataModelPath;
    if (dmPath.length < pathParts.length) continue;

    const offset = dmPath.length - pathParts.length;
    let matches = true;
    for (let i = 0; i < pathParts.length; i++) {
      const expected = pathParts[i] ?? '';
      const actual = dmPath[offset + i] ?? '';
      if (
        actual !== expected &&
        actual !== stripScriptSuffix(expected) &&
        stripScriptSuffix(actual) !== stripScriptSuffix(expected)
      ) {
        matches = false;
        break;
      }
    }
    if (matches && moduleInfo.exports.length > 0) return moduleExportsToTableType(moduleInfo);
  }

  return undefined;
};
