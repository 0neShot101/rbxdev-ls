/**
 * Executor Bridge Protocol Types
 * Defines the WebSocket message format between VS Code and Roblox executors
 */

/**
 * Represents a node in the Roblox game tree hierarchy
 */
export interface GameTreeNode {
  /** The name of the instance in the game tree */
  readonly name: string;
  /** The Roblox class name of the instance */
  readonly className: string;
  /** Child nodes in the hierarchy */
  readonly children?: GameTreeNode[];
  /** Indicates unexpanded children exist (for lazy loading) */
  readonly hasChildren?: boolean;
}

/**
 * Represents an error that occurred during script execution in the Roblox environment
 */
export interface RuntimeError {
  /** The error message describing what went wrong */
  readonly message: string;
  /** The file path where the error occurred */
  readonly file?: string;
  /** The line number where the error occurred */
  readonly line?: number;
  /** The full stack trace of the error */
  readonly stack?: string;
}

/**
 * Message sent from the server to request code execution on the executor
 */
export interface ExecuteMessage {
  /** Message type identifier */
  readonly type: 'execute';
  /** Unique identifier for tracking the execution request and its response */
  readonly id: string;
  /** The Luau code to execute in the Roblox environment */
  readonly code: string;
}

/**
 * Message sent from the server to request the current game tree structure
 */
export interface RequestGameTreeMessage {
  /** Message type identifier */
  readonly type: 'requestGameTree';
  /** Optional list of specific Roblox services to include in the response */
  readonly services?: string[];
}

/**
 * Message sent from the server to request property values of an instance
 */
export interface RequestPropertiesMessage {
  /** Message type identifier */
  readonly type: 'requestProperties';
  /** Unique identifier for tracking the request and its response */
  readonly id: string;
  /** Path segments to the instance (e.g., ["Workspace", "Part"]) */
  readonly path: ReadonlyArray<string>;
  /** Optional list of specific properties to fetch */
  readonly properties?: ReadonlyArray<string>;
}

/**
 * Reference to a module that can be required
 */
export type ModuleReference =
  | { readonly kind: 'path'; readonly path: ReadonlyArray<string> }
  | { readonly kind: 'assetId'; readonly id: number };

/**
 * Message sent from the server to request module interface information
 */
export interface RequestModuleInterfaceMessage {
  /** Message type identifier */
  readonly type: 'requestModuleInterface';
  /** Unique identifier for tracking the request and its response */
  readonly id: string;
  /** Reference to the module to inspect */
  readonly moduleRef: ModuleReference;
}

/**
 * Message sent from the server to set a property value on an instance
 */
export interface SetPropertyMessage {
  /** Message type identifier */
  readonly type: 'setProperty';
  /** Unique identifier for tracking the request and its response */
  readonly id: string;
  /** Path segments to the instance */
  readonly path: ReadonlyArray<string>;
  /** Name of the property to set */
  readonly property: string;
  /** The new value (as a string to be parsed) */
  readonly value: string;
  /** The type of the value for proper parsing */
  readonly valueType: string;
}

/**
 * Message sent from the server to teleport the player to an instance
 */
export interface TeleportToMessage {
  /** Message type identifier */
  readonly type: 'teleportTo';
  /** Unique identifier for tracking the request and its response */
  readonly id: string;
  /** Path segments to the target instance */
  readonly path: ReadonlyArray<string>;
}

/**
 * Message sent from the server to delete an instance
 */
export interface DeleteInstanceMessage {
  /** Message type identifier */
  readonly type: 'deleteInstance';
  /** Unique identifier for tracking the request and its response */
  readonly id: string;
  /** Path segments to the instance to delete */
  readonly path: ReadonlyArray<string>;
}

/**
 * Message sent from the server to reparent an instance
 */
export interface ReparentInstanceMessage {
  /** Message type identifier */
  readonly type: 'reparentInstance';
  /** Unique identifier for tracking the request and its response */
  readonly id: string;
  /** Path segments to the instance to move */
  readonly sourcePath: ReadonlyArray<string>;
  /** Path segments to the new parent */
  readonly targetPath: ReadonlyArray<string>;
}

/**
 * Message sent from the server to request children of an instance (lazy loading)
 */
export interface RequestChildrenMessage {
  /** Message type identifier */
  readonly type: 'requestChildren';
  /** Unique identifier for tracking the request and its response */
  readonly id: string;
  /** Path segments to the parent instance */
  readonly path: ReadonlyArray<string>;
}

/**
 * Message sent from the server to request decompiled script source
 */
export interface RequestScriptSourceMessage {
  /** Message type identifier */
  readonly type: 'requestScriptSource';
  /** Unique identifier for tracking the request and its response */
  readonly id: string;
  /** Path segments to the script instance */
  readonly path: ReadonlyArray<string>;
}

/**
 * Union type representing all possible messages sent from the server to the executor client
 */
export type ServerMessage =
  | ExecuteMessage
  | RequestGameTreeMessage
  | RequestPropertiesMessage
  | RequestModuleInterfaceMessage
  | SetPropertyMessage
  | TeleportToMessage
  | DeleteInstanceMessage
  | ReparentInstanceMessage
  | RequestChildrenMessage
  | RequestScriptSourceMessage;

/**
 * Message sent from the executor client upon successful WebSocket connection
 */
export interface ConnectedMessage {
  /** Message type identifier */
  readonly type: 'connected';
  /** The name of the connected Roblox executor */
  readonly executorName: string;
  /** The version string of the connected executor */
  readonly version: string;
}

/**
 * Message sent from the executor client containing the result of a code execution request
 */
export interface ExecuteResultMessage {
  /** Message type identifier */
  readonly type: 'executeResult';
  /** The unique identifier matching the original execute request */
  readonly id: string;
  /** Whether the code execution completed successfully */
  readonly success: boolean;
  /** The return value or output from successful execution */
  readonly result?: string;
  /** Error details if the execution failed */
  readonly error?: RuntimeError;
}

/**
 * Message sent from the executor client containing the requested game tree structure
 */
export interface GameTreeMessage {
  /** Message type identifier */
  readonly type: 'gameTree';
  /** Array of root-level game tree nodes representing the Roblox hierarchy */
  readonly data: GameTreeNode[];
}

/**
 * Message sent from the executor client when an unhandled runtime error occurs
 */
export interface RuntimeErrorMessage {
  /** Message type identifier */
  readonly type: 'runtimeError';
  /** The runtime error details */
  readonly error: RuntimeError;
}

/**
 * Message sent from the executor client containing a log entry (print/warn/error)
 */
export interface LogMessage {
  /** Message type identifier */
  readonly type: 'log';
  /** The log level */
  readonly level: 'info' | 'warn' | 'error';
  /** The log message content */
  readonly message: string;
  /** Optional stack trace for errors */
  readonly stack?: string;
  /** Unix timestamp when the log was generated */
  readonly timestamp: number;
}

/**
 * Represents a serialized property value from an instance
 */
export interface PropertyEntry {
  /** The name of the property */
  readonly name: string;
  /** The type of the value */
  readonly valueType:
    | 'string'
    | 'number'
    | 'boolean'
    | 'nil'
    | 'Instance'
    | 'Vector3'
    | 'CFrame'
    | 'Color3'
    | 'UDim2'
    | 'other';
  /** String representation of the value */
  readonly value: string;
  /** For Instance types, the class name */
  readonly className?: string;
}

/**
 * Message sent from the executor client containing requested property values
 */
export interface PropertiesResultMessage {
  /** Message type identifier */
  readonly type: 'propertiesResult';
  /** The unique identifier matching the original request */
  readonly id: string;
  /** Whether the properties were successfully retrieved */
  readonly success: boolean;
  /** The property values if successful */
  readonly properties?: ReadonlyArray<PropertyEntry>;
  /** Error message if unsuccessful */
  readonly error?: string;
}

/**
 * Represents a property of a module's exported table
 */
export interface ModuleProperty {
  /** The name of the property */
  readonly name: string;
  /** The type of the value */
  readonly valueKind: 'function' | 'table' | 'string' | 'number' | 'boolean' | 'other';
  /** For functions, the number of parameters */
  readonly functionArity?: number;
}

/**
 * Represents the public interface of a module
 */
export interface ModuleInterface {
  /** The kind of value returned by the module */
  readonly kind: 'table' | 'function' | 'other';
  /** For tables, the list of properties */
  readonly properties?: ReadonlyArray<ModuleProperty>;
}

/**
 * Message sent from the executor client containing module interface information
 */
export interface ModuleInterfaceMessage {
  /** Message type identifier */
  readonly type: 'moduleInterface';
  /** The unique identifier matching the original request */
  readonly id: string;
  /** Whether the module interface was successfully retrieved */
  readonly success: boolean;
  /** The module interface if successful */
  readonly interface?: ModuleInterface;
  /** Error message if unsuccessful */
  readonly error?: string;
}

/**
 * Message sent from the executor client confirming a property was set
 */
export interface SetPropertyResultMessage {
  /** Message type identifier */
  readonly type: 'setPropertyResult';
  /** The unique identifier matching the original request */
  readonly id: string;
  /** Whether the property was successfully set */
  readonly success: boolean;
  /** Error message if unsuccessful */
  readonly error?: string;
}

/**
 * Message sent from the executor client confirming teleport completed
 */
export interface TeleportToResultMessage {
  /** Message type identifier */
  readonly type: 'teleportToResult';
  /** The unique identifier matching the original request */
  readonly id: string;
  /** Whether the teleport was successful */
  readonly success: boolean;
  /** Error message if unsuccessful */
  readonly error?: string;
}

/**
 * Message sent from the executor client confirming instance deletion
 */
export interface DeleteInstanceResultMessage {
  /** Message type identifier */
  readonly type: 'deleteInstanceResult';
  /** The unique identifier matching the original request */
  readonly id: string;
  /** Whether the deletion was successful */
  readonly success: boolean;
  /** Error message if unsuccessful */
  readonly error?: string;
}

/**
 * Message sent from the executor client confirming instance reparenting
 */
export interface ReparentInstanceResultMessage {
  /** Message type identifier */
  readonly type: 'reparentInstanceResult';
  /** The unique identifier matching the original request */
  readonly id: string;
  /** Whether the reparent was successful */
  readonly success: boolean;
  /** Error message if unsuccessful */
  readonly error?: string;
}

/**
 * Message sent from the executor client containing children of an instance (lazy loading)
 */
export interface ChildrenResultMessage {
  /** Message type identifier */
  readonly type: 'childrenResult';
  /** The unique identifier matching the original request */
  readonly id: string;
  /** Whether the children were successfully retrieved */
  readonly success: boolean;
  /** The child nodes if successful */
  readonly children?: GameTreeNode[];
  /** Error message if unsuccessful */
  readonly error?: string;
}

/**
 * Message sent from the executor client containing decompiled script source
 */
export interface ScriptSourceResultMessage {
  /** Message type identifier */
  readonly type: 'scriptSourceResult';
  /** The unique identifier matching the original request */
  readonly id: string;
  /** Whether the script source was successfully retrieved */
  readonly success: boolean;
  /** The decompiled script source if successful */
  readonly source?: string;
  /** The script class name (LocalScript, ModuleScript, Script) */
  readonly scriptType?: string;
  /** Error message if unsuccessful */
  readonly error?: string;
}

/**
 * Union type representing all possible messages sent from the executor client to the server
 */
export type ClientMessage =
  | ConnectedMessage
  | ExecuteResultMessage
  | GameTreeMessage
  | RuntimeErrorMessage
  | LogMessage
  | PropertiesResultMessage
  | ModuleInterfaceMessage
  | SetPropertyResultMessage
  | TeleportToResultMessage
  | DeleteInstanceResultMessage
  | ReparentInstanceResultMessage
  | ChildrenResultMessage
  | ScriptSourceResultMessage;

/**
 * Type guard to check if an unknown value is a ConnectedMessage
 * @param msg - The value to check
 * @returns True if the value is a valid ConnectedMessage
 */
export const isConnectedMessage = (msg: unknown): msg is ConnectedMessage =>
  typeof msg === 'object' &&
  msg !== null &&
  (msg as ConnectedMessage).type === 'connected' &&
  typeof (msg as ConnectedMessage).executorName === 'string';

/**
 * Type guard to check if an unknown value is an ExecuteResultMessage
 * @param msg - The value to check
 * @returns True if the value is a valid ExecuteResultMessage
 */
export const isExecuteResultMessage = (msg: unknown): msg is ExecuteResultMessage =>
  typeof msg === 'object' &&
  msg !== null &&
  (msg as ExecuteResultMessage).type === 'executeResult' &&
  typeof (msg as ExecuteResultMessage).id === 'string';

/**
 * Type guard to check if an unknown value is a GameTreeMessage
 * @param msg - The value to check
 * @returns True if the value is a valid GameTreeMessage
 */
export const isGameTreeMessage = (msg: unknown): msg is GameTreeMessage =>
  typeof msg === 'object' &&
  msg !== null &&
  (msg as GameTreeMessage).type === 'gameTree' &&
  Array.isArray((msg as GameTreeMessage).data);

/**
 * Type guard to check if an unknown value is a RuntimeErrorMessage
 * @param msg - The value to check
 * @returns True if the value is a valid RuntimeErrorMessage
 */
export const isRuntimeErrorMessage = (msg: unknown): msg is RuntimeErrorMessage =>
  typeof msg === 'object' &&
  msg !== null &&
  (msg as RuntimeErrorMessage).type === 'runtimeError' &&
  typeof (msg as RuntimeErrorMessage).error === 'object';

/**
 * Type guard to check if an unknown value is a LogMessage
 * @param msg - The value to check
 * @returns True if the value is a valid LogMessage
 */
export const isLogMessage = (msg: unknown): msg is LogMessage =>
  typeof msg === 'object' &&
  msg !== null &&
  (msg as LogMessage).type === 'log' &&
  typeof (msg as LogMessage).level === 'string' &&
  typeof (msg as LogMessage).message === 'string';

/**
 * Type guard to check if an unknown value is a PropertiesResultMessage
 * @param msg - The value to check
 * @returns True if the value is a valid PropertiesResultMessage
 */
export const isPropertiesResultMessage = (msg: unknown): msg is PropertiesResultMessage =>
  typeof msg === 'object' &&
  msg !== null &&
  (msg as PropertiesResultMessage).type === 'propertiesResult' &&
  typeof (msg as PropertiesResultMessage).id === 'string' &&
  typeof (msg as PropertiesResultMessage).success === 'boolean';

/**
 * Type guard to check if an unknown value is a ModuleInterfaceMessage
 * @param msg - The value to check
 * @returns True if the value is a valid ModuleInterfaceMessage
 */
export const isModuleInterfaceMessage = (msg: unknown): msg is ModuleInterfaceMessage =>
  typeof msg === 'object' &&
  msg !== null &&
  (msg as ModuleInterfaceMessage).type === 'moduleInterface' &&
  typeof (msg as ModuleInterfaceMessage).id === 'string' &&
  typeof (msg as ModuleInterfaceMessage).success === 'boolean';

/**
 * Type guard to check if an unknown value is a SetPropertyResultMessage
 * @param msg - The value to check
 * @returns True if the value is a valid SetPropertyResultMessage
 */
export const isSetPropertyResultMessage = (msg: unknown): msg is SetPropertyResultMessage =>
  typeof msg === 'object' &&
  msg !== null &&
  (msg as SetPropertyResultMessage).type === 'setPropertyResult' &&
  typeof (msg as SetPropertyResultMessage).id === 'string' &&
  typeof (msg as SetPropertyResultMessage).success === 'boolean';

/**
 * Type guard to check if an unknown value is a TeleportToResultMessage
 * @param msg - The value to check
 * @returns True if the value is a valid TeleportToResultMessage
 */
export const isTeleportToResultMessage = (msg: unknown): msg is TeleportToResultMessage =>
  typeof msg === 'object' &&
  msg !== null &&
  (msg as TeleportToResultMessage).type === 'teleportToResult' &&
  typeof (msg as TeleportToResultMessage).id === 'string' &&
  typeof (msg as TeleportToResultMessage).success === 'boolean';

/**
 * Type guard to check if an unknown value is a DeleteInstanceResultMessage
 * @param msg - The value to check
 * @returns True if the value is a valid DeleteInstanceResultMessage
 */
export const isDeleteInstanceResultMessage = (msg: unknown): msg is DeleteInstanceResultMessage =>
  typeof msg === 'object' &&
  msg !== null &&
  (msg as DeleteInstanceResultMessage).type === 'deleteInstanceResult' &&
  typeof (msg as DeleteInstanceResultMessage).id === 'string' &&
  typeof (msg as DeleteInstanceResultMessage).success === 'boolean';

/**
 * Type guard to check if an unknown value is a ReparentInstanceResultMessage
 * @param msg - The value to check
 * @returns True if the value is a valid ReparentInstanceResultMessage
 */
export const isReparentInstanceResultMessage = (msg: unknown): msg is ReparentInstanceResultMessage =>
  typeof msg === 'object' &&
  msg !== null &&
  (msg as ReparentInstanceResultMessage).type === 'reparentInstanceResult' &&
  typeof (msg as ReparentInstanceResultMessage).id === 'string' &&
  typeof (msg as ReparentInstanceResultMessage).success === 'boolean';

/**
 * Type guard to check if an unknown value is a ChildrenResultMessage
 * @param msg - The value to check
 * @returns True if the value is a valid ChildrenResultMessage
 */
export const isChildrenResultMessage = (msg: unknown): msg is ChildrenResultMessage =>
  typeof msg === 'object' &&
  msg !== null &&
  (msg as ChildrenResultMessage).type === 'childrenResult' &&
  typeof (msg as ChildrenResultMessage).id === 'string' &&
  typeof (msg as ChildrenResultMessage).success === 'boolean';

/**
 * Type guard to check if an unknown value is a ScriptSourceResultMessage
 * @param msg - The value to check
 * @returns True if the value is a valid ScriptSourceResultMessage
 */
export const isScriptSourceResultMessage = (msg: unknown): msg is ScriptSourceResultMessage =>
  typeof msg === 'object' &&
  msg !== null &&
  (msg as ScriptSourceResultMessage).type === 'scriptSourceResult' &&
  typeof (msg as ScriptSourceResultMessage).id === 'string' &&
  typeof (msg as ScriptSourceResultMessage).success === 'boolean';

/**
 * Parses a JSON string and validates it as a ClientMessage
 * @param data - The raw JSON string to parse
 * @returns The parsed ClientMessage if valid, or undefined if parsing fails or the message type is unrecognized
 */
export const parseClientMessage = (data: string): ClientMessage | undefined => {
  try {
    const parsed = JSON.parse(data);
    if (isConnectedMessage(parsed)) return parsed;
    if (isExecuteResultMessage(parsed)) return parsed;
    if (isGameTreeMessage(parsed)) return parsed;
    if (isRuntimeErrorMessage(parsed)) return parsed;
    if (isLogMessage(parsed)) return parsed;
    if (isPropertiesResultMessage(parsed)) return parsed;
    if (isModuleInterfaceMessage(parsed)) return parsed;
    if (isSetPropertyResultMessage(parsed)) return parsed;
    if (isTeleportToResultMessage(parsed)) return parsed;
    if (isDeleteInstanceResultMessage(parsed)) return parsed;
    if (isReparentInstanceResultMessage(parsed)) return parsed;
    if (isChildrenResultMessage(parsed)) return parsed;
    if (isScriptSourceResultMessage(parsed)) return parsed;
    return undefined;
  } catch {
    return undefined;
  }
};
