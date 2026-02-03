/**
 * Module Index
 * Scans workspace for modules and tracks their exports for auto-imports
 */

import * as fs from 'fs';
import * as path from 'path';

import { parse } from '@parser/parser';

import type { Chunk } from '@parser/ast';
import type { DataModelNode, RojoState } from '@workspace/rojo';

/**
 * Represents an individual export from a Lua module.
 * Contains metadata about the export including its name, type, and location.
 */
export interface ModuleExport {
  /** The name of the exported symbol (function name, table key, or value name) */
  readonly name: string;
  /** The type of export: function, table, value, or type definition */
  readonly kind: 'function' | 'table' | 'value' | 'type';
  /** The Roblox DataModel path to the module (e.g., "ReplicatedStorage.Modules.Utils") */
  readonly modulePath: string;
  /** The absolute filesystem path to the source file */
  readonly filePath: string;
}

/**
 * Contains complete information about a scanned Lua module.
 * Includes the module's location, exports, and modification timestamp for cache invalidation.
 */
export interface ModuleInfo {
  /** The absolute filesystem path to the module file */
  readonly filePath: string;
  /** Array of path segments representing the DataModel hierarchy (e.g., ["ReplicatedStorage", "Modules", "Utils"]) */
  readonly dataModelPath: string[];
  /** List of all exports discovered in the module */
  readonly exports: ModuleExport[];
  /** Unix timestamp (milliseconds) of the last file modification, used for cache invalidation */
  readonly lastModified: number;
}

/**
 * Extracts exports from a Lua module by analyzing its return statement.
 * Parses the AST to identify functions, tables, and values that are exported.
 * Handles both direct table returns and identifier returns that reference local declarations.
 *
 * @param chunk - The parsed AST chunk representing the module's code
 * @param filePath - The absolute filesystem path to the module file
 * @param dataModelPath - Array of path segments representing the module's DataModel location
 * @returns An array of ModuleExport objects representing all discovered exports
 */
const extractModuleExports = (chunk: Chunk, filePath: string, dataModelPath: string[]): ModuleExport[] => {
  const exports: ModuleExport[] = [];
  const modulePath = dataModelPath.join('.');

  // Find the return statement
  const returnStmt = chunk.body.find(s => s.kind === 'ReturnStatement');
  if (returnStmt === undefined || returnStmt.kind !== 'ReturnStatement') return exports;

  const returnValues = returnStmt.values;
  if (returnValues.length === 0) return exports;

  const returnValue = returnValues[0];
  if (returnValue === undefined) return exports;

  // If returning a table, extract its fields
  if (returnValue.kind === 'TableExpression') {
    for (const field of returnValue.fields) {
      if (field.kind === 'TableFieldKey') {
        const name = field.key.name;
        let kind: ModuleExport['kind'] = 'value';

        if (field.value.kind === 'FunctionExpression') {
          kind = 'function';
        } else if (field.value.kind === 'TableExpression') {
          kind = 'table';
        }

        exports.push({ name, kind, modulePath, filePath });
      }
    }
    return exports;
  }

  // If returning an identifier, look for it in local declarations
  if (returnValue.kind === 'Identifier') {
    const varName = returnValue.name;

    // Find the local declaration
    for (const stmt of chunk.body) {
      if (stmt.kind === 'LocalDeclaration') {
        const idx = stmt.names.findIndex(n => n.name === varName);
        if (idx !== -1) {
          const value = stmt.values[idx];
          if (value?.kind === 'TableExpression') {
            // Extract table fields
            for (const field of value.fields) {
              if (field.kind === 'TableFieldKey') {
                const name = field.key.name;
                let kind: ModuleExport['kind'] = 'value';

                if (field.value.kind === 'FunctionExpression') {
                  kind = 'function';
                } else if (field.value.kind === 'TableExpression') {
                  kind = 'table';
                }

                exports.push({ name, kind, modulePath, filePath });
              }
            }
          }
          break;
        }
      }
    }

    // Also add the module itself as an export
    exports.push({
      'name': dataModelPath[dataModelPath.length - 1] ?? 'Module',
      'kind': 'table',
      modulePath,
      filePath,
    });
  }

  return exports;
};

/**
 * Recursively scans a directory for Lua modules and populates the modules map.
 * Identifies modules by their file extensions (.lua, .luau) and handles init files
 * for folder-based modules. Skips server and client scripts.
 *
 * @param dirPath - The absolute path to the directory to scan
 * @param dataModelPath - Array of path segments representing the current DataModel location
 * @param modules - Map to populate with discovered ModuleInfo entries, keyed by file path
 * @returns void - The function mutates the modules map in place
 */
const scanDirectory = (dirPath: string, dataModelPath: string[], modules: Map<string, ModuleInfo>): void => {
  try {
    const entries = fs.readdirSync(dirPath, { 'withFileTypes': true });

    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Check for init.lua or init.luau
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
            // Skip files that can't be read or parsed
          }

          // Recursively scan subdirectories
          scanDirectory(entryPath, newDataModelPath, modules);
        } else {
          // Regular folder without init
          scanDirectory(entryPath, [...dataModelPath, entry.name], modules);
        }
      } else if (entry.name.endsWith('.lua') || entry.name.endsWith('.luau')) {
        // Skip init files (handled above) and server/client scripts
        if (entry.name === 'init.lua' || entry.name === 'init.luau') continue;
        if (entry.name.includes('.server.') || entry.name.includes('.client.')) continue;

        const baseName = entry.name.replace(/\.(lua|luau)$/, '');
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
          // Skip files that can't be read or parsed
        }
      }
    }
  } catch {
    // Directory might not be readable
  }
};

/**
 * Builds a complete module index from a Rojo project or workspace.
 * If a Rojo project is available, scans based on its DataModel structure.
 * Otherwise, falls back to scanning common directories (src, lib, shared, common).
 *
 * @param rojoState - The current Rojo workspace state containing project and DataModel information
 * @param workspacePath - The absolute path to the workspace root directory
 * @returns A Map of file paths to ModuleInfo objects for all discovered modules
 */
export const buildModuleIndex = (rojoState: RojoState, workspacePath: string): Map<string, ModuleInfo> => {
  const modules = new Map<string, ModuleInfo>();

  if (rojoState.dataModel === undefined) {
    // No Rojo project, just scan common directories
    const commonDirs = ['src', 'lib', 'shared', 'common'];

    for (const dir of commonDirs) {
      const dirPath = path.join(workspacePath, dir);
      if (fs.existsSync(dirPath)) {
        scanDirectory(dirPath, [dir], modules);
      }
    }

    return modules;
  }

  // Scan based on Rojo structure
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
          // Skip files that can't be read or parsed
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

/**
 * Generates a Lua require path string to import one module from another.
 * Calculates the relative path using script.Parent navigation when modules share
 * a common ancestor, or uses an absolute game path for modules in different roots.
 *
 * @param fromDataModelPath - Array of path segments for the source module's DataModel location
 * @param toDataModelPath - Array of path segments for the target module's DataModel location
 * @returns A Lua path string suitable for use in a require() call (e.g., "script.Parent.Utils" or "game.ReplicatedStorage.Modules")
 */
export const generateRequirePath = (fromDataModelPath: string[], toDataModelPath: string[]): string => {
  // Find common ancestor
  let commonLength = 0;
  const minLength = Math.min(fromDataModelPath.length, toDataModelPath.length);

  for (let i = 0; i < minLength; i++) {
    if (fromDataModelPath[i] === toDataModelPath[i]) {
      commonLength = i + 1;
    } else {
      break;
    }
  }

  // Build path
  const parts: string[] = [];

  // Go up from current location
  const upCount = fromDataModelPath.length - commonLength - 1; // -1 because we're inside the module
  if (upCount > 0) {
    parts.push('script');
    for (let i = 0; i < upCount; i++) {
      parts.push('Parent');
    }
  } else if (commonLength === 0) {
    // Different root - use game path
    return `game.${toDataModelPath.join('.')}`;
  } else {
    parts.push('script');
    parts.push('Parent');
  }

  // Go down to target
  for (let i = commonLength; i < toDataModelPath.length; i++) {
    parts.push(toDataModelPath[i]!);
  }

  return parts.join('.');
};

/**
 * Searches all indexed module exports by name using a case-insensitive prefix match.
 * Returns exports whose names start with the query string, limited to prevent excessive results.
 *
 * @param modules - Map of file paths to ModuleInfo objects to search through
 * @param query - The search string to match against export names (case-insensitive prefix match)
 * @param limit - Maximum number of results to return (defaults to 20)
 * @returns An array of matching ModuleExport objects, up to the specified limit
 */
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
