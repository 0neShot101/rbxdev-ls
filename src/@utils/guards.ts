/**
 * Type guard utilities for runtime type checking
 */

/**
 * Checks if a value is a string
 * @param value - The value to check
 * @returns True if the value is a string, false otherwise
 */
export const isString = (value: unknown): value is string => typeof value === 'string';

/**
 * Checks if a value is a number
 * @param value - The value to check
 * @returns True if the value is a number, false otherwise
 */
export const isNumber = (value: unknown): value is number => typeof value === 'number';

/**
 * Checks if a value is a boolean
 * @param value - The value to check
 * @returns True if the value is a boolean, false otherwise
 */
export const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

/**
 * Checks if a value is a non-null object (excludes arrays)
 * @param value - The value to check
 * @returns True if the value is a plain object, false otherwise
 */
export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && Array.isArray(value) === false;

/**
 * Checks if a value is an array, optionally validating each element with a type guard
 * @param value - The value to check
 * @param guard - Optional type guard function to validate each array element
 * @returns True if the value is an array (and all elements pass the guard if provided), false otherwise
 */
export const isArray = <T>(value: unknown, guard?: (item: unknown) => item is T): value is T[] => {
  if (Array.isArray(value) === false) return false;
  if (guard === undefined) return true;
  return value.every(guard);
};

/**
 * Checks if a value is a function
 * @param value - The value to check
 * @returns True if the value is a function, false otherwise
 */
export const isFunction = (value: unknown): value is (...args: unknown[]) => unknown => typeof value === 'function';

/**
 * Checks if a value is defined (not undefined and not null)
 * @param value - The value to check
 * @returns True if the value is neither undefined nor null, false otherwise
 */
export const isDefined = <T>(value: T | undefined | null): value is T => value !== undefined && value !== null;

/**
 * Checks if an object has a specific property
 * @param obj - The object to check
 * @param key - The property key to look for
 * @returns True if the object has the specified property, false otherwise
 */
export const hasProperty = <K extends string>(obj: unknown, key: K): obj is Record<K, unknown> =>
  isObject(obj) && key in obj;

/**
 * Checks if an object has a specific property with a string value
 * @param obj - The object to check
 * @param key - The property key to look for
 * @returns True if the object has the specified property and its value is a string, false otherwise
 */
export const hasStringProperty = <K extends string>(obj: unknown, key: K): obj is Record<K, string> =>
  hasProperty(obj, key) && isString(obj[key]);

/**
 * Checks if an object has a specific property with a number value
 * @param obj - The object to check
 * @param key - The property key to look for
 * @returns True if the object has the specified property and its value is a number, false otherwise
 */
export const hasNumberProperty = <K extends string>(obj: unknown, key: K): obj is Record<K, number> =>
  hasProperty(obj, key) && isNumber(obj[key]);
