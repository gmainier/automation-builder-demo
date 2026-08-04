/**
 * Bidirectional mapping between /automation flow nodes (service: "comments")
 * and CommentsServer comment-automation rules.
 */

import type {
  AutomationActionConfig,
  AutomationConditions,
  CommentPlatform,
  CreateRuleParams,
  UpdateRuleParams,
} from "@/app/(dashboard)/comments/lib/api/automation";
import { inferToneValue } from "@/app/(dashboard)/comments/_features/automation/utils/tone-condition";

export const COMMENTS_SERVICE = "comments";

export const COMMENT_TRIGGER_EVENTS = {
  realtime: "New Comment",
  scheduled: "Scheduled",
  manual: "Manual Run",
} as const;

export const COMMENT_ACTION_EVENTS = {
  hide: "Hide Comment",
  delete: "Delete Comment",
  reply: "Reply to Comment",
} as const;

export type CommentTriggerType = keyof typeof COMMENT_TRIGGER_EVENTS;
export type CommentActionType = keyof typeof COMMENT_ACTION_EVENTS;

export interface CommentFlowNode {
  readonly id: string;
  readonly type: "trigger" | "action" | "filter" | "delay" | "approval";
  readonly service?: string;
  readonly event?: string;
  readonly config?: Record<string, unknown>;
  readonly position: number;
}

export interface CommentAutomationRuleSnapshot {
  readonly id: number;
  readonly name: string;
  readonly status?: string;
  readonly platform?: CommentPlatform;
  readonly triggerType: CommentTriggerType | string;
  readonly conditions?: AutomationConditions;
  readonly actionType: CommentActionType | string;
  readonly actionConfig?: AutomationActionConfig;
  readonly frequency?: string;
  readonly scheduledTime?: string;
  readonly adAccountId?: string | null;
  readonly pageId?: string | null;
}

export interface CommentFlowSavePayload {
  readonly name: string;
  readonly platform: CommentPlatform;
  readonly triggerType: CommentTriggerType;
  readonly conditions: AutomationConditions;
  readonly actionType: CommentActionType;
  readonly actionConfig: AutomationActionConfig;
  readonly pageIds: string[];
  readonly adAccountId?: string;
  readonly frequency?: string;
  readonly scheduledTime?: string;
}

/**
 * Result of validating a comment flow.
 *
 * `nodeId` is set whenever a single step is at fault, so the canvas can highlight
 * that exact card instead of leaving the user to match a step number against the
 * toast. It stays undefined for flow-level problems such as a missing
 * trigger, where no existing node is to blame.
 */
export type CommentFlowSaveResult =
  | { ok: true; value: CommentFlowSavePayload }
  | { ok: false; error: string; nodeId?: string };

const DEFAULT_SCHEDULE_FREQUENCY = "hourly";
const DEFAULT_SCHEDULE_TIME = "00:00";

export function isCommentAutomationFlow(nodes: ReadonlyArray<CommentFlowNode>): boolean {
  return nodes.some((node) => node.service === COMMENTS_SERVICE);
}

export function buildCommentAutomationId(ruleId: number): string {
  return `comment:${ruleId}`;
}

export function parseCommentAutomationId(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^comment:(\d+)$/.exec(value);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function isCommentTriggerType(value: string): value is CommentTriggerType {
  return value in COMMENT_TRIGGER_EVENTS;
}

function isCommentActionType(value: string): value is CommentActionType {
  return value in COMMENT_ACTION_EVENTS;
}

export function triggerEventToType(event: string | undefined): CommentTriggerType {
  if (event === COMMENT_TRIGGER_EVENTS.scheduled) return "scheduled";
  if (event === COMMENT_TRIGGER_EVENTS.manual) return "manual";
  return "realtime";
}

export function actionEventToType(event: string | undefined): CommentActionType {
  if (event === COMMENT_ACTION_EVENTS.delete) return "delete";
  if (event === COMMENT_ACTION_EVENTS.reply) return "reply";
  return "hide";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function asConditions(value: unknown): AutomationConditions {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as AutomationConditions;
}

function asActionConfig(value: unknown): AutomationActionConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as AutomationActionConfig;
}

/**
 * True for a step that genuinely belongs to another service and would be dropped
 * on save.
 *
 * A node is only "foreign" once it has an `event`. The editor seeds an empty
 * trigger node, and picking an app without picking an event leaves `service` set
 * with no `event` (rendered as e.g. "Meta · Select an event"). Such a placeholder
 * contributes nothing to the payload, so treating it as a real step blocked every
 * comment automation the user built on top of the seeded flow.
 */
function isConfiguredForeignStep(node: CommentFlowNode): boolean {
  if (node.type === "delay") return false;
  if (!node.service || node.service === COMMENTS_SERVICE) return false;
  return Boolean(node.event);
}

/** Names the offending step using the same 1-based numbering the canvas shows. */
function describeForeignStep(node: CommentFlowNode, index: number): string {
  return (
    `Step ${index + 1} ("${node.event}") is not a Comments step. ` +
    "Comment automations can only use Comments trigger and action steps for now, so remove it before saving."
  );
}

/**
 * Validates and extracts a CommentsServer create/update payload from flow nodes.
 */
export function buildCommentSavePayloadFromFlow(options: {
  readonly name: string;
  readonly nodes: ReadonlyArray<CommentFlowNode>;
  readonly selectedAccountId?: string | null;
}): CommentFlowSaveResult {
  const triggerNode = options.nodes.find((node) => node.type === "trigger" && node.service === COMMENTS_SERVICE);
  const actionNode = options.nodes.find((node) => node.type === "action" && node.service === COMMENTS_SERVICE);

  if (!triggerNode) {
    return { ok: false, error: "Add a Comments trigger before saving." };
  }
  if (!actionNode) {
    return { ok: false, error: "Add a Comments action (hide, delete, or reply) before saving." };
  }

  const foreignStepIndex = options.nodes.findIndex(isConfiguredForeignStep);
  if (foreignStepIndex !== -1) {
    const foreignStep = options.nodes[foreignStepIndex];
    return { ok: false, error: describeForeignStep(foreignStep, foreignStepIndex), nodeId: foreignStep.id };
  }

  const config = triggerNode.config ?? {};
  const pageIds = asStringArray(config.pageIds);
  if (pageIds.length === 0) {
    return {
      ok: false,
      error: "Select at least one Facebook or Instagram page on the Comments trigger.",
      nodeId: triggerNode.id,
    };
  }

  // Empty conditions are allowed: the rule matches every new comment on the
  // selected pages (same as CommentsServer evaluateConditions with {}).
  const conditions = asConditions(config.conditions);

  const actionType = actionEventToType(actionNode.event);
  const actionConfig = asActionConfig(actionNode.config?.actionConfig);
  if (actionType === "reply") {
    const useAI = actionConfig.useAI === true;
    if (useAI && !String(actionConfig.aiPrompt ?? "").trim()) {
      actionConfig.aiPrompt = "Write a helpful reply.";
    }
    if (!useAI && !String(actionConfig.replyTemplate ?? "").trim()) {
      return { ok: false, error: "Enter a reply template for the fixed reply action.", nodeId: actionNode.id };
    }
    if (actionConfig.autoSend == null) {
      actionConfig.autoSend = !useAI;
    }
  }

  const triggerType = triggerEventToType(triggerNode.event);
  const platform: CommentPlatform = config.platform === "instagram" ? "instagram" : "facebook";
  const adAccountId =
    (typeof config.adAccountId === "string" && config.adAccountId) || options.selectedAccountId || undefined;

  const payload: CommentFlowSavePayload = {
    name: options.name.trim() || "Untitled Comment Automation",
    platform,
    triggerType,
    conditions,
    actionType,
    actionConfig: actionType === "reply" ? actionConfig : {},
    pageIds,
    adAccountId,
  };

  if (triggerType === "scheduled") {
    // Widened locally: the ported payload type marks these readonly, and this repo
    // has no comment-automation backend to save them to anyway.
    const scheduled = payload as { frequency?: string; scheduledTime?: string };
    scheduled.frequency =
      typeof config.frequency === "string" && config.frequency ? config.frequency : DEFAULT_SCHEDULE_FREQUENCY;
    scheduled.scheduledTime =
      typeof config.scheduledTime === "string" && config.scheduledTime ? config.scheduledTime : DEFAULT_SCHEDULE_TIME;
  }

  return { ok: true, value: payload };
}

export function toCreateRuleParams(
  payload: CommentFlowSavePayload,
  context: { readonly userId: string; readonly company: string; readonly workspaceId?: string },
): CreateRuleParams {
  return {
    name: payload.name,
    platform: payload.platform,
    triggerType: payload.triggerType,
    conditions: payload.conditions,
    actionType: payload.actionType,
    actionConfig: payload.actionConfig,
    pageIds: payload.pageIds,
    userId: context.userId,
    company: context.company,
    workspaceId: context.workspaceId,
    adAccountId: payload.adAccountId,
    frequency: payload.frequency,
    scheduledTime: payload.scheduledTime,
  };
}

export function toUpdateRuleParams(payload: CommentFlowSavePayload): UpdateRuleParams {
  return {
    name: payload.name,
    platform: payload.platform,
    triggerType: payload.triggerType,
    conditions: payload.conditions,
    actionType: payload.actionType,
    actionConfig: payload.actionConfig,
    pageId: payload.pageIds[0],
    frequency: payload.frequency,
    scheduledTime: payload.scheduledTime,
  };
}

/**
 * Converts a CommentsServer rule into flow-builder nodes for editing in /automation.
 */
export function mapCommentRuleToFlowNodes(rule: CommentAutomationRuleSnapshot): CommentFlowNode[] {
  const triggerType = isCommentTriggerType(rule.triggerType) ? rule.triggerType : "realtime";
  const actionType = isCommentActionType(rule.actionType) ? rule.actionType : "hide";
  const pageIds = rule.pageId ? [rule.pageId] : [];

  return [
    {
      id: "node-comment-trigger",
      type: "trigger",
      service: COMMENTS_SERVICE,
      event: COMMENT_TRIGGER_EVENTS[triggerType],
      position: 0,
      config: {
        adAccountId: rule.adAccountId ?? undefined,
        pageIds,
        platform: rule.platform ?? "facebook",
        conditions: rule.conditions ?? {},
        // Preserve explicit score UI so gt 61 does not round-trip back to "positive".
        toneValue: inferToneValue(rule.conditions),
        frequency: rule.frequency,
        scheduledTime: rule.scheduledTime,
      },
    },
    {
      id: "node-comment-action",
      type: "action",
      service: COMMENTS_SERVICE,
      event: COMMENT_ACTION_EVENTS[actionType],
      position: 1,
      config: {
        actionConfig: rule.actionConfig ?? {},
      },
    },
  ];
}
