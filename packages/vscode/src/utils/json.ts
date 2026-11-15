import type { JsonObject, JsonValue } from '@typings/json';

/**
 * Checks that a decoded value is a JSON value tree.
 */
export const isJsonValue = (value: unknown): value is JsonValue =>
  value === null ||
  typeof value === 'string' ||
  typeof value === 'number' ||
  typeof value === 'boolean' ||
  (Array.isArray(value) && value.every(isJsonValue)) ||
  isJsonObject(value);

/**
 * Checks that a decoded value is a JSON object (not an array or null).
 */
export const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' &&
  value !== null &&
  Array.isArray(value) === false &&
  Object.values(value).every(isJsonValue);

/**
 * Parses JSON text that must contain an object.
 * @param text - JSON document text.
 * @returns The parsed object, or `undefined` when the document is valid JSON of another kind.
 */
export const parseJsonObject = (text: string): JsonObject | undefined => {
  const parsed: unknown = JSON.parse(text);
  return isJsonObject(parsed) ? parsed : undefined;
};
