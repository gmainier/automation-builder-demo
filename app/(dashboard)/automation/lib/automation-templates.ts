import type { AutomationFlow } from "../contexts/automation-context";
import { COMMENT_AUTOMATION_TEMPLATES, COMMENT_TEMPLATE_CATEGORY } from "./comment-automation-templates";

/**
 * Starter automations offered in the Templates tab.
 *
 * The product ships dozens of these, and the specific strategies it encodes are
 * part of what customers pay for. This repo carries a small generic set instead:
 * the common shapes (pause a loser, scale a winner, alert on a swing, launch from
 * an upload), each built only from steps that exist in `automation-registry.ts`.
 *
 * Every template is a complete `AutomationFlow`, so picking one opens a fully
 * configured canvas rather than a stub.
 */

export type TemplateCategory = "scaling" | "optimization" | "reporting" | typeof COMMENT_TEMPLATE_CATEGORY;

export const TEMPLATE_CATEGORIES: { value: TemplateCategory; label: string }[] = [
  { value: "scaling", label: "Scaling" },
  { value: "optimization", label: "Optimization" },
  { value: "reporting", label: "Reporting" },
  { value: COMMENT_TEMPLATE_CATEGORY, label: "Comments" },
];

export interface AutomationTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  emoji: string;
  iconService?: string;
  services: string[];
  displaySteps?: Array<{ service: string; label: string }>;
  featured?: boolean;
  flow: AutomationFlow;
}

/** ROAS floor below which an ad is treated as a loser. */
const LOSER_ROAS = 1;
/** ROAS a winner must clear before it is scaled. */
const WINNER_ROAS = 3;
/** Spend an entity must reach before any rule judges it. */
const MIN_SPEND = 50;
/** Days of performance every template evaluates over. */
const LOOKBACK_DAYS = 7;
/** Budget increase applied when scaling a winner. */
const BUDGET_INCREASE_PERCENT = 20;
/** Day-over-day swing that counts as significant. */
const SIGNIFICANT_CHANGE_PERCENT = 20;

export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    id: "template-pause-losers",
    name: "Pause Underperformers",
    description:
      "Pause any ad whose ROAS falls below your floor, once it has spent enough for the number to mean something. Posts a summary so you know what changed.",
    category: "optimization",
    emoji: "🛑",
    services: ["meta-ads", "notification"],
    featured: true,
    flow: {
      id: "template-pause-losers",
      name: "Pause Underperformers",
      isActive: false,
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          service: "meta-ads",
          event: "Performance Threshold",
          position: 0,
          config: {
            level: "ad",
            metric: "roas",
            comparison: "less_than",
            threshold: LOSER_ROAS,
            minimumSpend: MIN_SPEND,
            lookbackWindow: LOOKBACK_DAYS,
            checkFrequency: "daily",
            checkTime: "09:00",
          },
        },
        { id: "action-1", type: "action", service: "meta-ads", event: "Pause Ad", position: 1, config: {} },
        {
          id: "action-2",
          type: "action",
          service: "notification",
          event: "Send Notification",
          position: 2,
          config: {
            notificationMethod: "slack",
            customMessage: "Paused {{trigger.adName}} — ROAS {{trigger.roas}} over the last 7 days.",
          },
        },
      ],
    },
  },
  {
    id: "template-scale-winners",
    name: "Scale Winners",
    description:
      "Raise the budget on ad sets clearing your ROAS target, so spend follows what is already working without you watching it.",
    category: "scaling",
    emoji: "🚀",
    services: ["meta-ads"],
    flow: {
      id: "template-scale-winners",
      name: "Scale Winners",
      isActive: false,
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          service: "meta-ads",
          event: "Performance Threshold",
          position: 0,
          config: {
            level: "adset",
            metric: "roas",
            comparison: "greater_than",
            threshold: WINNER_ROAS,
            minimumSpend: MIN_SPEND,
            lookbackWindow: LOOKBACK_DAYS,
            checkFrequency: "daily",
            checkTime: "10:00",
          },
        },
        {
          id: "action-1",
          type: "action",
          service: "meta-ads",
          event: "Increase Budget",
          position: 1,
          config: { budgetChangeType: "percentage", budgetChangeValue: BUDGET_INCREASE_PERCENT },
        },
      ],
    },
  },
  {
    id: "template-duplicate-winners",
    name: "Duplicate Top Ads",
    description:
      "Copy your best ads into another ad set, created paused so you can review before anything goes live.",
    category: "scaling",
    emoji: "📈",
    services: ["meta-ads"],
    flow: {
      id: "template-duplicate-winners",
      name: "Duplicate Top Ads",
      isActive: false,
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          service: "meta-ads",
          event: "Performance Threshold",
          position: 0,
          config: {
            level: "ad",
            metric: "roas",
            comparison: "greater_than",
            threshold: WINNER_ROAS,
            minimumSpend: MIN_SPEND,
            lookbackWindow: LOOKBACK_DAYS,
            checkFrequency: "weekly",
            checkTime: "09:00",
          },
        },
        {
          id: "action-1",
          type: "action",
          service: "meta-ads",
          event: "Duplicate Ad",
          position: 1,
          config: { duplicateStatus: "PAUSED" },
        },
      ],
    },
  },
  {
    id: "template-spend-alert",
    name: "Spend Swing Alert",
    description:
      "Get told when spend moves more than a set percentage day over day, so a runaway or a stall does not go unnoticed.",
    category: "reporting",
    emoji: "📊",
    services: ["meta-ads", "notification"],
    flow: {
      id: "template-spend-alert",
      name: "Spend Swing Alert",
      isActive: false,
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          service: "meta-ads",
          event: "Performance Monitoring",
          position: 0,
          config: {
            monitoringLevel: "campaign",
            monitoringMetric: "spend",
            monitoringDirection: "increases",
            monitoringPercentage: SIGNIFICANT_CHANGE_PERCENT,
            monitoringComparisonWindow: "day",
            checkFrequency: "daily",
            checkTime: "08:00",
          },
        },
        {
          id: "action-1",
          type: "action",
          service: "notification",
          event: "Send Notification",
          position: 1,
          config: {
            notificationMethod: "both",
            customMessage:
              "{{trigger.entityName}}: {{trigger.previousValue}} → {{trigger.currentValue}} ({{trigger.actualChange}}% change)",
          },
        },
      ],
    },
  },
  {
    id: "template-launch-from-uploads",
    name: "Launch From Uploads",
    description:
      "Turn new creative into ads automatically. Watches a board and launches each upload into the ad set you pick, paused for review.",
    category: "scaling",
    emoji: "🎬",
    services: ["media-library", "meta-ads"],
    flow: {
      id: "template-launch-from-uploads",
      name: "Launch From Uploads",
      isActive: false,
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          service: "media-library",
          event: "Media Uploaded to Board",
          position: 0,
          config: { groupingEnabled: false },
        },
        {
          id: "action-1",
          type: "action",
          service: "meta-ads",
          event: "Launch Ad",
          position: 1,
          config: { targetAdSetId: "", adNameTemplate: "{{trigger.fileName}}" },
        },
      ],
    },
  },
  {
    id: "template-weekly-digest",
    name: "Weekly Digest",
    description: "A standing weekly summary emailed to you, with no condition attached. The simplest possible flow.",
    category: "reporting",
    emoji: "🗓️",
    services: ["scheduled", "notification"],
    flow: {
      id: "template-weekly-digest",
      name: "Weekly Digest",
      isActive: false,
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          service: "scheduled",
          event: "Scheduled",
          position: 0,
          config: { checkFrequency: "weekly", checkTime: "08:00" },
        },
        {
          id: "action-1",
          type: "action",
          service: "notification",
          event: "Send Notification",
          position: 1,
          config: { notificationMethod: "email", customMessage: "Weekly account summary" },
        },
      ],
    },
  },
  ...COMMENT_AUTOMATION_TEMPLATES,
];

/** Flows only, for callers that do not need the presentation metadata. */
export const automationTemplates: AutomationFlow[] = AUTOMATION_TEMPLATES.map((template) => template.flow);
