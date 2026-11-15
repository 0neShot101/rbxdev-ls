import type { ToolHandler } from '@typings/mcpTools';

/**
 * Wraps a tool handler so a thrown error becomes an `Error: ...` result text.
 * @param handler - Tool handler that may throw.
 * @returns A handler that always resolves to result text.
 */
export const catchTool =
  <Input>(handler: ToolHandler<Input>): ToolHandler<Input> =>
  async input => {
    try {
      return await handler(input);
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  };

/**
 * Wraps a tool handler with the executor connection guard and error capture.
 * @param isConnected - Returns whether an executor is currently connected.
 * @param handler - Tool handler that requires a connected executor.
 * @returns A handler that reports a missing connection without invoking `handler`.
 */
export const guardTool =
  <Input>(isConnected: () => boolean, handler: ToolHandler<Input>): ToolHandler<Input> =>
  async input => {
    if (isConnected() === false) return 'Error: No executor connected';
    return catchTool(handler)(input);
  };
