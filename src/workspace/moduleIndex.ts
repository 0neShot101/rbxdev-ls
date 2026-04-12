import * as fs from 'fs';
import * as path from 'path';

import { parse } from '@parser/parser';

import type { Chunk, FunctionExpression } from '@typings/ast';
import type {
  DataModelNode,
  ModuleExport,
  ModuleExportSignature,
  ModuleExportSignatureParam,
  ModuleFileEntry,
  ModuleInfo,
  RojoState,
} from '@typings/workspace';

import { resolveAnnotationToType } from './annotationResolver';

const buildSignature = (func: FunctionExpression): ModuleExportSignature => {
  const params: ModuleExportSignatureParam[] = [];
  for (const param of func.params) {
    if (param.name === undefined) continue;
    params.push({
      'name': param.name.name,
      'type': resolveAnnotationToType(param.type),
      'optional': false,
    });
  }
  return {
    params,
    'returnType': resolveAnnotationToType(func.returnType),
    'isVariadic': func.isVariadic,
  };
};

const extractModuleExports = (chunk: Chunk, filePath: string, dataModelPath: string[]): ModuleExport[] => {
  const exports: ModuleExport[] = [];
  const modulePath = dataModelPath.join('.');

  const returnStmt = chunk.body.find(s => s.kind === 'ReturnStatement');
  if (returnStmt === undefined || returnStmt.kind !== 'ReturnStatement') return exports;

  const returnValues = returnStmt.values;
  if (returnValues.length === 0) return exports;

  const returnValue = returnValues[0];
  if (returnValue === undefined) return exports;

  if (returnValue.kind === 'TableExpression') {
    for (const field of returnValue.fields) {
      if (field.kind === 'TableFieldKey') {
        const name = field.key.name;
        let kind: ModuleExport['kind'] = 'value';
        let signature: ModuleExportSignature | undefined;

        if (field.value.kind === 'FunctionExpression') {
          kind = 'function';
          signature = buildSignature(field.value);
        } else if (field.value.kind === 'TableExpression') {
          kind = 'table';
        }

        exports.push({ name, kind, modulePath, filePath, ...(signature !== undefined ? { signature } : {}) });
      }
    }
    return exports;
  }

  if (returnValue.kind === 'Identifier') {
    const varName = returnValue.name;

    for (const stmt of chunk.body) {
      if (stmt.kind === 'LocalDeclaration') {
        const idx = stmt.names.findIndex(n => n.name === varName);
        if (idx !== -1) {
          const value = stmt.values[idx];
          if (value?.kind === 'TableExpression') {
            for (const field of value.fields) {
              if (field.kind === 'TableFieldKey') {
                const name = field.key.name;
                let kind: ModuleExport['kind'] = 'value';
                let signature: ModuleExportSignature | undefined;

                if (field.value.kind === 'FunctionExpression') {
                  kind = 'function';
                  signature = buildSignature(field.value);
                } else if (field.value.kind === 'TableExpression') {
                  kind = 'table';
                }

                exports.push({
                  name,
                  kind,
                  modulePath,
                  filePath,
                  ...(signature !== undefined ? { signature } : {}),
                });
              }
            }
          }
          break;
        }
      }
    }

    for (const stmt of chunk.body) {
      if (stmt.kind === 'Assignment' && stmt.targets.length > 0 && stmt.values.length > 0) {
        const target = stmt.targets[0]!;
        if (
          target.kind === 'MemberExpression' &&
          target.object.kind === 'Identifier' &&
          target.object.name === varName
        ) {
          const name = target.property.name;
          const value = stmt.values[0];
          let kind: ModuleExport['kind'] = 'value';
          let signature: ModuleExportSignature | undefined;

          if (value?.kind === 'FunctionExpression') {
            kind = 'function';
            signature = buildSignature(value);
          } else if (value?.kind === 'TableExpression') {
            kind = 'table';
          }

          exports.push({ name, kind, modulePath, filePath, ...(signature !== undefined ? { signature } : {}) });
        }
      }

      if (stmt.kind === 'FunctionDeclaration' && stmt.name.base.name === varName) {
        const funcName = stmt.name.method?.name ?? stmt.name.path[stmt.name.path.length - 1]?.name;
        if (funcName !== undefined) {
          exports.push({
            'name': funcName,
            'kind': 'function',
            modulePath,
            filePath,
            'signature': buildSignature(stmt.func),
          });
        }
      }
    }

    exports.push({
      'name': dataModelPath[dataModelPath.length - 1] ?? 'Module',
      'kind': 'table',
      modulePath,
      filePath,
    });
  }

  return exports;
};

const scanDirectory = (dirPath: string, dataModelPath: string[], modules: Map<string, ModuleInfo>): void => {
  try {
    const entries = fs.readdirSync(dirPath, { 'withFileTypes': true });

    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        const initLua = path.join(entryPath, 'init.lua');
        const initLuau = path.join(entryPath, 'init.luau');

        if (fs.existsSync(initLua) || fs.existsSync(initLuau)) {
          const initPath = fs.existsSync(initLua) ? initLua : initLuau;
          const moduleName = entry.name;
          const newDataModelPath = [...dataModelPath, moduleName];

          try {
            const content = fs.readFileSync(initPath, 'utf-8');
            const stat = fs.statSync(initPath);
            const parseResult = parse(content);

            if (parseResult.ast !== undefined) {
              const exports = extractModuleExports(parseResult.ast, initPath, newDataModelPath);

              modules.set(initPath, {
                'filePath': initPath,
                'dataModelPath': newDataModelPath,
                exports,
                'lastModified': stat.mtimeMs,
              });
            }
          } catch {
            /* ignore */
          }

          scanDirectory(entryPath, newDataModelPath, modules);
        } else {
          scanDirectory(entryPath, [...dataModelPath, entry.name], modules);
        }
      } else if (entry.name.endsWith('.lua') || entry.name.endsWith('.luau')) {
        if (entry.name === 'init.lua' || entry.name === 'init.luau') continue;

        const baseName = entry.name.replace(/\.(lua|luau)$/, '').replace(/\.(server|client)$/, '');
        const newDataModelPath = [...dataModelPath, baseName];

        try {
          const content = fs.readFileSync(entryPath, 'utf-8');
          const stat = fs.statSync(entryPath);
          const parseResult = parse(content);

          if (parseResult.ast !== undefined) {
            const exports = extractModuleExports(parseResult.ast, entryPath, newDataModelPath);

            modules.set(entryPath, {
              'filePath': entryPath,
              'dataModelPath': newDataModelPath,
              exports,
              'lastModified': stat.mtimeMs,
            });
          }
        } catch {
          /* ignore */
        }
      }
    }
  } catch {
    /* ignore */
  }
};

/** Builds a complete module index from a Rojo project or workspace. */
export const buildModuleIndex = (rojoState: RojoState, workspacePath: string): Map<string, ModuleInfo> => {
  const modules = new Map<string, ModuleInfo>();

  if (rojoState.dataModel === undefined) {
    const commonDirs = ['src', 'lib', 'shared', 'common'];

    for (const dir of commonDirs) {
      const dirPath = path.join(workspacePath, dir);
      if (fs.existsSync(dirPath)) {
        scanDirectory(dirPath, [dir], modules);
      }
    }

    return modules;
  }

  const scanNode = (node: DataModelNode, dataModelPath: string[]) => {
    if (node.filePath !== undefined && fs.existsSync(node.filePath)) {
      const stat = fs.statSync(node.filePath);

      if (stat.isDirectory()) {
        scanDirectory(node.filePath, dataModelPath, modules);
      } else if (node.filePath.endsWith('.lua') || node.filePath.endsWith('.luau')) {
        try {
          const content = fs.readFileSync(node.filePath, 'utf-8');
          const parseResult = parse(content);

          if (parseResult.ast !== undefined) {
            const exports = extractModuleExports(parseResult.ast, node.filePath, dataModelPath);

            modules.set(node.filePath, {
              'filePath': node.filePath,
              dataModelPath,
              exports,
              'lastModified': stat.mtimeMs,
            });
          }
        } catch {
          /* ignore */
        }
      }
    }

    for (const [childName, childNode] of node.children) {
      scanNode(childNode, [...dataModelPath, childName]);
    }
  };

  scanNode(rojoState.dataModel, [rojoState.dataModel.name]);

  return modules;
};

/** Generates a Lua require path string to import one module from another. */
export const generateRequirePath = (fromDataModelPath: string[], toDataModelPath: string[]): string => {
  let commonLength = 0;
  const minLength = Math.min(fromDataModelPath.length, toDataModelPath.length);

  for (let i = 0; i < minLength; i++) {
    if (fromDataModelPath[i] === toDataModelPath[i]) {
      commonLength = i + 1;
    } else {
      break;
    }
  }

  const parts: string[] = [];

  const upCount = fromDataModelPath.length - commonLength - 1;
  if (upCount > 0) {
    parts.push('script');
    for (let i = 0; i < upCount; i++) {
      parts.push('Parent');
    }
  } else if (commonLength === 0) {
    return `game.${toDataModelPath.join('.')}`;
  } else {
    parts.push('script');
    parts.push('Parent');
  }

  for (let i = commonLength; i < toDataModelPath.length; i++) {
    parts.push(toDataModelPath[i]!);
  }

  return parts.join('.');
};

/** Searches all indexed module exports by name using a case-insensitive prefix match. */
export const searchExports = (modules: Map<string, ModuleInfo>, query: string, limit = 20): ModuleExport[] => {
  const results: ModuleExport[] = [];
  const lowerQuery = query.toLowerCase();

  for (const [, moduleInfo] of modules) {
    for (const exp of moduleInfo.exports) {
      if (exp.name.toLowerCase().startsWith(lowerQuery)) {
        results.push(exp);
        if (results.length >= limit) return results;
      }
    }
  }

  return results;
};

/** Resolves a local module path relative to the current file. */
export const resolveLocalModule = (relativePath: string, currentFilePath: string): ModuleInfo | undefined => {
  const currentDir = path.dirname(currentFilePath);
  const resolved = path.resolve(currentDir, relativePath);

  const candidates = [
    resolved,
    `${resolved}.lua`,
    `${resolved}.luau`,
    path.join(resolved, 'init.lua'),
    path.join(resolved, 'init.luau'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) === false) continue;

    const stat = fs.statSync(candidate);
    if (stat.isDirectory()) continue;

    try {
      const content = fs.readFileSync(candidate, 'utf-8');
      const parseResult = parse(content);
      if (parseResult.ast === undefined) continue;

      const baseName = path.basename(resolved).replace(/\.(lua|luau)$/, '');
      const dataModelPath = [baseName];
      const exports = extractModuleExports(parseResult.ast, candidate, dataModelPath);

      return {
        'filePath': candidate,
        dataModelPath,
        exports,
        'lastModified': stat.mtimeMs,
      };
    } catch {
      continue;
    }
  }

  return undefined;
};

/** Lists Lua/Luau files in a directory with metadata for require path completions. */
export const listModuleFiles = (dirPath: string): ModuleFileEntry[] => {
  if (fs.existsSync(dirPath) === false) return [];

  try {
    const entries = fs.readdirSync(dirPath, { 'withFileTypes': true });
    const results: ModuleFileEntry[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const initLua = path.join(dirPath, entry.name, 'init.lua');
        const initLuau = path.join(dirPath, entry.name, 'init.luau');
        const initPath = fs.existsSync(initLua) ? initLua : fs.existsSync(initLuau) ? initLuau : undefined;
        if (initPath === undefined) continue;

        const ext: '.lua' | '.luau' = initPath.endsWith('.luau') ? '.luau' : '.lua';
        const exports = extractFileExports(initPath, [entry.name]);
        results.push({ 'name': entry.name, ext, 'isFolder': true, 'filePath': initPath, exports });
      } else if (entry.name.endsWith('.lua') || entry.name.endsWith('.luau')) {
        if (entry.name === 'init.lua' || entry.name === 'init.luau') continue;
        const baseName = entry.name.replace(/\.(lua|luau)$/, '');
        const ext: '.lua' | '.luau' = entry.name.endsWith('.luau') ? '.luau' : '.lua';
        const filePath = path.join(dirPath, entry.name);
        const exports = extractFileExports(filePath, [baseName]);
        results.push({ 'name': baseName, ext, 'isFolder': false, filePath, exports });
      }
    }

    return results;
  } catch {
    return [];
  }
};

const extractFileExports = (filePath: string, dataModelPath: string[]): ModuleExport[] => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parseResult = parse(content);
    if (parseResult.ast === undefined) return [];
    return extractModuleExports(parseResult.ast, filePath, dataModelPath);
  } catch {
    return [];
  }
};
