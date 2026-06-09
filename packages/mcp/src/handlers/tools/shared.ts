import type { ExecutorBridge, LogEntry, ToolResult } from 'rbxdev-server';

export interface ToolHandlerContext {
  bridge: ExecutorBridge;
  logBuffer: ReadonlyArray<LogEntry>;
}

export type ToolHandler = (args: unknown, context: ToolHandlerContext) => Promise<ToolResult>;
export type ToolHandlerMap = Record<string, ToolHandler>;
