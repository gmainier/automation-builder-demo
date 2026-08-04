/**
 * In-memory stand-in for the automation-rules table.
 *
 * The ported `automation-context.tsx` and `automations-table.tsx` talk to
 * `/api/automation-rules` exactly as they do in the app. Rather than edit those
 * files to fake their data, this repo serves the same endpoints from memory, so
 * loading, saving, duplicating, toggling and deleting all work end to end.
 *
 * State lives in a module-level array, which means it resets whenever the dev
 * server reloads. That is the intended trade-off: no database, no migrations,
 * nothing to configure before `pnpm dev` works.
 */

export interface StoredFlowNode {
  id: string;
  type: string;
  service?: string;
  event?: string;
  config?: Record<string, unknown>;
  position?: number;
}

export interface StoredRule {
  id: number;
  name: string;
  status: "active" | "paused" | "draft";
  frequency: string | null;
  accountId: string | null;
  accountName: string | null;
  company: string | null;
  workspaceId: string | null;
  createdAt: string;
  updatedAt: string;
  lastRun: string | null;
  flow: {
    nodes: StoredFlowNode[];
    notificationSettings?: Record<string, unknown> | null;
  };
}

const DEMO_ACCOUNT_ID = "act_100200300";
const DEMO_ACCOUNT_NAME = "Northwind Coffee — UK";

/**
 * Seed rules.
 *
 * Three is deliberate: one simple threshold rule that is the natural thing to
 * open first, one scaling rule so the list is not monotonous, and one paused
 * draft so the table's status states are all visible without editing anything.
 */
const SEED_RULES: StoredRule[] = [
  {
    id: 101,
    name: "Pause underperforming ads",
    status: "active",
    frequency: "daily",
    accountId: DEMO_ACCOUNT_ID,
    accountName: DEMO_ACCOUNT_NAME,
    company: "northwind",
    workspaceId: "ws_demo",
    createdAt: "2026-06-02T09:12:00.000Z",
    updatedAt: "2026-07-28T16:04:00.000Z",
    lastRun: "2026-08-03T09:00:00.000Z",
    flow: {
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          service: "meta-ads",
          event: "Performance Threshold",
          position: 0,
          config: {
            checkFrequency: "daily",
            checkTime: "09:00",
            conditions: [{ metric: "roas", operator: "less_than", value: 1.5 }],
            minimumSpend: 50,
            lookbackWindow: 7,
            campaignNameFilterType: "all",
          },
        },
        {
          id: "action-1",
          type: "action",
          service: "meta-ads",
          event: "Pause Ad",
          position: 1,
          config: {},
        },
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
    id: 102,
    name: "Scale winning ad sets",
    status: "active",
    frequency: "daily",
    accountId: DEMO_ACCOUNT_ID,
    accountName: DEMO_ACCOUNT_NAME,
    company: "northwind",
    workspaceId: "ws_demo",
    createdAt: "2026-06-14T11:40:00.000Z",
    updatedAt: "2026-07-30T10:22:00.000Z",
    lastRun: "2026-08-03T09:00:00.000Z",
    flow: {
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          service: "meta-ads",
          event: "Performance Threshold",
          position: 0,
          config: {
            checkFrequency: "daily",
            checkTime: "10:00",
            conditions: [{ metric: "roas", operator: "greater_than", value: 3 }],
            minimumSpend: 100,
            lookbackWindow: 7,
            campaignNameFilterType: "all",
          },
        },
        {
          id: "action-1",
          type: "action",
          service: "meta-ads",
          event: "Increase Budget",
          position: 1,
          config: { budgetChangeType: "percentage", budgetChangeValue: 20 },
        },
      ],
    },
  },
  {
    id: 103,
    name: "Weekly spend digest",
    status: "paused",
    frequency: "weekly",
    accountId: DEMO_ACCOUNT_ID,
    accountName: DEMO_ACCOUNT_NAME,
    company: "northwind",
    workspaceId: "ws_demo",
    createdAt: "2026-07-01T08:05:00.000Z",
    updatedAt: "2026-07-19T14:47:00.000Z",
    lastRun: null,
    flow: {
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          service: "scheduled",
          event: "Scheduled",
          position: 0,
          config: { checkFrequency: "weekly", checkTime: "08:00", checkWeekday: "monday" },
        },
        {
          id: "action-1",
          type: "action",
          service: "notification",
          event: "Send Notification",
          position: 1,
          config: { notificationMethod: "email", customMessage: "Weekly spend summary" },
        },
      ],
    },
  },
];

let rules: StoredRule[] = SEED_RULES.map((rule) => structuredClone(rule));
let nextId = 200;

export function listRules(): StoredRule[] {
  return rules.map((rule) => structuredClone(rule));
}

export function getRule(id: number): StoredRule | null {
  const found = rules.find((rule) => rule.id === id);
  return found ? structuredClone(found) : null;
}

/** Creates a rule, or replaces one when `id` matches an existing row. */
export function upsertRule(input: Partial<StoredRule> & { id?: number }, timestamp: string): StoredRule {
  const existingIndex = input.id === undefined ? -1 : rules.findIndex((rule) => rule.id === input.id);
  const base = existingIndex >= 0 ? rules[existingIndex] : null;

  const saved: StoredRule = {
    id: base?.id ?? nextId++,
    name: input.name ?? base?.name ?? "Untitled automation",
    status: input.status ?? base?.status ?? "draft",
    frequency: input.frequency ?? base?.frequency ?? null,
    accountId: input.accountId ?? base?.accountId ?? DEMO_ACCOUNT_ID,
    accountName: input.accountName ?? base?.accountName ?? DEMO_ACCOUNT_NAME,
    company: input.company ?? base?.company ?? "northwind",
    workspaceId: input.workspaceId ?? base?.workspaceId ?? "ws_demo",
    createdAt: base?.createdAt ?? timestamp,
    updatedAt: timestamp,
    lastRun: base?.lastRun ?? null,
    flow: input.flow ?? base?.flow ?? { nodes: [] },
  };

  if (existingIndex >= 0) rules[existingIndex] = saved;
  else rules.push(saved);

  return structuredClone(saved);
}

export function deleteRule(id: number): boolean {
  const before = rules.length;
  rules = rules.filter((rule) => rule.id !== id);
  return rules.length < before;
}

export function countByStatus(status: StoredRule["status"]): number {
  return rules.filter((rule) => rule.status === status).length;
}
