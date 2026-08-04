/**
 * Decides whether a TikTok report row should enter performance-threshold evaluation.
 * By default zero-delivery ads (no spend and no impressions) are skipped so
 * metrics like CTR=0 do not mass-match idle creatives. Spend-independent rules
 * (adName / adAge) and an explicit includeZeroDeliveryAds opt-in keep those rows.
 */

export interface TikTokDeliveryGateOptions {
  spend: number;
  impressions: number;
  /**
   * True iff every condition is spend-independent (adName / adAge) — such rules
   * stay meaningful for an ad that did not deliver in the window.
   */
  allConditionsSpendIndependent: boolean;
  includeZeroDeliveryAds: boolean;
}

/**
 * @returns true when the ad should be evaluated against criteria
 */
export function shouldEvaluateTikTokAdForThreshold(options: TikTokDeliveryGateOptions): boolean {
  if (options.allConditionsSpendIndependent || options.includeZeroDeliveryAds) {
    return true;
  }
  return options.spend > 0 || options.impressions > 0;
}

/**
 * Parse the includeZeroDeliveryAds flag from trigger config or query params.
 * Accepts boolean true or the string "true" (URLSearchParams).
 */
export function parseIncludeZeroDeliveryAds(value: unknown): boolean {
  return value === true || value === "true";
}
