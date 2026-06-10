import * as fs from 'fs';
import * as path from 'path';

import type { DataModelNode, RojoState, SourcemapNode } from '@typings/workspace';

/** Searches for a `sourcemap.json` file at the workspace root. */
export const findSourcemap = (workspacePath: string): string | undefined => {
  const sourcemapPath = path.join(workspacePath, 'sourcemap.json');
  if (fs.existsSync(sourcemapPath)) return sourcemapPath;
  return undefined;
};

const isValidNode = (value: unknown): value is SourcemapNode => {
  if (typeof value !== 'object' || value === null) return false;
  const node = value as { name?: unknown; className?: unknown };
  return typeof node.name === 'string' && typeof node.className === 'string';
};

/** Parses a sourcemap.json file and validates its top-level structure. */
export const parseSourcemap = (filePath: string): SourcemapNode | undefined => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    if (isValidNode(parsed) === false) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
};

const LUA_EXT_RE = /\.(lua|luau)$/;

/**
 * Picks the best filesystem path from a sourcemap node's `filePaths` list.
 *
 * A folder-backed ModuleScript emits multiple entries, e.g.
 * `["Foo", "Foo/init.lua"]`, and we prefer the actual `.lua`/`.luau` file
 * over the directory path so downstream consumers (moduleIndex) hit the
 * file-read branch instead of scanning the directory.
 */
const chooseFilePath = (filePaths: ReadonlyArray<string> | undefined, baseDir: string): string | undefined => {
  if (filePaths === undefined || filePaths.length === 0) return undefined;

  const resolved = filePaths.map(p => path.normalize(path.isAbsolute(p) ? p : path.join(baseDir, p)));

  const script = resolved.find(p => LUA_EXT_RE.test(p));
  if (script !== undefined) return script;

  return resolved[0];
};

/**
 * Converts a parsed sourcemap tree into the `DataModelNode` structure the
 * rest of the language server consumes. Paths in `filePaths` are resolved
 * relative to `baseDir` (the directory containing the sourcemap file,
 * which by convention is also the project-file directory).
 */
export const buildDataModelTreeFromSourcemap = (root: SourcemapNode, baseDir: string): DataModelNode => {
  const buildNode = (sourcemap: SourcemapNode): DataModelNode => {
    const filePath = chooseFilePath(sourcemap.filePaths, baseDir);
    const children = new Map<string, DataModelNode>();

    const sourcemapChildren = sourcemap.children ?? [];
    for (const child of sourcemapChildren) {
      if (isValidNode(child) === false) continue;
      if (children.has(child.name)) continue;
      children.set(child.name, buildNode(child));
    }

    return {
      'name': sourcemap.name,
      'className': sourcemap.className,
      ...(filePath !== undefined ? { filePath } : {}),
      children,
    };
  };

  return buildNode(root);
};

/**
 * Loads the workspace tree from a `sourcemap.json` at the workspace root,
 * if one exists. Returns a `RojoState`-shaped object so the caller can
 * drop it into the same downstream consumers as Rojo state without any
 * type gymnastics. `project` is always undefined for sourcemap-backed
 * workspaces since the sourcemap file is the description, not a project.
 */
export const loadSourcemapState = (workspacePath: string): RojoState => {
  const sourcemapPath = findSourcemap(workspacePath);
  if (sourcemapPath === undefined) return { 'project': undefined, 'dataModel': undefined, 'projectPath': undefined };

  const root = parseSourcemap(sourcemapPath);
  if (root === undefined) return { 'project': undefined, 'dataModel': undefined, 'projectPath': sourcemapPath };

  const baseDir = path.dirname(sourcemapPath);
  const dataModel = buildDataModelTreeFromSourcemap(root, baseDir);

  return { 'project': undefined, dataModel, 'projectPath': sourcemapPath };
};
