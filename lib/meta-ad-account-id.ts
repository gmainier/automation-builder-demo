/**
 * Meta (Facebook) ad account IDs used for currency and Graph lookups.
 * Matches {@link lib/meta-ad-account-name.ts} heuristics: act_ prefix or long numeric id.
 */

const META_NUMERIC_ID_MIN_LENGTH = 10;
const META_ACCOUNT_PREFIX = "act_";
const META_BIGQUERY_DATASET_ACCOUNT_ID_PATTERN = /^(?:act_?\d+|\d+)$/;

function normalizePrefixCheckInput(businessId: string | null | undefined): string {
  return typeof businessId === "string" ? businessId.trim().toLowerCase() : "";
}

/**
 * Profile-loading APIs are Meta-only and should never run for non-prefixed ids.
 * This is intentionally stricter than currency/account-name normalization helpers.
 */
export function hasMetaAdAccountPrefix(businessId: string | null | undefined): boolean {
  return normalizePrefixCheckInput(businessId).includes(META_ACCOUNT_PREFIX);
}

/**
 * Returns true when the ad account id is explicitly scoped to Meta via an
 * `act_` prefix at the start of the id.
 */
export function isActPrefixedMetaAdAccountId(businessId: string | null | undefined): boolean {
  return normalizePrefixCheckInput(businessId).startsWith(META_ACCOUNT_PREFIX);
}

/**
 * Returns a canonical `act_<digits>` id for Meta ad accounts, or null if the value
 * does not look like a Meta ad account id (e.g. TikTok or other platforms).
 */
export function normalizeMetaAdAccountIdForCurrency(businessId: string): string | null {
  const trimmed = typeof businessId === "string" ? businessId.trim() : "";
  if (!trimmed) {
    return null;
  }

  const actMatch = new RegExp(`^${META_ACCOUNT_PREFIX}(.+)$`, "i").exec(trimmed);
  if (actMatch) {
    const suffix = actMatch[1];
    return `${META_ACCOUNT_PREFIX}${suffix}`;
  }

  if (new RegExp(`^\\d{${META_NUMERIC_ID_MIN_LENGTH},}$`).test(trimmed)) {
    return `${META_ACCOUNT_PREFIX}${trimmed}`;
  }

  return null;
}

/**
 * Returns true only for Meta account ids that are safe to interpolate as
 * BigQuery dataset identifiers.
 */
export function isSafeMetaBigQueryDatasetAccountId(accountId: string | null | undefined): accountId is string {
  return typeof accountId === "string" && META_BIGQUERY_DATASET_ACCOUNT_ID_PATTERN.test(accountId);
}

/**
 * Returns the common Meta account id forms used across legacy account tables.
 */
export function getMetaAdAccountIdVariants(accountId: string): string[] {
  const numericAccountId = accountId.replace(/^act_?/, "");
  return [...new Set([accountId, `act_${numericAccountId}`, `act${numericAccountId}`, numericAccountId])];
}
