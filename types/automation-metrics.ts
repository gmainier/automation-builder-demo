/**
 * Shared automation metrics definition
 * Used by criteria-builder UI, preview API, and execution trigger
 */

/**
 * Ads platforms whose Performance Threshold configs share this metric catalog.
 * Mirrors `AutomationAdsPlatform` in app/(dashboard)/automation/lib/automation-platform-labels.ts
 * (types/ must not import from app/, so the union is duplicated here — keep the two aligned).
 */
export type AutomationMetricPlatform = "meta" | "tiktok" | "snapchat";

export interface AutomationMetric {
  value: string;
  label: string;
  group: "performance" | "conversion" | "video" | "engagement" | "customEvent" | "workspaceCustom";
  type: "number" | "text";
  isCurrency: boolean;
  suffix: string;
  goalDirection?: "HIGHER" | "LOWER";
  description?: string;
  /** For custom event metrics, the Facebook action_type to look up in the actions/conversions array */
  actionType?: string;
  /** For workspace-defined custom metrics (formula-based). The value is `custom_<cuid>`. */
  customMetricId?: string;
  /** Platforms whose pickers may offer this metric. Absent = selectable on all platforms. */
  platforms?: readonly AutomationMetricPlatform[];
}

export const AUTOMATION_METRICS: AutomationMetric[] = [
  // Performance Group
  {
    value: "spend",
    label: "Spend",
    group: "performance",
    type: "number",
    isCurrency: true,
    suffix: "",
    goalDirection: "LOWER",
    description: "Total amount spent",
  },
  {
    value: "costPerResult",
    label: "Cost per Result",
    group: "performance",
    type: "number",
    isCurrency: true,
    suffix: "",
    goalDirection: "LOWER",
    description: "Cost per result based on Meta's optimization goal (e.g., Start Trial, Purchase)",
  },
  {
    value: "roas",
    label: "Purchase ROAS",
    group: "performance",
    type: "number",
    isCurrency: false,
    suffix: "",
    goalDirection: "HIGHER",
    description: "Purchase return on ad spend (purchase revenue / spend)",
  },
  {
    value: "roas1dClick",
    label: "Day 1 ROAS",
    group: "performance",
    type: "number",
    isCurrency: false,
    suffix: "",
    goalDirection: "HIGHER",
    description: "Purchase ROAS on Meta's 1-day click attribution window (same-day return)",
  },
  {
    value: "cpa",
    label: "CPA",
    group: "performance",
    type: "number",
    isCurrency: true,
    suffix: "",
    goalDirection: "LOWER",
    description: "Cost per acquisition",
  },
  {
    value: "cpm",
    label: "CPM",
    group: "performance",
    type: "number",
    isCurrency: true,
    suffix: "",
    goalDirection: "LOWER",
    description: "Cost per 1,000 impressions",
  },
  {
    value: "cpc",
    label: "CPC",
    group: "performance",
    type: "number",
    isCurrency: true,
    suffix: "",
    goalDirection: "LOWER",
    description: "Cost per click",
  },
  {
    value: "ctr",
    label: "CTR (All)",
    group: "performance",
    type: "number",
    isCurrency: false,
    suffix: "%",
    goalDirection: "HIGHER",
    description: "Click-through rate across all clicks (includes reactions, profile clicks, etc.)",
  },
  {
    value: "linkCtr",
    label: "Link CTR",
    group: "performance",
    type: "number",
    isCurrency: false,
    suffix: "%",
    goalDirection: "HIGHER",
    description: "Link click-through rate (link clicks ÷ impressions)",
  },
  {
    value: "frequency",
    label: "Frequency",
    group: "performance",
    type: "number",
    isCurrency: false,
    suffix: "",
    goalDirection: "LOWER",
    description: "Average times each person saw the ad",
  },
  {
    value: "impressions",
    label: "Impressions",
    group: "performance",
    type: "number",
    isCurrency: false,
    suffix: "",
    goalDirection: "HIGHER",
    description: "Total number of impressions",
  },
  {
    value: "reach",
    label: "Reach",
    group: "performance",
    type: "number",
    isCurrency: false,
    suffix: "",
    goalDirection: "HIGHER",
    description: "Unique people reached",
  },
  {
    value: "clicks",
    label: "Clicks",
    group: "performance",
    type: "number",
    isCurrency: false,
    suffix: "",
    goalDirection: "HIGHER",
    description: "Total clicks",
  },
  {
    value: "adAge",
    label: "Ad Age",
    group: "performance",
    type: "number",
    isCurrency: false,
    suffix: "days",
    description: "Whole days since the ad was created (an ad is age 0 until it is 24h old)",
    platforms: ["meta", "tiktok", "snapchat"],
  },

  // Conversion Group
  {
    value: "conversions",
    label: "Conversions",
    group: "conversion",
    type: "number",
    isCurrency: false,
    suffix: "",
    goalDirection: "HIGHER",
    description: "Total conversions (based on conversion event)",
  },
  {
    value: "appInstalls",
    label: "App Installs",
    group: "conversion",
    type: "number",
    isCurrency: false,
    suffix: "",
    goalDirection: "HIGHER",
    description: "Number of app installs",
  },
  {
    value: "purchases",
    label: "Purchases",
    group: "conversion",
    type: "number",
    isCurrency: false,
    suffix: "",
    goalDirection: "HIGHER",
    description: "Number of purchases",
  },
  {
    value: "purchaseValue",
    label: "Purchase Value",
    group: "conversion",
    type: "number",
    isCurrency: true,
    suffix: "",
    goalDirection: "HIGHER",
    description: "Total purchase revenue",
  },
  {
    value: "costPerPurchase",
    label: "Cost per Purchase",
    group: "conversion",
    type: "number",
    isCurrency: true,
    suffix: "",
    goalDirection: "LOWER",
    description: "Cost per purchase",
  },
  {
    value: "leads",
    label: "Leads",
    group: "conversion",
    type: "number",
    isCurrency: false,
    suffix: "",
    goalDirection: "HIGHER",
    description: "Number of leads",
  },
  {
    value: "costPerLead",
    label: "Cost per Lead",
    group: "conversion",
    type: "number",
    isCurrency: true,
    suffix: "",
    goalDirection: "LOWER",
    description: "Cost per lead",
  },
  {
    value: "addToCart",
    label: "Add to Cart",
    group: "conversion",
    type: "number",
    isCurrency: false,
    suffix: "",
    goalDirection: "HIGHER",
    description: "Number of add to cart actions",
  },
  {
    value: "costPerAddToCart",
    label: "Cost per Add to Cart",
    group: "conversion",
    type: "number",
    isCurrency: true,
    suffix: "",
    goalDirection: "LOWER",
    description: "Cost per add to cart",
  },
  {
    value: "registrations",
    label: "Registrations",
    group: "conversion",
    type: "number",
    isCurrency: false,
    suffix: "",
    goalDirection: "HIGHER",
    description: "Number of registrations",
  },
  {
    value: "costPerRegistration",
    label: "Cost per Registration",
    group: "conversion",
    type: "number",
    isCurrency: true,
    suffix: "",
    goalDirection: "LOWER",
    description: "Cost per registration",
  },

  // Video Group
  {
    value: "hookRate",
    label: "Hook Rate",
    group: "video",
    type: "number",
    isCurrency: false,
    suffix: "%",
    goalDirection: "HIGHER",
    description: "% of viewers who watched 3+ seconds",
  },
  {
    value: "holdRate",
    label: "Hold Rate",
    group: "video",
    type: "number",
    isCurrency: false,
    suffix: "%",
    goalDirection: "HIGHER",
    description: "% of 3s viewers who watched 15s or to completion (ThruPlays / 3s views)",
  },
  {
    value: "thruPlayRate",
    label: "ThruPlay Rate",
    group: "video",
    type: "number",
    isCurrency: false,
    suffix: "%",
    goalDirection: "HIGHER",
    description: "% of viewers who completed video or watched 15s+",
  },
  {
    value: "videoViews",
    label: "Video Views",
    group: "video",
    type: "number",
    isCurrency: false,
    suffix: "",
    goalDirection: "HIGHER",
    description: "Total 3-second video views",
  },
  {
    value: "thruPlays",
    label: "ThruPlays",
    group: "video",
    type: "number",
    isCurrency: false,
    suffix: "",
    goalDirection: "HIGHER",
    description: "Video plays to completion or 15s+",
  },
  {
    value: "costPerThruPlay",
    label: "Cost per ThruPlay",
    group: "video",
    type: "number",
    isCurrency: true,
    suffix: "",
    goalDirection: "LOWER",
    description: "Cost per thruplay",
  },
  {
    value: "videoP25",
    label: "Video 25% Watched",
    group: "video",
    type: "number",
    isCurrency: false,
    suffix: "",
    goalDirection: "HIGHER",
    description: "Views to 25% of video",
  },
  {
    value: "videoP50",
    label: "Video 50% Watched",
    group: "video",
    type: "number",
    isCurrency: false,
    suffix: "",
    goalDirection: "HIGHER",
    description: "Views to 50% of video",
  },
  {
    value: "videoP75",
    label: "Video 75% Watched",
    group: "video",
    type: "number",
    isCurrency: false,
    suffix: "",
    goalDirection: "HIGHER",
    description: "Views to 75% of video",
  },
  {
    value: "videoP100",
    label: "Video 100% Watched",
    group: "video",
    type: "number",
    isCurrency: false,
    suffix: "",
    goalDirection: "HIGHER",
    description: "Views to 100% of video",
  },

  // Engagement Group
  {
    value: "linkClicks",
    label: "Link Clicks",
    group: "engagement",
    type: "number",
    isCurrency: false,
    suffix: "",
    goalDirection: "HIGHER",
    description: "Number of link clicks",
  },
  {
    value: "costPerLinkClick",
    label: "Cost per Link Click",
    group: "engagement",
    type: "number",
    isCurrency: true,
    suffix: "",
    goalDirection: "LOWER",
    description: "Cost per link click",
  },
  {
    value: "landingPageViews",
    label: "Landing Page Views",
    group: "engagement",
    type: "number",
    isCurrency: false,
    suffix: "",
    goalDirection: "HIGHER",
    description: "Number of landing page views",
  },
  {
    value: "costPerLandingPageView",
    label: "Cost per LPV",
    group: "engagement",
    type: "number",
    isCurrency: true,
    suffix: "",
    goalDirection: "LOWER",
    description: "Cost per landing page view",
  },

  // Text filter (for ad name)
  {
    value: "adName",
    label: "Ad Name",
    group: "performance",
    type: "text",
    isCurrency: false,
    suffix: "",
    description: "Filter by ad name",
  },
];

// Aggregation level options for criteria builder UI
export const AGGREGATION_LEVELS = [
  { value: "per_ad", label: "Per Ad" },
  { value: "average", label: "Average" },
  { value: "mixed", label: "Mixed" },
  { value: "adset_average", label: "Ad Set Avg" },
  { value: "adset_total", label: "Ad Set Total" },
  { value: "campaign_average", label: "Campaign Avg" },
  { value: "campaign_total", label: "Campaign Total" },
  { value: "top_per_adset", label: "Top Ad / Ad Set" },
] as const;

// Group metrics by category for UI
export const METRICS_BY_GROUP = {
  performance: AUTOMATION_METRICS.filter((m) => m.group === "performance" && m.type !== "text"),
  conversion: AUTOMATION_METRICS.filter((m) => m.group === "conversion"),
  video: AUTOMATION_METRICS.filter((m) => m.group === "video"),
  engagement: AUTOMATION_METRICS.filter((m) => m.group === "engagement"),
  text: AUTOMATION_METRICS.filter((m) => m.type === "text"),
};

// Get metric by value
export function getMetricByValue(value: string): AutomationMetric | undefined {
  return AUTOMATION_METRICS.find((m) => m.value === value);
}

/** Metric key for the Meta-only "Ad Age" duration condition. Canonical unit: days. */
export const AD_AGE_METRIC = "adAge";

/** Display units for the Ad Age condition input. Canonical storage is always days. */
export type AdAgeUnit = "days" | "weeks" | "months";

export const AD_AGE_UNITS: readonly { value: AdAgeUnit; label: string }[] = [
  { value: "days", label: "Days" },
  { value: "weeks", label: "Weeks" },
  { value: "months", label: "Months" },
] as const;

// Week/month factors are display conventions (month ≈ 30 days), not calendar math.
const AD_AGE_DAYS_PER_UNIT: Record<AdAgeUnit, number> = { days: 1, weeks: 7, months: 30 };

/** Tolerance for treating a converted unit amount as a whole number ("6 months", not "6.001 months"). */
const AD_AGE_WHOLE_UNIT_EPSILON = 0.01;

/** Round to 2 decimals to avoid float noise in unit conversions (1.5 weeks → 10.5 days). */
function roundToTwoDecimals(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * Snap a canonical day threshold for `operator`. Engines floor ad ages to
 * whole days, so `=` snaps to whole days — a fractional threshold could never
 * equal an integer age. Inequalities keep fractional precision: snapping them
 * would drift the boundary by up to half a day (`> 1.5 weeks` must stay
 * `> 10.5`, not become `> 11` and skip ads that are 11 whole days old).
 */
export function snapAdAgeDaysForOperator(days: number, operator: string): number {
  return operator === "=" ? Math.round(days) : roundToTwoDecimals(days);
}

/**
 * Convert a user-entered duration in `unit` to the canonical day threshold
 * for `operator` (whole days for `=`, 2-decimal precision otherwise).
 */
export function adAgeUnitToDays(amount: number, unit: AdAgeUnit, operator: string): number {
  return snapAdAgeDaysForOperator(amount * AD_AGE_DAYS_PER_UNIT[unit], operator);
}

/** Convert canonical days to the display amount for `unit`. */
export function adAgeDaysToUnit(days: number, unit: AdAgeUnit): number {
  return roundToTwoDecimals(days / AD_AGE_DAYS_PER_UNIT[unit]);
}

/**
 * Human label for an Ad Age threshold stored in canonical days.
 * Prefers the saved display unit when the value divides cleanly ("6 months",
 * "2 weeks"); otherwise falls back to days ("45 days").
 */
export function formatAdAgeValue(days: number, unit?: AdAgeUnit): string {
  if (unit && unit !== "days") {
    const amount = adAgeDaysToUnit(days, unit);
    if (Math.abs(amount - Math.round(amount)) < AD_AGE_WHOLE_UNIT_EPSILON) {
      const wholeAmount = Math.round(amount);
      const singularUnit = unit === "weeks" ? "week" : "month";
      return `${wholeAmount} ${wholeAmount === 1 ? singularUnit : `${singularUnit}s`}`;
    }
  }
  const dayAmount = roundToTwoDecimals(days);
  return `${dayAmount} ${dayAmount === 1 ? "day" : "days"}`;
}

/**
 * Generate AutomationMetric entries from discovered custom event conversion types.
 * Each custom event produces a count metric and a "Cost per" metric.
 */
export function generateCustomEventMetrics(
  conversionOptions: { propertyName: string; name: string; groupName: string; actionType?: string }[],
): AutomationMetric[] {
  const metrics: AutomationMetric[] = [];
  const seen = new Set<string>();

  for (const opt of conversionOptions) {
    // Only generate count + cost-per metrics (skip rate and cost variants from reports)
    if (opt.propertyName.endsWith("_rate") || opt.propertyName.endsWith("_cost")) continue;
    if (!opt.actionType) continue;

    const actionType = opt.actionType;
    if (seen.has(actionType)) continue;
    seen.add(actionType);

    // Count metric
    metrics.push({
      value: `custom:${actionType}`,
      label: opt.name,
      group: "customEvent",
      type: "number",
      isCurrency: false,
      suffix: "",
      goalDirection: "HIGHER",
      description: `Number of ${opt.name} conversions`,
      actionType,
    });

    // Cost per metric
    metrics.push({
      value: `custom_cost:${actionType}`,
      label: `Cost per ${opt.name}`,
      group: "customEvent",
      type: "number",
      isCurrency: true,
      suffix: "",
      goalDirection: "LOWER",
      description: `Cost per ${opt.name}`,
      actionType,
    });
  }

  return metrics;
}

// Format metric value for display
export function formatMetricValue(value: number | string, metric: AutomationMetric, currency?: string): string {
  if (metric.type === "text") return String(value);

  const numValue = typeof value === "number" ? value : parseFloat(value);
  if (isNaN(numValue)) return "-";

  if (metric.isCurrency) {
    const symbol = currency === "EUR" ? "€" : currency === "GBP" ? "£" : "$";
    return `${symbol}${numValue.toFixed(2)}`;
  }

  if (metric.suffix === "%") {
    return `${numValue.toFixed(2)}%`;
  }

  if (metric.suffix === "$") {
    return `$${numValue.toFixed(2)}`;
  }

  if (metric.value === AD_AGE_METRIC) {
    return formatAdAgeValue(numValue);
  }

  // Word suffixes (e.g. "days"). Only ""/"%"/"$" existed before this branch, so legacy rendering is unchanged.
  if (metric.suffix) {
    const formattedNumber = Number.isInteger(numValue) ? numValue.toLocaleString() : numValue.toFixed(2);
    return `${formattedNumber} ${metric.suffix}`;
  }

  // Plain number
  if (Number.isInteger(numValue)) {
    return numValue.toLocaleString();
  }
  return numValue.toFixed(2);
}
