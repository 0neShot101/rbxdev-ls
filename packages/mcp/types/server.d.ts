import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

/** Text content block of an MCP tool result. */
export interface McpTextContent {
  type: 'text';
  text: string;
}

/** MCP tool result returned by every tool handler. */
export interface ToolResult {
  content: McpTextContent[];
  isError?: boolean;
}

/** Node of the live game hierarchy. */
export interface GameTreeNode {
  name: string;
  className: string;
  hasChildren?: boolean;
  children?: GameTreeNode[];
}

/** JSON-safe projection of a game tree node. */
export interface SerializedGameTreeNode {
  name: string;
  className: string;
  hasChildren?: true;
  children?: SerializedGameTreeNode[];
}

/** Console output entry captured from the connected client. */
export interface LogEntry {
  timestamp: number;
  level: 'info' | 'warn' | 'error';
  message: string;
  stack?: string;
}

/** JSON value accepted as a tool argument. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | ReadonlyArray<JsonValue>
  | { readonly [key: string]: JsonValue };

/** Outcome of executing code through the bridge. */
export interface ExecutionResultLike {
  success: boolean;
  result?: string;
  error?: { message: string; stack?: string };
}

/** Subset of the executor bridge used by MCP consumers. */
export interface ExecutorBridgeLike {
  execute(code: string): Promise<ExecutionResultLike>;
}

/** Subset of the SDK MCP server used by consumers. */
export interface McpServerLike {
  connect(transport: Transport): Promise<void>;
  server: Server;
}

/** Tool definition advertised through `tools/list`. */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: { readonly [name: string]: { readonly [key: string]: JsonValue } };
    required: ReadonlyArray<string>;
  };
}

/** Wraps text as a successful tool result. */
export declare const textResult: (text: string) => ToolResult;
/** Wraps text as an error tool result. */
export declare const errorResult: (text: string) => ToolResult;
/** Returns an error result unless the path is a non-empty array of strings. */
export declare const requirePath: (path: JsonValue | undefined) => ToolResult | undefined;
/** Formats a game tree node as an indented text tree. */
export declare const formatGameTreeNode: (node: GameTreeNode, indent?: number) => string;
/** Serializes a game tree node to a JSON-safe object. */
export declare const serializeGameTreeNode: (node: GameTreeNode) => SerializedGameTreeNode;
/** Formats a log entry as a timestamped line. */
export declare const formatLogEntry: (entry: LogEntry) => string;
/** Formats every service node as one text tree. */
export declare const formatServicesTree: (services: ReadonlyMap<string, GameTreeNode>) => string;
/** Tool definitions advertised by the server. */
export declare const tools: ReadonlyArray<ToolDefinition>;
/** Creates the MCP server and the bridge its tools use. */
export declare const createMcpServer: (injectedBridge?: ExecutorBridgeLike) => {
  server: McpServerLike;
  bridge: ExecutorBridgeLike;
};
/** Starts the MCP server over stdio. */
export declare const startMcpServer: () => Promise<void>;
