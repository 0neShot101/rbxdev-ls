/**
 * Properties Data Provider
 * Shows properties of the selected instance in the Game Tree
 */

import {
  Event,
  EventEmitter,
  ThemeIcon,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
} from 'vscode';

/**
 * Represents a property entry from the executor
 */
export interface PropertyEntry {
  readonly name: string;
  readonly valueType: string;
  readonly value: string;
  readonly className?: string;
}

/**
 * Represents a property item in the tree
 */
export interface PropertyItem {
  readonly name: string;
  readonly value: string;
  readonly valueType: string;
  readonly instancePath: ReadonlyArray<string>;
}

/**
 * TreeDataProvider for displaying instance properties
 */
export class PropertiesDataProvider implements TreeDataProvider<PropertyItem> {
  private _onDidChangeTreeData = new EventEmitter<PropertyItem | undefined>();
  readonly onDidChangeTreeData: Event<PropertyItem | undefined> = this._onDidChangeTreeData.event;

  private properties: PropertyEntry[] = [];
  private instanceName: string = '';
  private currentPath: ReadonlyArray<string> = [];

  /**
   * Updates the properties display with new data
   * @param instanceName - Name of the selected instance
   * @param properties - Array of property entries
   * @param path - Path to the instance
   */
  setProperties = (instanceName: string, properties: PropertyEntry[], path: ReadonlyArray<string>): void => {
    this.instanceName = instanceName;
    this.properties = properties;
    this.currentPath = path;
    this._onDidChangeTreeData.fire(undefined);
  };

  /**
   * Clears the properties display
   */
  clear = (): void => {
    this.instanceName = '';
    this.properties = [];
    this.currentPath = [];
    this._onDidChangeTreeData.fire(undefined);
  };

  /**
   * Gets the current instance path
   */
  getPath = (): ReadonlyArray<string> => this.currentPath;

  getTreeItem = (element: PropertyItem): TreeItem => {
    const item = new TreeItem(element.name, TreeItemCollapsibleState.None);
    item.description = element.value;
    item.tooltip = `${element.name}: ${element.value} (${element.valueType})`;
    item.iconPath = this.getIconForType(element.valueType);
    return item;
  };

  getChildren = (element?: PropertyItem): PropertyItem[] => {
    if (element !== undefined) return [];

    return this.properties.map(prop => ({
      'name': prop.name,
      'value': prop.value,
      'valueType': prop.valueType,
      'instancePath': this.currentPath,
    }));
  };

  private getIconForType = (valueType: string): ThemeIcon => {
    switch (valueType) {
      case 'string':
        return new ThemeIcon('symbol-string');
      case 'number':
        return new ThemeIcon('symbol-number');
      case 'boolean':
        return new ThemeIcon('symbol-boolean');
      case 'Vector3':
      case 'Vector2':
      case 'CFrame':
        return new ThemeIcon('symbol-array');
      case 'Color3':
      case 'BrickColor':
        return new ThemeIcon('symbol-color');
      case 'Instance':
        return new ThemeIcon('symbol-class');
      case 'EnumItem':
        return new ThemeIcon('symbol-enum');
      default:
        return new ThemeIcon('symbol-property');
    }
  };
}
