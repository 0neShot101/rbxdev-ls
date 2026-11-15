/**
 * Defers a computation until its first use and remembers the outcome, including an `undefined` result.
 * @param load - Computation to run at most once.
 * @returns Accessor for the remembered outcome.
 */
export const once = <T>(load: () => T): (() => T) => {
  let outcome: { readonly value: T } | undefined;
  return () => (outcome ??= { 'value': load() }).value;
};
