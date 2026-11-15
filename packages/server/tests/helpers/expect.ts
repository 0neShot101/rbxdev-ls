/**
 * Asserts that a value is present, failing the current test otherwise.
 * @param value - The value under test.
 * @returns The value narrowed to exclude `null` and `undefined`.
 */
export const expectDefined = <T>(value: T | null | undefined): T => {
  if (value === undefined || value === null) throw new Error('Expected value to be defined');
  return value;
};
