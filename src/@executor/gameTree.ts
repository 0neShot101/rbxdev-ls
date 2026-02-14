/**
 * Live Game Model
 * Stores the live game structure received from connected executors
 */

import type { GameTreeNode } from './protocol';

/**
 * Represents a read-only view of the live game model state.
 * Provides access to the current connection status and game tree structure
 * retrieved from a connected Roblox executor.
 */
export interface LiveGameModel {
  /** Whether an executor client is currently connected */
  readonly isConnected: boolean;
  /** Unix timestamp of the last game tree update, or 0 if never updated */
  readonly lastUpdate: number;
  /** Map of top-level service names to their corresponding game tree nodes */
  readonly services: ReadonlyMap<string, GameTreeNode>;
  /**
   * Retrieves a node from the game tree by its path.
   * @param path - Array of instance names forming the path from root to target node
   * @returns The GameTreeNode at the specified path, or undefined if not found
   */
  getNode: (path: string[]) => GameTreeNode | undefined;
  /**
   * Retrieves the children of a node at the specified path.
   * @param path - Array of instance names forming the path to the parent node
   * @returns A map of child names to their GameTreeNode objects, or undefined if path not found
   */
  getChildren: (path: string[]) => ReadonlyMap<string, GameTreeNode> | undefined;
}

/**
 * Internal mutable state container for the live game model.
 * Used internally to track and modify the game tree state.
 */
interface MutableLiveGameModel {
  /** Whether an executor client is currently connected */
  isConnected: boolean;
  /** Unix timestamp of the last game tree update */
  lastUpdate: number;
  /** Mutable map of service names to game tree nodes */
  services: Map<string, GameTreeNode>;
}

/**
 * Recursively searches for a node within a game tree by following a path of instance names.
 * @param root - The root node to start the search from
 * @param path - Array of child instance names to traverse
 * @returns The GameTreeNode at the end of the path, or undefined if any part of the path is invalid
 */
const findNode = (root: GameTreeNode, path: string[]): GameTreeNode | undefined => {
  if (path.length === 0) return root;

  const [first, ...rest] = path;
  if (root.children === undefined) return undefined;

  const child = root.children.find(c => c.name === first);
  if (child === undefined) return undefined;

  return rest.length === 0 ? child : findNode(child, rest);
};

/**
 * Recursively searches for a mutable node within a game tree by following a path.
 * Returns the node cast to a mutable type for internal modifications.
 */
const findMutableNode = (root: GameTreeNode, path: string[]): GameTreeNode | undefined => {
  if (path.length === 0) return root;

  const [first, ...rest] = path;
  if (root.children === undefined) return undefined;

  const child = root.children.find(c => c.name === first);
  if (child === undefined) return undefined;

  return rest.length === 0 ? child : findMutableNode(child, rest);
};

/**
 * Converts the children array of a game tree node into a Map for efficient name-based lookup.
 * @param node - The parent node whose children should be converted to a map
 * @returns A Map where keys are child instance names and values are the corresponding GameTreeNode objects
 */
const getChildrenMap = (node: GameTreeNode): Map<string, GameTreeNode> => {
  const map = new Map<string, GameTreeNode>();
  if (node.children !== undefined) {
    for (const child of node.children) {
      map.set(child.name, child);
    }
  }
  return map;
};

/**
 * Creates a new live game model instance for tracking the Roblox game tree structure.
 * The model provides both a read-only view for consumers and mutation methods for the bridge.
 * @returns An object containing the read-only model and methods to update its state
 */
export const createLiveGameModel = (): {
  /** The read-only live game model for external consumers */
  model: LiveGameModel;
  /**
   * Updates the game tree with new data from the executor.
   * @param nodes - Array of top-level game tree nodes (services) to store
   */
  update: (nodes: GameTreeNode[]) => void;
  /**
   * Merges lazily-loaded children into the tree at the specified path.
   * @param path - Path to the parent node
   * @param children - Children to merge into the node
   */
  mergeChildren: (path: ReadonlyArray<string>, children: GameTreeNode[]) => void;
  /**
   * Sets the connection status of the model.
   * When set to false, also clears the stored game tree data.
   * @param connected - The new connection status
   */
  setConnected: (connected: boolean) => void;
  /**
   * Clears all stored game tree data without changing connection status.
   */
  clear: () => void;
} => {
  const state: MutableLiveGameModel = {
    'isConnected': false,
    'lastUpdate': 0,
    'services': new Map(),
  };

  /**
   * Retrieves a node from the game tree by its hierarchical path.
   * Supports paths starting with "game" as the root, automatically skipping it.
   * @param path - Array of instance names forming the path from root to target
   * @returns The GameTreeNode at the specified path, or undefined if not found
   */
  const getNode = (path: string[]): GameTreeNode | undefined => {
    if (path.length === 0) return undefined;

    const [serviceName, ...rest] = path;
    if (serviceName === undefined) return undefined;

    // Handle "game" as root
    if (serviceName === 'game') {
      if (rest.length === 0) return undefined;
      const [actualService, ...restPath] = rest;
      if (actualService === undefined) return undefined;
      const service = state.services.get(actualService);
      if (service === undefined) return undefined;
      return restPath.length === 0 ? service : findNode(service, restPath);
    }

    const service = state.services.get(serviceName);
    if (service === undefined) return undefined;
    return rest.length === 0 ? service : findNode(service, rest);
  };

  /**
   * Retrieves the children of a node at the specified path as a read-only map.
   * If the path is empty, returns the top-level services map.
   * @param path - Array of instance names forming the path to the parent node
   * @returns A read-only map of child names to GameTreeNode objects, or undefined if path not found
   */
  const getChildren = (path: string[]): ReadonlyMap<string, GameTreeNode> | undefined => {
    if (path.length === 0) return state.services;

    const node = getNode(path);
    if (node === undefined) return undefined;
    return getChildrenMap(node);
  };

  /**
   * Replaces the current game tree with new data from the executor.
   * Clears existing services and populates with the provided nodes.
   * @param nodes - Array of top-level game tree nodes (services) to store
   */
  const update = (nodes: GameTreeNode[]): void => {
    state.services.clear();
    for (const node of nodes) {
      state.services.set(node.name, node);
    }
    state.lastUpdate = Date.now();
  };

  /**
   * Updates the connection status and optionally clears game tree data.
   * When disconnecting, all stored services are cleared and lastUpdate is reset.
   * @param connected - The new connection status to set
   */
  const setConnected = (connected: boolean): void => {
    state.isConnected = connected;
    if (connected === false) {
      state.services.clear();
      state.lastUpdate = 0;
    }
  };

  /**
   * Clears all stored game tree data and resets the lastUpdate timestamp.
   * Does not affect the connection status.
   */
  const clear = (): void => {
    state.services.clear();
    state.lastUpdate = 0;
  };

  /**
   * Merges lazily-loaded children into the tree at the specified path.
   * This allows completions to use children that were fetched via UI expansion.
   * @param path - Path to the parent node (e.g., ["Workspace", "Folder"])
   * @param children - Children to merge into the node
   */
  const mergeChildren = (path: ReadonlyArray<string>, children: GameTreeNode[]): void => {
    if (path.length === 0) return;

    const [serviceName, ...rest] = path;
    if (serviceName === undefined) return;

    const service = state.services.get(serviceName);
    if (service === undefined) return;

    const targetNode = rest.length === 0 ? service : findMutableNode(service, rest);
    if (targetNode === undefined) return;

    // Mutate the node to add children (cast to mutable)
    (targetNode as { children?: GameTreeNode[] }).children = children;
    delete (targetNode as { hasChildren?: boolean }).hasChildren;
  };

  const model: LiveGameModel = {
    get 'isConnected'() {
      return state.isConnected;
    },
    get 'lastUpdate'() {
      return state.lastUpdate;
    },
    get 'services'() {
      return state.services;
    },
    getNode,
    getChildren,
  };

  return { model, update, mergeChildren, setConnected, clear };
};
