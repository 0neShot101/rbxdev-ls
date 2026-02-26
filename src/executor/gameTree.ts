import type { LiveGameModel } from '@typings/bridge';
import type { GameTreeNode } from '@typings/protocol';

interface MutableLiveGameModel {
  isConnected: boolean;
  lastUpdate: number;
  services: Map<string, GameTreeNode>;
}

const findNode = (root: GameTreeNode, path: string[]): GameTreeNode | undefined => {
  if (path.length === 0) return root;

  const [first, ...rest] = path;
  if (root.children === undefined) return undefined;

  const child = root.children.find(c => c.name === first);
  if (child === undefined) return undefined;

  return rest.length === 0 ? child : findNode(child, rest);
};

const getChildrenMap = (node: GameTreeNode): Map<string, GameTreeNode> => {
  const map = new Map<string, GameTreeNode>();
  if (node.children !== undefined) {
    for (const child of node.children) map.set(child.name, child);
  }
  return map;
};

/** Creates a new live game model instance for tracking the Roblox game tree structure. */
export const createLiveGameModel = (): {
  model: LiveGameModel;
  update: (nodes: GameTreeNode[]) => void;
  mergeChildren: (path: ReadonlyArray<string>, children: GameTreeNode[]) => void;
  setConnected: (connected: boolean) => void;
  clear: () => void;
} => {
  const state: MutableLiveGameModel = {
    'isConnected': false,
    'lastUpdate': 0,
    'services': new Map(),
  };

  const getNode = (path: string[]): GameTreeNode | undefined => {
    if (path.length === 0) return undefined;

    const [serviceName, ...rest] = path;
    if (serviceName === undefined) return undefined;

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

  const getChildren = (path: string[]): ReadonlyMap<string, GameTreeNode> | undefined => {
    if (path.length === 0) return state.services;
    const node = getNode(path);
    if (node === undefined) return undefined;
    return getChildrenMap(node);
  };

  const update = (nodes: GameTreeNode[]): void => {
    state.services.clear();
    for (const node of nodes) state.services.set(node.name, node);
    state.lastUpdate = Date.now();
  };

  const setConnected = (connected: boolean): void => {
    state.isConnected = connected;
    if (connected === false) {
      state.services.clear();
      state.lastUpdate = 0;
    }
  };

  const clear = (): void => {
    state.services.clear();
    state.lastUpdate = 0;
  };

  const mergeChildren = (path: ReadonlyArray<string>, children: GameTreeNode[]): void => {
    if (path.length === 0) return;

    const [serviceName, ...rest] = path;
    if (serviceName === undefined) return;

    const service = state.services.get(serviceName);
    if (service === undefined) return;

    const targetNode = rest.length === 0 ? service : findNode(service, rest);
    if (targetNode === undefined) return;

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
