/**
 * Rojo Integration
 * Parses Rojo project files and builds a virtual DataModel tree
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Represents the tree structure within a Rojo project file.
 * Contains special Rojo keys prefixed with $ and child nodes for the DataModel hierarchy.
 */
export interface RojoTree {
  /** The Roblox class name for this node (e.g., "Folder", "ModuleScript", "ReplicatedStorage") */
  readonly $className?: string;
  /** Filesystem path relative to the project file that maps to this node */
  readonly $path?: string;
  /** When true, Rojo will not sync instances that exist in the DataModel but not in the project */
  readonly $ignoreUnknownInstances?: boolean;
  /** Child nodes in the tree, keyed by their instance name. Can also include other Rojo special properties. */
  readonly [childName: string]: RojoTree | string | boolean | undefined;
}

/**
 * Represents a parsed Rojo project file (*.project.json).
 * Contains the project configuration and the tree structure defining the DataModel mapping.
 */
export interface RojoProject {
  /** The name of the Rojo project, typically used as the root DataModel name */
  readonly name: string;
  /** The tree structure defining how filesystem paths map to the Roblox DataModel */
  readonly tree: RojoTree;
  /** Glob patterns for paths that Rojo should ignore when syncing */
  readonly globIgnorePaths?: ReadonlyArray<string>;
  /** The port number Rojo uses when serving the project for live sync */
  readonly servePort?: number;
  /** List of place IDs that are allowed to connect to this Rojo server */
  readonly servePlaceIds?: ReadonlyArray<number>;
}

/**
 * Represents a node in the virtual DataModel tree.
 * Maps filesystem structure to Roblox's instance hierarchy for navigation and require path generation.
 */
export interface DataModelNode {
  /** The instance name as it appears in the Roblox DataModel */
  readonly name: string;
  /** The Roblox class name (e.g., "ModuleScript", "Script", "LocalScript", "Folder") */
  readonly className: string;
  /** The absolute filesystem path to the file or directory this node represents */
  readonly filePath?: string;
  /** Map of child node names to their DataModelNode representations */
  readonly children: Map<string, DataModelNode>;
}

/**
 * Searches for a Rojo project file in the specified workspace directory.
 * Looks for default.project.json first, then falls back to any *.project.json file.
 *
 * @param workspacePath - The absolute path to the workspace directory to search
 * @returns The absolute path to the found project file, or undefined if no project file exists
 */
export const findRojoProject = (workspacePath: string): string | undefined => {
  // Check for default.project.json first
  const defaultPath = path.join(workspacePath, 'default.project.json');
  if (fs.existsSync(defaultPath)) {
    return defaultPath;
  }

  // Look for any .project.json file
  try {
    const files = fs.readdirSync(workspacePath);
    for (const file of files) {
      if (file.endsWith('.project.json')) {
        return path.join(workspacePath, file);
      }
    }
  } catch {
    // Directory might not be readable
  }

  return undefined;
};

/**
 * Parses a Rojo project JSON file and validates its structure.
 * Reads the file from disk, parses the JSON, and ensures required fields are present.
 *
 * @param projectPath - The absolute path to the Rojo project file to parse
 * @returns The parsed RojoProject object, or undefined if parsing fails or the file is invalid
 */
export const parseRojoProject = (projectPath: string): RojoProject | undefined => {
  try {
    const content = fs.readFileSync(projectPath, 'utf-8');
    const project = JSON.parse(content) as RojoProject;

    if (project.name === undefined || project.tree === undefined) {
      return undefined;
    }

    return project;
  } catch {
    return undefined;
  }
};

/**
 * Builds a virtual DataModel tree from a Rojo project configuration.
 * Recursively processes the Rojo tree structure and scans filesystem directories
 * to create a complete representation of the Roblox instance hierarchy.
 *
 * @param project - The parsed Rojo project containing the tree structure
 * @param projectDir - The absolute path to the directory containing the project file
 * @returns The root DataModelNode representing the complete DataModel tree
 */
export const buildDataModelTree = (project: RojoProject, projectDir: string): DataModelNode => {
  /**
   * Recursively builds a DataModelNode from a RojoTree entry.
   * Processes both explicitly defined children and filesystem-discovered children.
   *
   * @param name - The instance name for this node
   * @param tree - The RojoTree configuration for this node
   * @param parentPath - The absolute filesystem path of the parent node
   * @returns A DataModelNode representing this tree entry and all its children
   */
  const buildNode = (name: string, tree: RojoTree, parentPath: string): DataModelNode => {
    const className = tree.$className ?? 'Folder';
    const filePath = tree.$path !== undefined ? path.join(parentPath, tree.$path) : undefined;

    const children = new Map<string, DataModelNode>();

    // Process child entries
    for (const [key, value] of Object.entries(tree)) {
      // Skip special keys
      if (key.startsWith('$')) continue;

      if (typeof value === 'object' && value !== null) {
        const childNode = buildNode(key, value as RojoTree, filePath ?? parentPath);
        children.set(key, childNode);
      }
    }

    // If $path points to a directory, scan for children
    if (filePath !== undefined && fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        try {
          const entries = fs.readdirSync(filePath);
          for (const entry of entries) {
            // Skip if already defined in tree
            if (children.has(entry.replace(/\.(lua|luau)$/, ''))) continue;

            const entryPath = path.join(filePath, entry);
            const entryStat = fs.statSync(entryPath);

            if (entryStat.isDirectory()) {
              // Check for init.lua or init.luau
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
              // Lua file -> ModuleScript (or Script/LocalScript based on naming)
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
          // Directory might not be readable
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

/**
 * Resolves a filesystem path to its corresponding DataModel path.
 * Traverses the DataModel tree to find the node that matches the given file path
 * and returns the array of instance names forming the path.
 *
 * @param node - The DataModelNode to search from (typically the root)
 * @param filePath - The absolute filesystem path to resolve
 * @param currentPath - Internal parameter tracking the current path during recursion (defaults to empty array)
 * @returns An array of instance names representing the DataModel path, or undefined if the file is not in the tree
 */
export const getDataModelPath = (
  node: DataModelNode,
  filePath: string,
  currentPath: string[] = [],
): string[] | undefined => {
  // Normalize paths for comparison
  const normalizedFilePath = path.normalize(filePath).toLowerCase();
  const normalizedNodePath = node.filePath !== undefined ? path.normalize(node.filePath).toLowerCase() : undefined;

  if (normalizedNodePath !== undefined) {
    // Check if this node matches the file
    if (normalizedFilePath === normalizedNodePath) {
      return [...currentPath, node.name];
    }

    // Check if file is inside this node's directory
    if (normalizedFilePath.startsWith(normalizedNodePath + path.sep)) {
      // Continue searching in children
      for (const [, childNode] of node.children) {
        const result = getDataModelPath(childNode, filePath, [...currentPath, node.name]);
        if (result !== undefined) return result;
      }
    }
  }

  // Check children
  for (const [, childNode] of node.children) {
    const result = getDataModelPath(childNode, filePath, [...currentPath, node.name]);
    if (result !== undefined) return result;
  }

  return undefined;
};

/**
 * Retrieves the children of a DataModel node at the specified path.
 * Navigates through the tree following the path segments and returns
 * the children map of the final node, useful for providing completions.
 *
 * @param root - The root DataModelNode to start navigation from
 * @param pathParts - Array of instance names forming the path to navigate
 * @returns A Map of child names to DataModelNode objects, or undefined if the path is invalid
 */
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

/**
 * Encapsulates the complete Rojo integration state for a workspace.
 * Contains the parsed project configuration, built DataModel tree, and project file location.
 */
export interface RojoState {
  /** The parsed Rojo project configuration, or undefined if no valid project was found */
  readonly project: RojoProject | undefined;
  /** The root of the virtual DataModel tree, or undefined if no project was loaded */
  readonly dataModel: DataModelNode | undefined;
  /** The absolute path to the Rojo project file, or undefined if not found */
  readonly projectPath: string | undefined;
}

/**
 * Loads and initializes the complete Rojo state for a workspace.
 * Finds the project file, parses it, and builds the DataModel tree.
 * Returns a state object with undefined values if any step fails.
 *
 * @param workspacePath - The absolute path to the workspace root directory
 * @returns A RojoState object containing the project, DataModel tree, and project path (any may be undefined)
 */
export const loadRojoState = (workspacePath: string): RojoState => {
  const projectPath = findRojoProject(workspacePath);
  if (projectPath === undefined) {
    return { 'project': undefined, 'dataModel': undefined, 'projectPath': undefined };
  }

  const project = parseRojoProject(projectPath);
  if (project === undefined) {
    return { 'project': undefined, 'dataModel': undefined, projectPath };
  }

  const projectDir = path.dirname(projectPath);
  const dataModel = buildDataModelTree(project, projectDir);

  return { project, dataModel, projectPath };
};
