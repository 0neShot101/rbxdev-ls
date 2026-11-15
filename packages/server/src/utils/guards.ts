/** Checks whether a decoded JSON value is a string. */
export const isString = (value: unknown): value is string => typeof value === 'string';

/** Checks whether a decoded JSON value is a boolean. */
export const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

/** Checks whether a decoded JSON value is a non-null object (arrays included). */
export const isObject = (value: unknown): value is object => typeof value === 'object' && value !== null;

/** Checks whether a decoded JSON value is an array whose every element is a string. */
export const isStringArray = (value: unknown): value is ReadonlyArray<string> =>
  Array.isArray(value) && value.every(isString);
