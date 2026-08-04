// Shared validation for Meta "Launch Ad" / "Duplicate Ad" steps: both require a
// target ad set before the step can run/preview. Used by the config panel footer
// (to gate the Preview CTA) and the config section (to highlight the field).

/** Meta action events whose Target Ad Sets field is required. */
export const TARGET_AD_SET_REQUIRED_EVENTS = new Set(["Launch Ad", "Duplicate Ad"]);

/**
 * True when a Meta Launch/Duplicate Ad step has no target ad set yet. In
 * "specific" mode that means no chosen ad set and no dynamic `{{...}}` target
 * from an upstream step; in a name-filter mode it means an empty filter.
 */
export function isMetaTargetAdSetMissing(service: string, event: string, config: Record<string, unknown>): boolean {
  if (service !== "meta-ads" || !TARGET_AD_SET_REQUIRED_EVENTS.has(event)) return false;

  const matchType = (typeof config.targetAdSetMatchType === "string" && config.targetAdSetMatchType) || "specific";
  if (matchType !== "specific") {
    const nameFilter = typeof config.targetAdSetNameFilter === "string" ? config.targetAdSetNameFilter.trim() : "";
    return nameFilter.length === 0;
  }

  // "specific" mode has a target if the multi-select has chips OR a single
  // target id is stored (static or a dynamic {{...}} pill). This mirrors the
  // executor, which resolves targetId/targetAdSetId first, then the array.
  const hasSpecificChips = Array.isArray(config.specificTargetAdSets) && config.specificTargetAdSets.length > 0;
  const singleTargetId = typeof config.targetId === "string" ? config.targetId.trim() : "";
  const singleTargetAdSetId = typeof config.targetAdSetId === "string" ? config.targetAdSetId.trim() : "";
  return !hasSpecificChips && singleTargetId.length === 0 && singleTargetAdSetId.length === 0;
}
