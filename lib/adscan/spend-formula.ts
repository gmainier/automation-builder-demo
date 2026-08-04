/**
 * Single source of truth for the views→spend approximation used by the
 * Adscan competitor trigger's spend threshold.
 *
 * Spend is not tracked in the upstream Adscan schema today — `ad_engagement`
 * exposes reach / views / impressions but no spend column. Until real spend
 * ingestion lands, the spend filter approximates spend as a constant fraction
 * of the latest engagement value, matching the placeholder formula already in
 * use upstream (Adscan brandSpy advertiser cards, followed-companies list).
 *
 * Mirrors `adscan-web:packages/api/src/lib/spend-formula.ts`. Keep the constant
 * in sync — when real spend lands, both copies must drop together.
 */

export const VIEWS_TO_SPEND_RATIO = 0.015;

export function calculateSpendFromViews(views: number): number {
  return views * VIEWS_TO_SPEND_RATIO;
}

/**
 * Subset of `AdscanAd` needed to derive the unified "views" engagement value.
 * Kept minimal so this helper can be called from both server (trigger
 * evaluator, notification formatter) and client (dry-run preview UI) without
 * pulling the full `AdscanAd` import graph.
 */
export interface AdscanEngagementMetrics {
  readonly views?: number | null;
  readonly reach?: number | null;
  readonly impressions?: number | null;
}

/**
 * Pick the first non-null engagement metric from an Adscan ad row. Treats
 * reach > views > impressions as a unified "views" signal — mirrors the
 * upstream Adscan SQL ordering used by `applyViewsThreshold` /
 * `applySpendThreshold` so every consumer sees the same number for the same
 * ad. Returns null when no engagement column is populated (US Ad Library
 * rows often null-fill all three).
 */
export function pickAdscanViewsMetric(ad: AdscanEngagementMetrics): number | null {
  if (typeof ad.reach === "number") return ad.reach;
  if (typeof ad.views === "number") return ad.views;
  if (typeof ad.impressions === "number") return ad.impressions;
  return null;
}
