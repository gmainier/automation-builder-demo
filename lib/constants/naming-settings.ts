/** Safe default used when an account or launch has no saved dimension-removal preference. */
export const DEFAULT_REMOVE_DIMENSIONS = false;

/**
 * Resolves Meta's dimension-removal preference while repairing the legacy
 * database-default signature (`true` with no saved naming convention).
 */
export function resolveMetaRemoveDimensionsPreference(settings: {
  readonly naming?: string | null;
  readonly removeDimensions?: boolean | null;
}): boolean {
  const hasSavedNamingConvention = typeof settings.naming === "string" && settings.naming.trim().length > 0;
  if (!hasSavedNamingConvention) return DEFAULT_REMOVE_DIMENSIONS;
  return settings.removeDimensions ?? DEFAULT_REMOVE_DIMENSIONS;
}
