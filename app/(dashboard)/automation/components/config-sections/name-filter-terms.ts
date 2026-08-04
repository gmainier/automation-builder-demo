export interface NameFilterTerm {
  index: number;
  label: string;
}

const AND_MATCH_TYPES = new Set(["contains", "not_contains"]);
const OR_MATCH_TYPES = new Set(["equals", "starts_with", "ends_with"]);

export function parseNameFilterTerms(filterValue: string): NameFilterTerm[] {
  return filterValue
    .split(",")
    .map((rawTerm, index) => ({ index, label: rawTerm.trim() }))
    .filter((term) => term.label.length > 0);
}

export function removeNameFilterTerm(filterValue: string, termIndex: number): string {
  return parseNameFilterTerms(filterValue)
    .filter((term) => term.index !== termIndex)
    .map((term) => term.label)
    .join(", ");
}

export function getNameFilterJoinLabel(matchType: string | undefined): "AND" | "OR" | null {
  if (!matchType) return null;
  if (AND_MATCH_TYPES.has(matchType)) return "AND";
  if (OR_MATCH_TYPES.has(matchType)) return "OR";
  return null;
}
