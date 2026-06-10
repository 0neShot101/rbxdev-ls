import type { ExecutorBridge, LogEntry, ToolResult } from 'rbxdev-server';

/** Dependencies every tool handler receives alongside its arguments. */
export interface ToolHandlerContext {
  bridge: ExecutorBridge;
  logBuffer: ReadonlyArray<LogEntry>;
}

/** A single MCP tool implementation. */
export type ToolHandler = (args: unknown, context: ToolHandlerContext) => Promise<ToolResult>;

/** Tool name to handler lookup used to register a handler group. */
export type ToolHandlerMap = Record<string, ToolHandler>;
