// Maps an AutomationRule's persisted DB status to the UI states the automations
// table renders, and decides which states have a disabled on/off toggle.
//
// Principle: rules are normally pausable AND unpausable. The cron and execute
// paths can leave a rule in transient statuses like "failed", "completed",
// "paused", or "rate_limited" — all of those must stay re-enableable from the
// UI. A "draft" is just an unstarted rule the user can turn on, so it
// is toggleable too. The ONLY state whose on/off toggle we disable is
// "archived", which is managed via the Archive/Unarchive menu rather than the
// switch.

export type RuleUiStatus = "on" | "off" | "draft" | "archived";

/** UI states whose on/off toggle is disabled (managed elsewhere, not the switch). */
const NON_RUNNABLE_UI_STATUSES: ReadonlySet<RuleUiStatus> = new Set(["archived"]);

export function mapRuleStatusToUiStatus(dbStatus: string | null | undefined): RuleUiStatus {
  switch (dbStatus) {
    case "active":
      return "on";
    case "archived":
      return "archived";
    case "draft":
      return "draft";
    // "paused", "failed", "completed", "rate_limited", and any other transient
    // status all render as a toggleable "off" so the user can pause/unpause.
    default:
      return "off";
  }
}

export function isRuleToggleDisabled(uiStatus: RuleUiStatus): boolean {
  return NON_RUNNABLE_UI_STATUSES.has(uiStatus);
}
