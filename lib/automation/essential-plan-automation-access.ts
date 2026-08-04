import { getEffectiveOrganizationLimits } from "@/lib/billing/organization-limits";

/** Meta Ads trigger event allowed on Essential / Starter (alias) plans. */
export const ESSENTIAL_PLAN_META_TRIGGER_EVENT = "Performance Monitoring";

/** Comment automations are available on Essential (separate Comments product surface). */
export const TRIGGER_SERVICES_AVAILABLE_ON_ESSENTIAL_PLAN = new Set(["meta-ads", "comments"]);

/** Must stay in sync with `AppSelectorDialog` trigger list. */
const ALL_TRIGGER_APP_IDS = [
  "media-library",
  "google-sheets",
  "google-drive",
  "dropbox",
  "meta-ads",
  "tiktok-ads",
  "app",
  "scheduled",
  "manual",
  "comments",
] as const;

export function getPlanLockedTriggerServiceIdsForEssential(): string[] {
  return ALL_TRIGGER_APP_IDS.filter((id) => !TRIGGER_SERVICES_AVAILABLE_ON_ESSENTIAL_PLAN.has(id));
}

type FlowLike = { nodes?: unknown[] } | null | undefined;

type TriggerNodeLike = {
  type?: string;
  service?: string;
  event?: string;
};

export function isOrganizationOnEssentialAutomationPlan(
  org:
    | { plan?: string | null; planOverride?: string | null; extraAdAccountsAllowance?: number | null }
    | null
    | undefined,
): boolean {
  if (!org) return false;
  return getEffectiveOrganizationLimits(org).effectivePlanName === "essential";
}

export function getFlowTriggerNodes(flow: FlowLike): TriggerNodeLike[] {
  const nodes = flow?.nodes;
  if (!Array.isArray(nodes)) return [];
  return nodes.filter((n): n is TriggerNodeLike => (n as TriggerNodeLike)?.type === "trigger");
}

/**
 * When non-null, saving this automation should be rejected for Essential-plan orgs.
 */
export function getEssentialPlanAutomationBlockReason(flow: FlowLike): string | null {
  const triggers = getFlowTriggerNodes(flow);
  for (const trigger of triggers) {
    const svc = typeof trigger.service === "string" ? trigger.service.trim() : "";
    const evt = typeof trigger.event === "string" ? trigger.event.trim() : "";
    if (!svc) continue;
    if (svc === "comments") continue;
    if (svc !== "meta-ads") {
      return "Your Essential plan includes Performance Monitoring automations only. Upgrade to In-house to use other triggers.";
    }
    if (evt && evt !== ESSENTIAL_PLAN_META_TRIGGER_EVENT) {
      return "Your Essential plan includes the Performance Monitoring trigger only. Upgrade to In-house for other Meta Ads triggers.";
    }
  }
  return null;
}

export function isTriggerServiceAllowedOnEssentialPlan(serviceId: string): boolean {
  return TRIGGER_SERVICES_AVAILABLE_ON_ESSENTIAL_PLAN.has(serviceId);
}
