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

export const NOT_CONNECTED = errorResult('Error: No executor connected');

/**
 * Validates that a path argument is a non-empty array, returning an error result if not.
 * @param path - The path argument to validate.
 * @returns An error ToolResult if invalid, or undefined if the path is valid.
 */
export const requirePath = (path: unknown): ToolResult | undefined => {
  if (Array.isArray(path) === false) return errorResult('Error: path parameter is required');
  if (path.length === 0) return errorResult('Error: path parameter is required');
  return undefined;
};

export const bridgeCall = async <T extends { success: boolean; error?: string | undefined }>(
  fn: () => Promise<T>,
  onSuccess: (result: T) => string,
  failureMessage: string,
): Promise<ToolResult> => {
  try {
    const result = await fn();
    if (result.success) return textResult(onSuccess(result));
    return errorResult(`Error: ${result.error ?? failureMessage}`);
  } catch (err) {
    return errorResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
  }
};
