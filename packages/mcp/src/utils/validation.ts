export const asRecord = (value: unknown): Record<string, unknown> | undefined => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
};

export const normalizePositiveInteger = (value: unknown, fallback: number, max: number): number => {
  if (typeof value !== 'number' || Number.isFinite(value) === false) return fallback;

  const normalized = Math.trunc(value);
  if (normalized <= 0) return fallback;
  return Math.min(normalized, max);
};
