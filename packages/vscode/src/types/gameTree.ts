/**
 * Game tree domain types shared by the tree view, webviews, and MCP tools.
 */

/**
 * Represents a node in the Roblox game tree hierarchy. The hasChildren flag
 * indicates unexpanded children exist so the tree can lazy-load them.
 */
export interface GameTreeNode {
  readonly name: string;
  readonly className: string;
  readonly children?: ReadonlyArray<GameTreeNode>;
  readonly hasChildren?: boolean;
}

/**
 * Represents a tree item with path information for context menu operations.
 */
export interface GameTreeItem {
  readonly name: string;
  readonly className: string;
  readonly path: ReadonlyArray<string>;
  readonly children?: ReadonlyArray<GameTreeNode>;
  readonly hasChildren?: boolean;
  readonly isService: boolean;
}

/**
 * Callback type for handling reparent operations.
 */
export type ReparentCallback = (sourcePath: ReadonlyArray<string>, targetPath: ReadonlyArray<string>) => Promise<void>;

/**
 * Callback type for requesting children of a node (lazy loading).
 */
export type RequestChildrenCallback = (path: ReadonlyArray<string>) => Promise<ReadonlyArray<GameTreeNode> | undefined>;

/**
 * Search options for filtering the game tree.
 */
export interface SearchOptions {
  readonly query: string;
  readonly searchByName: boolean;
  readonly searchByClass: boolean;
}
