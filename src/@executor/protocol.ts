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
 * Union type representing all possible messages sent from the server to the executor client
 */
export type ServerMessage = ExecuteMessage | RequestGameTreeMessage;

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
 * Union type representing all possible messages sent from the executor client to the server
 */
export type ClientMessage = ConnectedMessage | ExecuteResultMessage | GameTreeMessage | RuntimeErrorMessage;

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
    return undefined;
  } catch {
    return undefined;
  }
};
