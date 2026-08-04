// Auto-Scale Types - for automatically scaling high-performing ads

// Aggregation level for performance threshold evaluation
export type AggregationLevel =
  | "per_ad"
  | "average"
  | "mixed"
  | "adset_average"
  | "adset_total"
  | "campaign_average"
  | "campaign_total"
  | "top_per_adset";

// Criteria condition for a single metric check
export type CriteriaCondition =
  | {
      metric: string; // Any metric from AUTOMATION_METRICS or custom events (e.g., "custom:offsite_conversion.fb_pixel_custom.123")
      operator: ">" | ">=" | "<" | "<=" | "=";
      value: number;
      valueUnit?: "days" | "weeks" | "months"; // Display unit for duration metrics (adAge). Canonical `value` stays in DAYS; engines ignore this.
      averageThresholdPercent?: number; // Per-condition % multiplier for average mode (e.g. 50 = avg × 0.50)
      aggregation?: "per_ad" | "average"; // Per-condition override, used in "mixed" mode
    }
  | {
      metric: "adName";
      operator: "contains" | "not_contains" | "equals" | "starts_with" | "ends_with";
      value: string;
    };

// A group of conditions combined by a single logic operator.
// Top-level groups are OR'd together (sum-of-products / DNF form):
//   (Spend > 250 AND Leads < 1) OR (Spend > 250 AND CPA > 50)
// Conditions WITHIN a group combine by that group's own `logic`.
export interface CriteriaGroup {
  conditions: CriteriaCondition[];
  logic: "AND" | "OR";
}

// Full criteria configuration stored in AutoScaleRule.criteria JSON field
export interface AutoScaleCriteria {
  conditions: CriteriaCondition[]; // legacy flat form; kept for backward compatibility
  logic: "AND" | "OR"; // legacy single combinator; kept for backward compatibility
  // When present and non-empty, `groups` is the source of truth and overrides
  // the flat `conditions`/`logic` above. A legacy rule (no `groups`) is treated
  // as a single group, so it evaluates identically. See lib/automation/criteria-groups.ts.
  groups?: CriteriaGroup[];
  aggregation?: AggregationLevel; // defaults to "per_ad" — applies to all numeric conditions
  averageThresholdPercent?: number; // % tolerance around the average (e.g. 10 = ±10%). Only used when aggregation is "average".
  rankMetric?: string; // metric used when aggregation is "top_per_adset"; defaults to roas
  rankDirection?: "asc" | "desc"; // lower-is-better metrics can rank asc
  topPerAdSetLimit?: number; // defaults to one winner per ad set
  conversionEvent: string; // e.g., "omni_purchase", "purchase", "lead", custom events
  lookbackDays: number; // "Performance Period" — insights date_preset window (1-30 days)
  adCreatedWithinDays?: number; // "Lookback Period" — only check ads created within X days
  excludeRecentDays?: number; // Exclude the most recent N days from the performance window
  includeToday?: boolean; // Include today's partial Meta insights in the performance window (Meta only)
  excludeRecentCreatedDays?: number; // Exclude ads created in the most recent N days from the lookback window
}

// Ad performance data from Meta API
export interface AdPerformance {
  adId: string;
  adName: string;
  adStatus: string;
  spend: number;
  conversions: number; // Based on selected conversion event
  conversionValue: number; // Revenue for ROAS calculation
  roas: number; // conversionValue / spend
  cpa: number; // spend / conversions
  impressions: number;
  clicks: number;
  ctr: number; // clicks / impressions * 100
  cpc: number; // spend / clicks
}

// Scaled ad record stored in stepResults
export interface ScaledAdResult {
  sourceAdId: string;
  sourceAdName: string;
  destinationAdId: string | null;
  method: "copies" | "launcher_fallback";
  performance: {
    roas: number;
    cpa: number;
    spend: number;
    conversions: number;
  };
  originalPaused: boolean;
  error?: string;
}

// Skipped ad record stored in stepResults
export interface SkippedAdResult {
  adId: string;
  adName: string;
  reason: string; // e.g., "In cooldown (scaled 20h ago)", "Daily limit reached"
}

// Step results structure stored in AutomationExecution.stepResults JSON
export interface AutoScaleStepResults {
  adsChecked: number;
  adsQualified: number;
  adsScaled: number;
  adsSkipped: number;
  scaledAds: ScaledAdResult[];
  skippedAds: SkippedAdResult[];
}

// API request/response types
export interface CreateAutoScaleRuleRequest {
  name: string;
  sourceAdSetId: string;
  sourceAdSetName?: string;
  accountId: string;
  criteria: AutoScaleCriteria;
  destinationType: "existing" | "auto-create";
  destinationAdSetId?: string;
  destinationAdSetName?: string;
  destinationCampaignId?: string;
  destinationNaming?: string;
  maxAdsPerDay?: number;
  cooldownHours?: number;
  dailyBudgetCap?: number;
  pauseOriginal?: boolean;
}

export interface UpdateAutoScaleRuleRequest extends Partial<CreateAutoScaleRuleRequest> {
  id: number;
  status?: "active" | "paused";
}

export interface PreviewAutoScaleRequest {
  accountId: string;
  adSetId: string;
  criteria: AutoScaleCriteria;
}

export interface PreviewAutoScaleResponse {
  qualifyingAds: AdPerformance[];
  totalAdsChecked: number;
  criteriaMatched: number;
}

// Execution history for display in UI
export interface AutoScaleExecutionSummary {
  id: number;
  ruleName: string;
  ruleId: number;
  status: "running" | "completed" | "failed" | "no_matches";
  executedAt: Date;
  completedAt?: Date;
  duration?: number;
  adsChecked: number;
  adsScaled: number;
  adsSkipped: number;
  errorMessage?: string;
}

// Full execution details for modal view
export interface AutoScaleExecutionDetail extends AutoScaleExecutionSummary {
  executionLogs: string[];
  stepResults: AutoScaleStepResults;
  accountId: string;
  sourceAdSetId: string;
  destinationAdSetId?: string;
}
