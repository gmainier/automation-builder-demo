/**
 * Minimal automation rule shape needed by the table search predicate.
 */
export interface SearchableAutomationRule {
  readonly id: number;
  readonly name: string;
  readonly accountId?: string | null;
  readonly accountName?: string | null;
  readonly userEmail?: string | null;
  readonly source?: string | null;
}

function normalizeSearchTerm(searchTerm: string): string {
  return searchTerm.trim().toLowerCase();
}

function getSearchValues(automation: SearchableAutomationRule): string[] {
  return [
    automation.name,
    automation.accountId,
    automation.accountName,
    automation.userEmail,
    String(automation.id),
    automation.source,
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase());
}

/**
 * Checks whether an automation rule matches the table search text.
 * Search includes visible account names and raw account IDs so users can filter
 * by the ad account value returned from the API.
 */
export function doesAutomationMatchSearch(automation: SearchableAutomationRule, searchTerm: string): boolean {
  const normalizedSearchTerm = normalizeSearchTerm(searchTerm);
  if (!normalizedSearchTerm) return true;

  return getSearchValues(automation).some((searchValue) => searchValue.includes(normalizedSearchTerm));
}
