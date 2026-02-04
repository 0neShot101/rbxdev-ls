/**
 * Game Tree Data Provider
 * Provides a VS Code TreeView showing the live Roblox game hierarchy
 */

import {
  CancellationToken,
  DataTransfer,
  DataTransferItem,
  Event,
  EventEmitter,
  ThemeIcon,
  TreeDataProvider,
  TreeDragAndDropController,
  TreeItem,
  TreeItemCollapsibleState,
} from 'vscode';

/**
 * Represents a node in the Roblox game tree hierarchy
 */
export interface GameTreeNode {
  readonly name: string;
  readonly className: string;
  readonly children?: ReadonlyArray<GameTreeNode>;
}

/**
 * Represents a tree item with path information for context menu operations
 */
export interface GameTreeItem {
  readonly name: string;
  readonly className: string;
  readonly path: ReadonlyArray<string>;
  readonly children?: ReadonlyArray<GameTreeNode>;
  readonly isService: boolean;
}

/** MIME type for game tree drag and drop */
const GAME_TREE_MIME_TYPE = 'application/vnd.code.tree.rbxdev-gametree';

/**
 * Callback type for handling reparent operations
 */
export type ReparentCallback = (sourcePath: ReadonlyArray<string>, targetPath: ReadonlyArray<string>) => Promise<void>;

/**
 * TreeDataProvider for displaying the live Roblox game hierarchy
 */
export class GameTreeDataProvider implements TreeDataProvider<GameTreeItem>, TreeDragAndDropController<GameTreeItem> {
  private _onDidChangeTreeData = new EventEmitter<GameTreeItem | undefined>();
  readonly onDidChangeTreeData: Event<GameTreeItem | undefined> = this._onDidChangeTreeData.event;

  private rootNodes: ReadonlyArray<GameTreeNode> = [];
  private reparentCallback: ReparentCallback | undefined;

  /** Drag and drop MIME types */
  readonly dropMimeTypes = [GAME_TREE_MIME_TYPE];
  readonly dragMimeTypes = [GAME_TREE_MIME_TYPE];

  /**
   * Registers a callback for handling reparent operations
   * @param callback - Function to call when an item is dropped onto another
   */
  onReparent = (callback: ReparentCallback): void => {
    this.reparentCallback = callback;
  };

  /**
   * Refreshes the tree with new game tree data
   * @param nodes - Array of root-level game tree nodes (services)
   */
  refresh = (nodes: ReadonlyArray<GameTreeNode>): void => {
    this.rootNodes = nodes;
    this._onDidChangeTreeData.fire(undefined);
  };

  /**
   * Clears the tree (called on disconnect)
   */
  clear = (): void => {
    this.rootNodes = [];
    this._onDidChangeTreeData.fire(undefined);
  };

  getTreeItem = (element: GameTreeItem): TreeItem => {
    const hasChildren = element.children !== undefined && element.children.length > 0;
    const item = new TreeItem(
      element.name,
      hasChildren ? TreeItemCollapsibleState.Collapsed : TreeItemCollapsibleState.None
    );
    item.description = element.className;
    item.tooltip = `${element.className}\nPath: game.${element.path.join('.')}`;
    item.contextValue = element.isService ? 'service' : 'instance';
    item.iconPath = this.getIconForClass(element.className);
    return item;
  };

  getChildren = (element?: GameTreeItem): GameTreeItem[] => {
    if (element === undefined) {
      return this.rootNodes.map(node => ({
        'name': node.name,
        'className': node.className,
        'path': [node.name],
        'children': node.children,
        'isService': true,
      }));
    }

    if (element.children === undefined) return [];

    return element.children.map(child => ({
      'name': child.name,
      'className': child.className,
      'path': [...element.path, child.name],
      'children': child.children,
      'isService': false,
    }));
  };

  /**
   * Called when starting to drag items
   */
  handleDrag = (source: readonly GameTreeItem[], dataTransfer: DataTransfer, _token: CancellationToken): void => {
    // Only allow dragging non-service items
    const draggableItems = source.filter(item => item.isService === false);
    if (draggableItems.length === 0) return;

    // Store the paths of dragged items
    const paths = draggableItems.map(item => item.path);
    dataTransfer.set(GAME_TREE_MIME_TYPE, new DataTransferItem(JSON.stringify(paths)));
  };

  /**
   * Called when items are dropped
   */
  handleDrop = async (
    target: GameTreeItem | undefined,
    dataTransfer: DataTransfer,
    _token: CancellationToken
  ): Promise<void> => {
    if (target === undefined || this.reparentCallback === undefined) return;

    const transferItem = dataTransfer.get(GAME_TREE_MIME_TYPE);
    if (transferItem === undefined) return;

    const paths = JSON.parse(await transferItem.asString()) as ReadonlyArray<ReadonlyArray<string>>;

    // Reparent each dragged item to the target
    for (const sourcePath of paths) {
      // Don't allow dropping onto self or parent
      if (this.isParentOrSelf(sourcePath, target.path)) continue;

      await this.reparentCallback(sourcePath, target.path);
    }
  };

  /**
   * Checks if target is a parent of or the same as source
   */
  private isParentOrSelf = (sourcePath: ReadonlyArray<string>, targetPath: ReadonlyArray<string>): boolean => {
    // Can't drop on self
    if (sourcePath.length === targetPath.length) {
      return sourcePath.every((segment, i) => segment === targetPath[i]);
    }

    // Can't drop on own child (target is longer and starts with source)
    if (targetPath.length > sourcePath.length) {
      return sourcePath.every((segment, i) => segment === targetPath[i]);
    }

    return false;
  };

  private getIconForClass = (className: string): ThemeIcon => {
    if (className === 'Folder') return new ThemeIcon('folder');
    if (className === 'Script') return new ThemeIcon('file-code');
    if (className === 'LocalScript') return new ThemeIcon('file-code');
    if (className === 'ModuleScript') return new ThemeIcon('package');
    if (className.includes('Part') || className === 'MeshPart' || className === 'UnionOperation') {
      return new ThemeIcon('primitive-square');
    }
    if (className === 'Model') return new ThemeIcon('symbol-class');
    if (className === 'Camera') return new ThemeIcon('device-camera');
    if (className === 'Workspace') return new ThemeIcon('globe');
    if (className === 'Players') return new ThemeIcon('organization');
    if (className === 'ReplicatedStorage' || className === 'ServerStorage') return new ThemeIcon('database');
    if (className === 'Lighting') return new ThemeIcon('lightbulb');
    if (className === 'SoundService' || className === 'Sound') return new ThemeIcon('unmute');
    if (className.includes('Light')) return new ThemeIcon('lightbulb');
    if (className.includes('Gui') || className.includes('UI')) return new ThemeIcon('layout');
    if (className === 'Frame' || className === 'ScrollingFrame') return new ThemeIcon('window');
    if (className.includes('Text')) return new ThemeIcon('symbol-text');
    if (className.includes('Image')) return new ThemeIcon('file-media');
    if (className.includes('Button')) return new ThemeIcon('symbol-event');
    if (className === 'RemoteEvent' || className === 'BindableEvent') return new ThemeIcon('zap');
    if (className === 'RemoteFunction' || className === 'BindableFunction') return new ThemeIcon('symbol-function');
    if (className === 'Configuration' || className === 'ObjectValue' || className === 'StringValue') {
      return new ThemeIcon('symbol-variable');
    }
    if (className === 'Terrain') return new ThemeIcon('globe');
    if (className === 'Tool') return new ThemeIcon('tools');
    return new ThemeIcon('symbol-misc');
  };
}
