import { normalizeAssistantCriteria } from "@/lib/automation/criteria-groups";
import type { NodeType } from "../contexts/automation-context";

/**
 * Canonical Meta/TikTok/Snapchat action event labels used by the builder Select.
 * Models often emit near-misses ("Pause Ads", "pause") that leave the dropdown empty.
 */
const EVENT_ALIASES: Readonly<Record<string, string>> = {
  pause: "Pause Ad",
  "pause ad": "Pause Ad",
  "pause ads": "Pause Ad",
  "enable ad": "Enable Ad",
  "enable ads": "Enable Ad",
  "pause ad set": "Pause Ad Set",
  "pause adsets": "Pause Ad Set",
  "pause campaign": "Pause Campaign",
  "pause campaigns": "Pause Campaign",
  "duplicate ad": "Duplicate Ad",
  "duplicate ads": "Duplicate Ad",
  "performance threshold": "Performance Threshold",
  "send notification": "Send Notification",
  approve: "Approval Required",
  approval: "Approval Required",
  "approval required": "Approval Required",
  "launch on tiktok": "Launch on TikTok",
  "launch on snapchat": "Launch on Snapchat",
  "launch on pinterest": "Launch on Pinterest",
  "launch on axon": "Launch on Axon",
  slack: "Send Notification",
  notify: "Send Notification",
  notification: "Send Notification",
  "send slack notification": "Send Notification",
  "send slack": "Send Notification",
};

const APPROVAL_SERVICE = "approval";
const APPROVAL_EVENT = "Approval Required";
const DELAY_SERVICE = "delay";
const DELAY_EVENT = "Wait for Duration";
const NOTIFICATION_SERVICE = "notification";
const NOTIFICATION_EVENT = "Send Notification";
const NOTIFICATION_METHODS: ReadonlySet<string> = new Set(["email", "slack", "both"]);
const DEFAULT_PAUSE_TARGET_IDS = "{{node-trigger-1.qualifyingAdIds}}";
const DEFAULT_APPROVAL_EXPIRATION_DAYS = 3;

/** Cross-channel services use "Launch on …", not Meta-style "Launch Ad". */
const CROSS_CHANNEL_LAUNCH_BY_SERVICE: Readonly<Record<string, string>> = {
  "tiktok-ads": "Launch on TikTok",
  "snapchat-ads": "Launch on Snapchat",
  "pinterest-ads": "Launch on Pinterest",
  "axon-ads": "Launch on Axon",
  "google-ads": "Launch on Google Ads",
};

export interface NormalizeAssistantStepInput {
  readonly type?: NodeType;
  readonly service?: string;
  readonly event?: string;
  readonly config?: Record<string, unknown>;
}

export interface NormalizedAssistantStepFields {
  readonly service?: string;
  readonly event?: string;
  readonly config?: Record<string, unknown>;
}

/**
 * Normalize builder-tool service/event/config so canvas Selects match the
 * automation registry (exact labels, approval/delay wiring, cross-channel launch).
 */
export function normalizeAssistantStepFields(input: NormalizeAssistantStepInput): NormalizedAssistantStepFields {
  const service = resolveCanonicalService(input);
  const event = resolveCanonicalEvent({ ...input, service });
  const config = normalizeStepConfig({ ...input, service, event, rawEvent: input.event });
  return {
    ...(service ? { service } : {}),
    ...(event ? { event } : {}),
    ...(config ? { config } : {}),
  };
}

function resolveCanonicalService(input: NormalizeAssistantStepInput): string | undefined {
  if (input.type === "approval") return APPROVAL_SERVICE;
  if (input.type === "delay") return DELAY_SERVICE;
  if (isNotificationAction(input)) return NOTIFICATION_SERVICE;
  return input.service;
}

function isNotificationAction(input: NormalizeAssistantStepInput): boolean {
  if (input.type !== "action") return false;
  if (input.service === NOTIFICATION_SERVICE || input.service === "slack") return true;
  const eventLower = (input.event ?? "").trim().toLowerCase();
  if (eventLower.includes("notification") || eventLower.includes("notify") || eventLower === "slack") {
    return true;
  }
  const actionType = typeof input.config?.actionType === "string" ? input.config.actionType.trim().toLowerCase() : "";
  return actionType === "notify";
}

function resolveCanonicalEvent(input: NormalizeAssistantStepInput & { service?: string }): string | undefined {
  if (input.type === "approval") {
    const fromEvent = canonicalizeEventLabel(input.event);
    return fromEvent === APPROVAL_EVENT || !fromEvent ? APPROVAL_EVENT : fromEvent;
  }

  if (input.type === "delay") {
    return canonicalizeEventLabel(input.event) ?? DELAY_EVENT;
  }

  if (isNotificationAction(input)) {
    return NOTIFICATION_EVENT;
  }

  let event = canonicalizeEventLabel(input.event);
  if (!event && input.type === "action") {
    const actionType = typeof input.config?.actionType === "string" ? input.config.actionType.trim().toLowerCase() : "";
    if (actionType === "pause") event = "Pause Ad";
    else if (actionType === "enable") event = "Enable Ad";
    else if (actionType === "duplicate") event = "Duplicate Ad";
    else if (actionType === "notify") event = "Send Notification";
  }

  if (input.type === "action" && input.service && event === "Launch Ad") {
    const crossChannelEvent = CROSS_CHANNEL_LAUNCH_BY_SERVICE[input.service];
    if (crossChannelEvent) return crossChannelEvent;
  }

  return event;
}

function canonicalizeEventLabel(event: string | undefined): string | undefined {
  if (!event) return undefined;
  const trimmed = event.trim();
  if (!trimmed) return undefined;
  const alias = EVENT_ALIASES[trimmed.toLowerCase()];
  return alias ?? trimmed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function coerceTargetIdsPill(value: unknown): unknown {
  if (typeof value === "string") return value;
  if (isRecord(value) && typeof value.item === "string") return value.item;
  return value;
}

function normalizeCriteriaConfig(config: Record<string, unknown>): Record<string, unknown> {
  if (!("criteria" in config)) return config;
  const criteria = normalizeAssistantCriteria(config.criteria);
  if (!criteria) {
    const { criteria: _dropped, ...rest } = config;
    return rest;
  }
  return { ...config, criteria };
}

function normalizeStepConfig(
  input: NormalizeAssistantStepInput & { service?: string; event?: string; rawEvent?: string },
): Record<string, unknown> | undefined {
  const needsNotificationDefaults = isNotificationAction(input);
  if (!input.config && !needsPauseTargetIds(input) && input.type !== "approval" && !needsNotificationDefaults) {
    return input.config;
  }

  const next: Record<string, unknown> = normalizeCriteriaConfig({ ...(input.config || {}) });

  if ("targetIds" in next) {
    next.targetIds = coerceTargetIdsPill(next.targetIds);
  }

  if (needsPauseTargetIds({ ...input, config: next })) {
    next.targetIds = DEFAULT_PAUSE_TARGET_IDS;
  }

  if (input.type === "approval") {
    if (typeof next.approvalMessage === "string" && !next.customMessage) {
      next.customMessage = next.approvalMessage;
    }
    delete next.approvalMessage;
    delete next.targetIds;
    if (!next.notificationMethod) next.notificationMethod = "email";
    if (next.expirationDays === undefined) next.expirationDays = DEFAULT_APPROVAL_EXPIRATION_DAYS;
  }

  if (needsNotificationDefaults) {
    next.notificationMethod = resolveNotificationMethod(next, input);
    if (typeof next.message === "string" && !next.customMessage) {
      next.customMessage = next.message;
    }
    delete next.message;
    delete next.notifyVia;
    delete next.channel;
  }

  if (
    input.type === "action" &&
    input.service &&
    input.event &&
    CROSS_CHANNEL_LAUNCH_BY_SERVICE[input.service] === input.event
  ) {
    delete next.crossLaunchFromMeta;
    delete next.adSource;
    delete next.targetIds;
  }

  // Models sometimes put position inside config; the builder reads top-level position only.
  delete next.position;

  // actionType is create_performance_threshold vocabulary, not a canvas node field.
  delete next.actionType;

  return next;
}

function needsPauseTargetIds(input: NormalizeAssistantStepInput & { event?: string }): boolean {
  if (input.type !== "action") return false;
  if (input.event !== "Pause Ad" && input.event !== "Pause Ad Set" && input.event !== "Pause Campaign") {
    return false;
  }
  const existing = input.config?.targetIds;
  return existing === undefined || existing === null || existing === "";
}

function resolveNotificationMethod(
  config: Record<string, unknown>,
  input: NormalizeAssistantStepInput & { rawEvent?: string },
): string {
  const fromConfig = coerceNotificationMethod(
    config.notificationMethod ?? config.notifyVia ?? config.channel ?? config.method,
  );
  if (fromConfig) return fromConfig;

  const eventLower = (input.rawEvent ?? input.event ?? "").trim().toLowerCase();
  if (eventLower.includes("slack") || input.service === "slack") return "slack";
  if (eventLower.includes("both")) return "both";
  if (eventLower.includes("email")) return "email";

  return "email";
}

function coerceNotificationMethod(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (NOTIFICATION_METHODS.has(normalized)) return normalized;
  if (normalized.includes("slack") && normalized.includes("email")) return "both";
  if (normalized.includes("slack")) return "slack";
  if (normalized.includes("email")) return "email";
  return undefined;
}
