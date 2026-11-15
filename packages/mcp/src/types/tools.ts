import type { ExecutorBridge, LogEntry, ToolResult } from 'rbxdev-server';

/** JSON value as received in MCP tool arguments. */
export type JsonValue = string | number | boolean | null | ReadonlyArray<JsonValue> | JsonObject;

/** JSON object as received in MCP tool arguments. */
export interface JsonObject {
  readonly [key: string]: JsonValue;
}

/** Outcome of decoding raw tool arguments: the named input, or the error result to return instead. */
export type Decoded<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: ToolResult };

/** Dependencies every tool handler receives alongside its arguments. */
export interface ToolHandlerContext {
  bridge: ExecutorBridge;
  logBuffer: ReadonlyArray<LogEntry>;
}

/** A single MCP tool implementation receiving the call's JSON arguments. */
export type ToolHandler = (args: JsonObject, context: ToolHandlerContext) => Promise<ToolResult>;

/** Tool name to handler lookup used to register a handler group. */
export type ToolHandlerMap = Readonly<Record<string, ToolHandler>>;

/** Output format of game tree tools. */
export type TreeFormat = 'tree' | 'json';

/** Console level filter accepted by `get_console_output`. */
export type ConsoleLevel = 'all' | 'info' | 'warn' | 'error';

/** Remote Spy block-list entry accepted by `set_remote_spy_block_list`. */
export type BlockEntry = {
  readonly type: 'path' | 'name';
  readonly value: string;
};

/** Arguments of `save_instance`. */
export interface SaveInstanceInput {
  readonly path: ReadonlyArray<string> | undefined;
  readonly fileName: string;
  readonly decompile: boolean;
}

/** JSON-safe projection of a game tree node used by the JSON output format. */
export interface SerializedGameTreeNode {
  name: string;
  className: string;
  hasChildren?: true;
  children?: SerializedGameTreeNode[];
}
