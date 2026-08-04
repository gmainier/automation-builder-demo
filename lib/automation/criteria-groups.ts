// Canonical handling of automation criteria condition groups.
//
// Criteria can be expressed two ways:
//   - Legacy: a flat `conditions[]` array combined by a single `logic` ("AND" | "OR").
//   - Grouped: a `groups[]` array where groups are OR'd together and each group's
//     conditions combine by that group's own `logic`.
//
// `getCriteriaGroups` normalizes either form into the grouped representation so all
// evaluation/serialization code can reason about a single shape. A legacy rule maps
// to exactly one group, so it evaluates identically to before groups existed.

import type { CriteriaCondition, CriteriaGroup } from "@/types/auto-scale";

export const DEFAULT_GROUP_LOGIC = "AND" as const;

// Minimal shape needed to normalize — accepts a full AutoScaleCriteria or any
// partial that carries the relevant fields (e.g. raw JSON from the flow config).
export interface GroupableCriteria {
  conditions?: CriteriaCondition[];
  logic?: "AND" | "OR";
  groups?: CriteriaGroup[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isCriteriaCondition(value: unknown): value is CriteriaCondition {
  return isRecord(value) && typeof value.metric === "string" && value.metric.length > 0;
}

/**
 * Coerce MCP/assistant/legacy `conditions` payloads into a flat array.
 * Models sometimes emit a single condition object (or an array-like object)
 * instead of `[condition]`, which otherwise crashes UI that iterates with
 * `for...of` / `.map`. Mirrors api-app preview criteria normalization.
 */
export function normalizeCriteriaConditions(value: unknown): CriteriaCondition[] {
  if (Array.isArray(value)) {
    return value.filter(isCriteriaCondition);
  }
  if (!isRecord(value)) {
    return [];
  }
  if (isCriteriaCondition(value)) {
    return [value];
  }
  // Array-like / map payloads: { "0": { metric, ... }, "1": { ... } }
  const nested = Object.values(value).filter(isCriteriaCondition);
  if (nested.length > 0) {
    return nested;
  }
  return [];
}

/**
 * Normalize a full criteria object from assistant/MCP payloads.
 * Handles: conditions array, single condition object, and flat
 * `{ metric, operator, value }` at the criteria root.
 */
export function normalizeAssistantCriteria(raw: unknown): Record<string, unknown> | undefined {
  if (!isRecord(raw)) return undefined;

  const conditions = normalizeCriteriaConditions(raw.conditions);
  if (conditions.length > 0) {
    return { ...raw, conditions };
  }

  if (
    typeof raw.metric === "string" &&
    typeof raw.operator === "string" &&
    raw.value !== undefined &&
    raw.value !== null
  ) {
    const { metric, operator, value, ...rest } = raw;
    return {
      ...rest,
      conditions: [{ metric, operator, value }] as CriteriaCondition[],
      logic: rest.logic ?? "AND",
    };
  }

  return { ...raw, conditions };
}

/**
 * Normalize criteria into the canonical group form.
 *
 * Groups are OR'd together; conditions within a group combine by the group's own logic.
 * Empty groups (no conditions) are dropped so they never silently match everything.
 *
 * @returns One group per OR-branch. Empty array when there are no conditions at all.
 */
export function getCriteriaGroups(criteria: GroupableCriteria | null | undefined): CriteriaGroup[] {
  if (!criteria) return [];

  if (criteria.groups && criteria.groups.length > 0) {
    return criteria.groups
      .map((group) => ({
        conditions: normalizeCriteriaConditions(group?.conditions),
        logic: group?.logic ?? DEFAULT_GROUP_LOGIC,
      }))
      .filter((group) => group.conditions.length > 0);
  }

  const conditions = normalizeCriteriaConditions(criteria.conditions);
  if (conditions.length === 0) return [];
  return [{ conditions, logic: criteria.logic ?? DEFAULT_GROUP_LOGIC }];
}

/**
 * Every condition across all groups, flattened. Use for "which metrics are referenced"
 * style checks (conversion-event detection, field selection, etc.) — NOT for evaluation,
 * since flattening discards the AND/OR group boundaries.
 */
export function flattenGroupConditions(groups: CriteriaGroup[]): CriteriaCondition[] {
  return groups.flatMap((group) => group.conditions);
}

/**
 * Named Meta metrics whose evaluated value resolves against the user-selected
 * conversion event (`criteria.conversionEvent`). Every other named metric uses a
 * dedicated, hardcoded Meta action type — `leads` → "lead", `purchases` →
 * "purchase", `addToCart` → "add_to_cart", `cpa`/`costPerResult` → the ad set's
 * optimization_goal — so the conversion-event selector has no effect on them and
 * showing it is misleading. Keep in sync with api-app's metric resolution
 * (automations.service.ts).
 */
export const CONVERSION_EVENT_METRICS = ["roas", "roas1dClick", "conversions", "conversionValue"] as const;

/**
 * Whether any condition references a metric whose value depends on the selected
 * conversion event — the named ROAS/Conversions metrics or a custom pixel event.
 * Used to show the Conversion Event selector (and summary badge) only when it
 * actually affects the rule.
 */
export function criteriaUsesConversionEvent(criteria: GroupableCriteria | null | undefined): boolean {
  const conditions = flattenGroupConditions(getCriteriaGroups(criteria));
  return conditions.some((condition) => {
    const metric = typeof condition?.metric === "string" ? condition.metric : "";
    if (!metric) return false;
    return (
      (CONVERSION_EVENT_METRICS as readonly string[]).includes(metric) ||
      metric.startsWith("custom:") ||
      metric.startsWith("custom_cost:")
    );
  });
}

type ConditionEvaluator = (condition: CriteriaCondition, metrics: Record<string, unknown>) => boolean;

/** Whether a metrics object satisfies a single group, per that group's logic. */
export function groupMatches(
  group: CriteriaGroup,
  metrics: Record<string, unknown>,
  evaluate: ConditionEvaluator,
): boolean {
  return group.logic === "OR"
    ? group.conditions.some((condition) => evaluate(condition, metrics))
    : group.conditions.every((condition) => evaluate(condition, metrics));
}

/** Whether a metrics object satisfies ANY group (groups are OR'd together). */
export function groupsMatch(
  groups: CriteriaGroup[],
  metrics: Record<string, unknown>,
  evaluate: ConditionEvaluator,
): boolean {
  return groups.some((group) => groupMatches(group, metrics, evaluate));
}
