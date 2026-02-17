/** Checks if a value is a string. */
export const isString = (value: unknown): value is string => typeof value === 'string';

/** Checks if a value is a number. */
export const isNumber = (value: unknown): value is number => typeof value === 'number';

/** Checks if a value is a boolean. */
export const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

/** Checks if a value is a non-null object (excludes arrays). */
export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && Array.isArray(value) === false;

/** Checks if a value is an array, optionally validating each element with a type guard. */
export const isArray = <T>(value: unknown, guard?: (item: unknown) => item is T): value is T[] => {
  if (Array.isArray(value) === false) return false;
  if (guard === undefined) return true;
  return value.every(guard);
};

/** Checks if a value is a function. */
export const isFunction = (value: unknown): value is (...args: unknown[]) => unknown => typeof value === 'function';

/** Checks if a value is defined (not undefined and not null). */
export const isDefined = <T>(value: T | undefined | null): value is T => value !== undefined && value !== null;

/** Checks if an object has a specific property. */
export const hasProperty = <K extends string>(obj: unknown, key: K): obj is Record<K, unknown> =>
  isObject(obj) && key in obj;

/** Checks if an object has a specific property with a string value. */
export const hasStringProperty = <K extends string>(obj: unknown, key: K): obj is Record<K, string> =>
  hasProperty(obj, key) && isString(obj[key]);

/** Checks if an object has a specific property with a number value. */
export const hasNumberProperty = <K extends string>(obj: unknown, key: K): obj is Record<K, number> =>
  hasProperty(obj, key) && isNumber(obj[key]);
