import { errorResult } from '@mcp/utils/results';

import type { ToolResult } from 'rbxdev-server';

import type { BlockEntry, ConsoleLevel, Decoded, JsonObject, JsonValue, TreeFormat } from '@mcp/types/tools';

const isJsonValue = (value: unknown): value is JsonValue => {
  if (value === null) return true;
  if (typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  return isJsonObject(value);
};

/**
 * Checks that a decoded MCP argument payload is a plain JSON object.
 * @param value - Raw `arguments` value from a tool call request.
 * @returns Whether the value is a JSON object whose members are all JSON values.
 */
export const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' &&
  value !== null &&
  Array.isArray(value) === false &&
  Object.values(value).every(isJsonValue);

const isString = (value: JsonValue | undefined): value is string => typeof value === 'string';

const isBoolean = (value: JsonValue | undefined): value is boolean => typeof value === 'boolean';

const isNumber = (value: JsonValue | undefined): value is number => typeof value === 'number';

const isStringArray = (value: JsonValue | undefined): value is ReadonlyArray<string> =>
  Array.isArray(value) && value.every(isString);

const isObject = (value: JsonValue | undefined): value is JsonObject =>
  typeof value === 'object' && value !== null && Array.isArray(value) === false;

const isBlockEntry = (value: JsonValue): value is BlockEntry =>
  isObject(value) && (value['type'] === 'path' || value['type'] === 'name') && isString(value['value']);

const isBlockList = (value: JsonValue | undefined): value is ReadonlyArray<BlockEntry> =>
  Array.isArray(value) && value.every(isBlockEntry);

const success = <T>(value: T): Decoded<T> => ({ 'ok': true, value });

const failure = <T>(message: string): Decoded<T> => ({ 'ok': false, 'error': errorResult(`Error: ${message}`) });

/**
 * Decodes a required, non-empty instance path whose segments are all strings.
 * @param value - The argument value.
 * @param name - Argument name used in the error message.
 */
export const decodePath = (value: JsonValue | undefined, name: string): Decoded<ReadonlyArray<string>> => {
  if (Array.isArray(value) === false || value.length === 0) return failure('path parameter is required');
  if (isStringArray(value) === false) return failure(`${name} must be an array of strings`);
  return success(value);
};

/**
 * Decodes an optional array of strings.
 * @param value - The argument value.
 * @param name - Argument name used in the error message.
 */
export const decodeOptionalStrings = (
  value: JsonValue | undefined,
  name: string,
): Decoded<ReadonlyArray<string> | undefined> => {
  if (value === undefined) return success(undefined);
  if (isStringArray(value)) return success(value);
  return failure(`${name} must be an array of strings`);
};

/**
 * Decodes a required string argument.
 * @param value - The argument value.
 * @param name - Argument name used in the error message.
 */
export const decodeString = (value: JsonValue | undefined, name: string): Decoded<string> =>
  isString(value) ? success(value) : failure(`${name} parameter is required (string)`);

/**
 * Decodes an optional string argument.
 * @param value - The argument value.
 * @param name - Argument name used in the error message.
 */
export const decodeOptionalString = (value: JsonValue | undefined, name: string): Decoded<string | undefined> => {
  if (value === undefined || isString(value)) return success(value);
  return failure(`${name} must be a string`);
};

/**
 * Decodes a required boolean argument.
 * @param value - The argument value.
 * @param name - Argument name used in the error message.
 */
export const decodeBoolean = (value: JsonValue | undefined, name: string): Decoded<boolean> =>
  isBoolean(value) ? success(value) : failure(`${name} parameter is required (boolean)`);

/**
 * Decodes an optional boolean argument, applying a default when absent.
 * @param value - The argument value.
 * @param name - Argument name used in the error message.
 * @param fallback - Value used when the argument is absent.
 */
export const decodeOptionalBoolean = (
  value: JsonValue | undefined,
  name: string,
  fallback: boolean,
): Decoded<boolean> => {
  if (value === undefined) return success(fallback);
  if (isBoolean(value)) return success(value);
  return failure(`${name} must be a boolean`);
};

/**
 * Decodes an optional positive count, truncating fractions, capping at `max` and using `fallback` for absent or non-positive values.
 * @param value - The argument value.
 * @param fallback - Count used when the argument is absent or not positive.
 * @param max - Largest count returned.
 */
export const decodeLimit = (value: JsonValue | undefined, fallback: number, max: number): Decoded<number> => {
  if (value === undefined) return success(fallback);
  if (isNumber(value) === false) return failure('limit must be a number');
  const count = Math.trunc(value);
  return success(count <= 0 ? fallback : Math.min(count, max));
};

/**
 * Decodes the optional `format` argument of tree tools.
 * @param value - The argument value.
 */
export const decodeFormat = (value: JsonValue | undefined): Decoded<TreeFormat> => {
  if (value === undefined || value === 'tree') return success('tree');
  if (value === 'json') return success('json');
  return failure('format must be "tree" or "json"');
};

/**
 * Decodes the optional `level` argument of `get_console_output`.
 * @param value - The argument value.
 */
export const decodeLevel = (value: JsonValue | undefined): Decoded<ConsoleLevel> => {
  if (value === undefined || value === 'all') return success('all');
  if (value === 'info' || value === 'warn' || value === 'error') return success(value);
  return failure('level must be one of "info", "warn", "error" or "all"');
};

/**
 * Decodes the required Remote Spy block list.
 * @param value - The argument value.
 */
export const decodeBlockList = (value: JsonValue | undefined): Decoded<ReadonlyArray<BlockEntry>> => {
  if (Array.isArray(value) === false) return failure('blocks parameter is required (array)');
  if (isBlockList(value) === false) return failure('each block must be { type: "path" | "name", value: string }');
  return success(value);
};

/**
 * Validates that a path argument is a non-empty array of strings.
 * @param path - The path argument to validate.
 * @returns An error ToolResult if invalid, or undefined if the path is valid.
 */
export const requirePath = (path: JsonValue | undefined): ToolResult | undefined => {
  const decoded = decodePath(path, 'path');
  return decoded.ok ? undefined : decoded.error;
};
