import type { ToolResult } from 'rbxdev-server';

/**
 * Wraps a text string in the MCP tool result format.
 * @param text - The text content to return.
 * @returns A successful ToolResult containing the text.
 */
export const textResult = (text: string): ToolResult => ({ 'content': [{ 'type': 'text', text }] });

/**
 * Wraps a text string in the MCP tool result format with the error flag set.
 * @param text - The error message to return.
 * @returns A ToolResult marked as an error containing the text.
 */
export const errorResult = (text: string): ToolResult => ({ 'content': [{ 'type': 'text', text }], 'isError': true });

/**
 * Substitutes a placeholder for empty output text.
 * @param text - Formatted output.
 * @param fallback - Placeholder shown when the output is empty.
 */
export const orFallback = (text: string, fallback: string): string => (text === '' ? fallback : text);

/**
 * Formats a caught failure as a tool error result.
 * @param cause - The thrown value.
 */
export const failureResult = (cause: unknown): ToolResult =>
  errorResult(`Error: ${cause instanceof Error ? cause.message : String(cause)}`);

/** Result returned by tools that need a connected client while none is connected. */
export const NOT_CONNECTED = errorResult('Error: No executor connected');

/**
 * Runs a bridge request and maps its success flag to a text or error result.
 * @param request - Starts the bridge request.
 * @param onSuccess - Formats the success text from the bridge result.
 * @param failureMessage - Message used when the bridge reports failure without an error.
 */
export const bridgeCall = async <T extends { success: boolean; error?: string | undefined }>(
  request: () => Promise<T>,
  onSuccess: (result: T) => string,
  failureMessage: string,
): Promise<ToolResult> => {
  try {
    const result = await request();
    if (result.success) return textResult(onSuccess(result));
    return errorResult(`Error: ${result.error ?? failureMessage}`);
  } catch (cause) {
    return failureResult(cause);
  }
};
