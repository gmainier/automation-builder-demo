/**
 * Exact Setup gaps for TikTok Ads → Performance Threshold.
 * Used by the Preview tab so users see what to fix instead of a generic message.
 */

export type TikTokPerformanceThresholdConfigLike = {
  advertiserId?: unknown;
  criteria?: {
    conditions?: ReadonlyArray<{ metric?: unknown; operator?: unknown }> | null;
    lookbackDays?: unknown;
  } | null;
};

export type TikTokPerformanceThresholdGap = {
  /** Short label shown in the Preview missing list */
  label: string;
  /** Where to fix it */
  where: "Setup" | "Settings";
};

/** Matches the defaults applied by TikTokPerformanceThresholdConfig when criteria is unset. */
const DEFAULT_CRITERIA = {
  conditions: [{ metric: "spend", operator: ">" }],
  lookbackDays: 7,
} as const;

function hasAdvertiserId(config: TikTokPerformanceThresholdConfigLike): boolean {
  return typeof config.advertiserId === "string" && config.advertiserId.trim().length > 0;
}

function resolveCriteria(config: TikTokPerformanceThresholdConfigLike): {
  conditions: ReadonlyArray<{ metric?: unknown; operator?: unknown }>;
  lookbackDays: unknown;
} {
  const criteria = config.criteria;
  return {
    conditions: Array.isArray(criteria?.conditions) ? criteria.conditions : DEFAULT_CRITERIA.conditions,
    lookbackDays: criteria?.lookbackDays ?? DEFAULT_CRITERIA.lookbackDays,
  };
}

function hasValidCondition(conditions: ReadonlyArray<{ metric?: unknown; operator?: unknown }>): boolean {
  if (conditions.length === 0) {
    return false;
  }

  return conditions.some(
    (condition) =>
      typeof condition?.metric === "string" &&
      condition.metric.trim().length > 0 &&
      typeof condition?.operator === "string" &&
      condition.operator.trim().length > 0,
  );
}

function hasLookbackDays(lookbackDays: unknown): boolean {
  return typeof lookbackDays === "number" && Number.isFinite(lookbackDays) && lookbackDays >= 0;
}

/**
 * Returns ordered gaps that block a meaningful TikTok Performance Threshold preview.
 * Applies the same criteria defaults as the Setup panel when criteria is unset.
 */
export function getTikTokPerformanceThresholdGaps(
  config: TikTokPerformanceThresholdConfigLike | null | undefined,
  options?: { hasConnectedTikTokAccounts?: boolean },
): TikTokPerformanceThresholdGap[] {
  const safeConfig = config ?? {};
  const gaps: TikTokPerformanceThresholdGap[] = [];
  const hasConnectedTikTokAccounts = options?.hasConnectedTikTokAccounts;
  const { conditions, lookbackDays } = resolveCriteria(safeConfig);

  if (!hasAdvertiserId(safeConfig)) {
    if (hasConnectedTikTokAccounts === false) {
      gaps.push({
        label: "No TikTok advertiser accounts connected",
        where: "Settings",
      });
    } else {
      gaps.push({
        label: "Select a TikTok advertiser account",
        where: "Setup",
      });
    }
  }

  if (!hasValidCondition(conditions)) {
    gaps.push({
      label: "Add at least one performance condition (metric + operator)",
      where: "Setup",
    });
  }

  if (!hasLookbackDays(lookbackDays)) {
    gaps.push({
      label: "Choose a performance period (lookback days)",
      where: "Setup",
    });
  }

  return gaps;
}

export function isTikTokPerformanceThresholdPreviewReady(
  config: TikTokPerformanceThresholdConfigLike | null | undefined,
  options?: { hasConnectedTikTokAccounts?: boolean },
): boolean {
  return getTikTokPerformanceThresholdGaps(config, options).length === 0;
}
