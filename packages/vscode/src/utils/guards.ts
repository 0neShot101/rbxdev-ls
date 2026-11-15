import type { ListEntry, RemoteSpySource } from '@typings/remoteSpy';

/**
 * Checks that a decoded value is a string.
 */
export const isString = (value: unknown): value is string => typeof value === 'string';

/**
 * Checks that a decoded value is a finite number.
 */
export const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/**
 * Checks that a decoded value is a boolean.
 */
export const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

/**
 * Checks that a decoded value is a non-null object.
 */
export const isObject = (value: unknown): value is object => typeof value === 'object' && value !== null;

/**
 * Checks that a decoded value is a remote spy ignore or block entry.
 */
export const isListEntry = (value: unknown): value is ListEntry =>
  isObject(value) &&
  'type' in value &&
  (value.type === 'path' || value.type === 'name') &&
  'value' in value &&
  isString(value.value);

/**
 * Checks a capture-source selection received from the webview.
 */
export const isRemoteSpySource = (value: unknown): value is RemoteSpySource =>
  value === 'game' || value === 'executor' || value === 'both';
