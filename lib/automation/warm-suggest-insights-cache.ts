const META_AUTOMATION_ACCOUNT_ID_PATTERN = /^(?:act_)?\d{10,}$/i;
const DEFAULT_SUGGEST_LOOKBACK_DAYS = 30;
const ALLOWED_LOOKBACK_DAYS = new Set([7, 14, 30]);

export function isMetaAutomationAccountId(accountId: string | undefined | null): boolean {
  if (!accountId?.trim()) return false;
  return META_AUTOMATION_ACCOUNT_ID_PATTERN.test(accountId.trim());
}

function resolveLookbackDays(raw: string | null): number {
  if (!raw) return DEFAULT_SUGGEST_LOOKBACK_DAYS;
  const parsed = Number.parseInt(raw, 10);
  return ALLOWED_LOOKBACK_DAYS.has(parsed) ? parsed : DEFAULT_SUGGEST_LOOKBACK_DAYS;
}

function buildWarmUrl(accountId: string, lookbackDays: number): string {
  const params = new URLSearchParams({
    accountId,
    lookbackDays: String(lookbackDays),
  });
  return `/api/automation/account-insights/warm?${params.toString()}`;
}

/**
 * Fire-and-forget warm of the suggest-mode account insights Redis cache.
 * Safe to call on automation page load when a Meta account is selected.
 */
export function warmAutomationSuggestInsightsCache(
  accountId: string,
  lookbackDays: number = DEFAULT_SUGGEST_LOOKBACK_DAYS,
): void {
  const trimmedAccountId = accountId.trim();
  if (!isMetaAutomationAccountId(trimmedAccountId)) return;

  const url = buildWarmUrl(trimmedAccountId, resolveLookbackDays(String(lookbackDays)));
  void fetch(url, { method: "GET", credentials: "same-origin", cache: "no-store" }).catch(() => undefined);
}

export { DEFAULT_SUGGEST_LOOKBACK_DAYS, resolveLookbackDays };
