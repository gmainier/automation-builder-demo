/**
 * Keeps Launch Ad target fields aligned so executors reading `targetId` or
 * `targetAdSetId` resolve the same ad set.
 */
export function normalizeLaunchAdTargetConfig(config: Record<string, unknown>): Record<string, unknown> {
  const next = { ...config };
  const targetId = typeof next.targetId === "string" ? next.targetId.trim() : "";
  const targetAdSetId = typeof next.targetAdSetId === "string" ? next.targetAdSetId.trim() : "";
  const targetName = typeof next.targetName === "string" ? next.targetName : "";
  const targetAdSetName = typeof next.targetAdSetName === "string" ? next.targetAdSetName : "";

  if (targetId && !targetAdSetId) {
    next.targetAdSetId = targetId;
    if (!targetAdSetName && targetName) next.targetAdSetName = targetName;
  } else if (targetAdSetId && !targetId) {
    next.targetId = targetAdSetId;
    if (!targetName && targetAdSetName) next.targetName = targetAdSetName;
  }

  return next;
}
