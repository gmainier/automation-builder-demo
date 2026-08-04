/**
 * Display labels and Meta-account gating for automation builder UI.
 * Keeps platform copy out of shared components that serve Meta + TikTok.
 */

export type AutomationAdsPlatform = "meta" | "tiktok" | "snapchat" | "google";

const ADS_PLATFORM_LABELS: Record<AutomationAdsPlatform, string> = {
  meta: "Meta",
  tiktok: "TikTok",
  snapchat: "Snapchat",
  google: "Google Ads",
};

/** Services that use the header Meta ad-account selector / selectedAccountId. */
const META_ACCOUNT_SERVICES = new Set(["meta-ads", "facebook-rules", "app"]);

/**
 * Human-readable ads platform name for UI copy (e.g. insights helper text).
 */
export function getAutomationAdsPlatformLabel(platform: AutomationAdsPlatform): string {
  return ADS_PLATFORM_LABELS[platform];
}

/**
 * "Include today's partial data" is a Meta live-insights feature.
 * TikTok performance windows already run through today and ignore includeToday.
 */
export function supportsIncludeTodayPartialData(platform: AutomationAdsPlatform): boolean {
  return platform === "meta";
}

export function getIncludeTodayInsightsDescription(platform: AutomationAdsPlatform): string {
  const label = getAutomationAdsPlatformLabel(platform);
  return `Use live ${label} insights through today, even though conversions and CPA may still change.`;
}

type FlowNodeWithService = {
  service?: string | null;
};

/**
 * Whether the builder header should show the Meta-only ad account selector.
 * Hide it for TikTok/cross-channel flows that never use selectedAccountId.
 */
export function shouldShowMetaAccountSelector(nodes: ReadonlyArray<FlowNodeWithService>): boolean {
  if (nodes.length === 0) {
    return true;
  }

  const hasMetaAccountService = nodes.some((node) => {
    const service = node.service;
    return typeof service === "string" && META_ACCOUNT_SERVICES.has(service);
  });

  if (hasMetaAccountService) {
    return true;
  }

  const hasNonMetaAdsService = nodes.some((node) => {
    const service = node.service;
    if (typeof service !== "string") return false;
    return service.endsWith("-ads") && service !== "meta-ads";
  });

  return !hasNonMetaAdsService;
}
