import type { CriteriaCondition, CriteriaGroup } from "@/types/auto-scale";

/**
 * Detects criteria groups that can never match anything, so the builder can warn
 * before the rule is saved.
 *
 * The case that prompted this: a customer wanting to pause three
 * named ads entered one `Ad name contains <full name>` condition per ad and left
 * the group on its default AND. A single ad name cannot contain three different
 * full ad names, so the rule matched 0 ads and looked broken. The engines were
 * behaving correctly; the setup was impossible.
 */

/** Substring operators where requiring two different values at once is impossible. */
const SUBSTRING_OPERATORS: ReadonlySet<string> = new Set(["contains", "equals", "starts_with"]);

/** A group whose AND-joined text conditions cannot all hold for one value. */
export interface UnsatisfiableTextConditions {
  /** The metric the conflicting conditions all read, e.g. "adName". */
  metric: string;
  /** The distinct values that were required simultaneously, in input order. */
  values: string[];
}

/** Narrows to the text variant of a condition, which is the only one with a string value. */
function getTextCondition(condition: CriteriaCondition): { metric: string; value: string } | null {
  if (typeof condition.value !== "string") return null;
  if (!SUBSTRING_OPERATORS.has(condition.operator)) return null;
  const value = condition.value.trim();
  if (!value) return null;
  return { metric: condition.metric, value };
}

/**
 * Finds AND-joined text conditions on one metric that require two or more
 * different values at the same time.
 *
 * Only flags a group that is genuinely impossible: OR groups are fine, and a
 * repeated identical value is redundant rather than contradictory.
 *
 * @returns The conflict, or `null` when the group is satisfiable.
 */
export function findUnsatisfiableTextConditions(group: CriteriaGroup): UnsatisfiableTextConditions | null {
  if (group.logic !== "AND") return null;

  const valuesByMetric = new Map<string, string[]>();

  for (const condition of group.conditions) {
    const textCondition = getTextCondition(condition);
    if (!textCondition) continue;

    const seen = valuesByMetric.get(textCondition.metric) ?? [];
    if (!seen.includes(textCondition.value)) seen.push(textCondition.value);
    valuesByMetric.set(textCondition.metric, seen);
  }

  for (const [metric, values] of valuesByMetric) {
    if (values.length > 1) return { metric, values };
  }

  return null;
}
