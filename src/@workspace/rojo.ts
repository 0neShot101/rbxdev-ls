import * as fs from 'fs';
import * as path from 'path';

import type { DataModelNode, RojoProject, RojoState, RojoTree } from '@typings/workspace';

/** Searches for a Rojo project file in the specified workspace directory. */
export const findRojoProject = (workspacePath: string): string | undefined => {
  const defaultPath = path.join(workspacePath, 'default.project.json');
  if (fs.existsSync(defaultPath)) return defaultPath;

  try {
    const files = fs.readdirSync(workspacePath);
    for (const file of files) {
      if (file.endsWith('.project.json')) return path.join(workspacePath, file);
    }
  } catch {
    // Ignore filesystem errors (like permissions issues) and treat as no project found
  }

  return undefined;
};

/** Parses a Rojo project JSON file and validates its structure. */
export const parseRojoProject = (projectPath: string): RojoProject | undefined => {
  try {
    const content = fs.readFileSync(projectPath, 'utf-8');
    const project = JSON.parse(content) as RojoProject;

    if (project.name === undefined || project.tree === undefined) return undefined;

    return project;
  } catch {
    return undefined;
  }
};

/** Builds a virtual DataModel tree from a Rojo project configuration. */
export const buildDataModelTree = (project: RojoProject, projectDir: string): DataModelNode => {
  const buildNode = (name: string, tree: RojoTree, parentPath: string): DataModelNode => {
    const className = tree.$className ?? 'Folder';
    const filePath = tree.$path !== undefined ? path.join(parentPath, tree.$path) : undefined;

    const children = new Map<string, DataModelNode>();

    for (const [key, value] of Object.entries(tree)) {
      if (key.startsWith('$')) continue;

      if (typeof value === 'object' && value !== null) {
        const childNode = buildNode(key, value as RojoTree, filePath ?? parentPath);
        children.set(key, childNode);
      }
    }

    if (filePath !== undefined && fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        try {
          const entries = fs.readdirSync(filePath);
          for (const entry of entries) {
            if (children.has(entry.replace(/\.(lua|luau)$/, ''))) continue;

            const entryPath = path.join(filePath, entry);
            const entryStat = fs.statSync(entryPath);

            if (entryStat.isDirectory()) {
              const initLua = path.join(entryPath, 'init.lua');
              const initLuau = path.join(entryPath, 'init.luau');
              const hasInit = fs.existsSync(initLua) || fs.existsSync(initLuau);

              children.set(entry, {
                'name': entry,
                'className': hasInit ? 'ModuleScript' : 'Folder',
                'filePath': entryPath,
                'children': new Map(),
              });
            } else if (entry.endsWith('.lua') || entry.endsWith('.luau')) {
              const baseName = entry.replace(/\.(lua|luau)$/, '');
              let fileClassName = 'ModuleScript';

              if (baseName.endsWith('.server') || entry.includes('.server.')) {
                fileClassName = 'Script';
              } else if (baseName.endsWith('.client') || entry.includes('.client.')) {
                fileClassName = 'LocalScript';
              }

              children.set(baseName.replace(/\.(server|client)$/, ''), {
                'name': baseName.replace(/\.(server|client)$/, ''),
                'className': fileClassName,
                'filePath': entryPath,
                'children': new Map(),
              });
            }
          }
        } catch {
          // Ignore filesystem errors (like permissions issues) and treat as empty folder
        }
      }
    }

    return {
      name,
      className,
      ...(filePath !== undefined ? { filePath } : {}),
      children,
    };
  };

  return buildNode(project.name, project.tree, projectDir);
};

/** Resolves a filesystem path to its corresponding DataModel path. */
export const getDataModelPath = (
  node: DataModelNode,
  filePath: string,
  currentPath: string[] = [],
): string[] | undefined => {
  const normalizedFilePath = path.normalize(filePath).toLowerCase();
  const normalizedNodePath = node.filePath !== undefined ? path.normalize(node.filePath).toLowerCase() : undefined;

  if (normalizedNodePath !== undefined) {
    if (normalizedFilePath === normalizedNodePath) return [...currentPath, node.name];

    if (normalizedFilePath.startsWith(normalizedNodePath + path.sep)) {
      for (const [, childNode] of node.children) {
        const result = getDataModelPath(childNode, filePath, [...currentPath, node.name]);
        if (result !== undefined) return result;
      }
    }
  }

  for (const [, childNode] of node.children) {
    const result = getDataModelPath(childNode, filePath, [...currentPath, node.name]);
    if (result !== undefined) return result;
  }

  return undefined;
};

/** Retrieves the children of a DataModel node at the specified path. */
export const getDataModelChildren = (
  root: DataModelNode,
  pathParts: string[],
): Map<string, DataModelNode> | undefined => {
  let current = root;

  for (const part of pathParts) {
    const child = current.children.get(part);
    if (child === undefined) return undefined;
    current = child;
  }

  return current.children;
};

/** Loads and initializes the complete Rojo state for a workspace. */
export const loadRojoState = (workspacePath: string): RojoState => {
  const projectPath = findRojoProject(workspacePath);
  if (projectPath === undefined) return { 'project': undefined, 'dataModel': undefined, 'projectPath': undefined };

  const project = parseRojoProject(projectPath);
  if (project === undefined) return { 'project': undefined, 'dataModel': undefined, projectPath };

  const projectDir = path.dirname(projectPath);
  const dataModel = buildDataModelTree(project, projectDir);

  return { project, dataModel, projectPath };
};
