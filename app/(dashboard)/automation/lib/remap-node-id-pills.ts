/**
 * Rewrites `{{nodeId.field}}` references when a flow's node ids change.
 *
 * Templates hardcode readable node ids (`action-1`) and reference them from
 * sibling configs (`targetAdSetId: "{{action-1.resultId}}"`). Loading a template
 * mints fresh node ids, so without this the references point at nodes that no
 * longer exist and resolve to nothing at execution time.
 */

/** Matches a `{{nodeId.field}}` reference, capturing the node id and the field. */
const DATA_PILL_PATTERN = /\{\{([^.{}]+)\.([^{}]+)\}\}/g;

/** Rewrites every pill in one string against `idByOldId`. Unknown ids are left alone. */
function remapPillsInText(text: string, idByOldId: ReadonlyMap<string, string>): string {
  return text.replace(DATA_PILL_PATTERN, (pill, oldNodeId: string, field: string) => {
    const newNodeId = idByOldId.get(oldNodeId);
    return newNodeId ? `{{${newNodeId}.${field}}}` : pill;
  });
}

/**
 * Deep-rewrites pills in any config value, preserving structure.
 *
 * @param value - A config value: string, array, or plain object.
 * @param idByOldId - Old node id to new node id.
 * @returns A new value with every known pill re-pointed.
 */
export function remapNodeIdPills(value: unknown, idByOldId: ReadonlyMap<string, string>): unknown {
  if (typeof value === "string") return remapPillsInText(value, idByOldId);
  if (Array.isArray(value)) return value.map((entry) => remapNodeIdPills(entry, idByOldId));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, remapNodeIdPills(entry, idByOldId)]),
    );
  }
  return value;
}
