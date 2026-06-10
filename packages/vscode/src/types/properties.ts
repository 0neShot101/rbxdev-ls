/**
 * Property panel domain types shared by the tree provider, webview, and MCP tools.
 */

/**
 * Represents a property entry from the executor.
 */
export interface PropertyEntry {
  readonly name: string;
  readonly valueType: string;
  readonly value: string;
  readonly className?: string;
}

/**
 * Represents a property item in the tree.
 */
export interface PropertyItem {
  readonly name: string;
  readonly value: string;
  readonly valueType: string;
  readonly instancePath: ReadonlyArray<string>;
}

/**
 * Message posted from the properties webview when a value is edited.
 */
export interface PropertyChangeMessage {
  readonly type: string;
  readonly property: string;
  readonly value: string;
  readonly valueType: string;
}

/**
 * Callback for when a property value is changed.
 */
export type PropertyChangeCallback = (
  instancePath: ReadonlyArray<string>,
  property: string,
  value: string,
  valueType: string,
) => Promise<boolean>;
