export const AUTOMATION_EXPORT_KIND = "app.automation.export";
export const AUTOMATION_EXPORT_VERSION = 1;
export const IMPORTED_AUTOMATION_STATUS = "paused";
const DUPLICATED_AUTOMATION_NAME_SUFFIX = " (Copy)";

type JsonObject = Record<string, unknown>;

export type AutomationExportRule = {
  readonly name: string;
  readonly flow: JsonObject;
  readonly actionType: string;
  readonly targetId: string | null;
  readonly accountId: string;
  readonly newName: string | null;
  readonly frequency: string;
  readonly scheduledDate: string | null;
  readonly scheduledTime: string | null;
  readonly dayOfWeek: string | null;
  readonly dayOfMonth: string | null;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly sourceRuleId?: number;
};

export type AutomationExportBundle = {
  readonly kind: typeof AUTOMATION_EXPORT_KIND;
  readonly version: typeof AUTOMATION_EXPORT_VERSION;
  readonly exportedAt: string;
  readonly automations: ReadonlyArray<AutomationExportRule>;
};

export type AutomationImportPayload = AutomationExportRule & {
  readonly status: typeof IMPORTED_AUTOMATION_STATUS;
};

export function buildAutomationExportBundle(options: {
  readonly rules: ReadonlyArray<unknown>;
  readonly exportedAt: string;
}): AutomationExportBundle {
  return {
    kind: AUTOMATION_EXPORT_KIND,
    version: AUTOMATION_EXPORT_VERSION,
    exportedAt: options.exportedAt,
    automations: options.rules.map(normalizeExportRule),
  };
}

export function parseAutomationImportText(jsonText: string): ReadonlyArray<AutomationExportRule> {
  const parsed: unknown = JSON.parse(jsonText);

  if (isExportBundle(parsed)) {
    return parsed.automations.map(normalizeExportRule);
  }

  if (Array.isArray(parsed)) {
    return parsed.map(normalizeExportRule);
  }

  if (isRecord(parsed) && Array.isArray(parsed.rules)) {
    return parsed.rules.map(normalizeExportRule);
  }

  if (isRecord(parsed) && Array.isArray(parsed.nodes)) {
    return [normalizeSingleFlow(parsed)];
  }

  throw new Error("Invalid automation import format.");
}

export function createAutomationImportPayload(rule: AutomationExportRule): AutomationImportPayload {
  return {
    ...rule,
    name: getImportedAutomationName(rule.name),
    status: IMPORTED_AUTOMATION_STATUS,
  };
}

/**
 * Builds a create-rule payload for duplicating an existing automation without enabling it.
 */
export function createAutomationDuplicatePayload(rule: unknown): AutomationImportPayload {
  const normalizedRule = normalizeExportRule(rule);

  return {
    ...normalizedRule,
    name: getDuplicatedAutomationName(normalizedRule.name),
    status: IMPORTED_AUTOMATION_STATUS,
  };
}

function normalizeExportRule(rule: unknown): AutomationExportRule {
  if (!isRecord(rule)) {
    throw new Error("Automation entry must be an object.");
  }

  const flow = getFlowObject(rule.flow);
  const name = getNonEmptyString(rule.name, "Untitled automation");

  return {
    name,
    flow,
    actionType: getNonEmptyString(rule.actionType, "unknown"),
    targetId: getNullableString(rule.targetId),
    accountId: getNonEmptyString(rule.accountId, "unknown"),
    newName: getNullableString(rule.newName),
    frequency: getNonEmptyString(rule.frequency, "one-time"),
    scheduledDate: getNullableString(rule.scheduledDate),
    scheduledTime: getNullableString(rule.scheduledTime),
    dayOfWeek: getNullableString(rule.dayOfWeek),
    dayOfMonth: getNullableString(rule.dayOfMonth),
    startDate: getNullableString(rule.startDate),
    endDate: getNullableString(rule.endDate),
    ...(typeof rule.id === "number" ? { sourceRuleId: rule.id } : {}),
    ...(typeof rule.sourceRuleId === "number" ? { sourceRuleId: rule.sourceRuleId } : {}),
  };
}

function normalizeSingleFlow(flow: JsonObject): AutomationExportRule {
  return normalizeExportRule({
    name: flow.name,
    flow: { nodes: flow.nodes, notificationSettings: flow.notificationSettings },
    actionType: "unknown",
    accountId: "unknown",
    frequency: "one-time",
  });
}

function getFlowObject(value: unknown): JsonObject {
  if (!isRecord(value)) {
    throw new Error("Automation entry is missing a valid flow object.");
  }

  const nodes = value.nodes;
  if (!Array.isArray(nodes)) {
    throw new Error("Automation flow is missing nodes.");
  }

  return value;
}

function getImportedAutomationName(name: string): string {
  return name.endsWith(" (Imported)") ? name : `${name} (Imported)`;
}

function getDuplicatedAutomationName(name: string): string {
  return name.endsWith(DUPLICATED_AUTOMATION_NAME_SUFFIX) ? name : `${name}${DUPLICATED_AUTOMATION_NAME_SUFFIX}`;
}

function getNonEmptyString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function getNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function isExportBundle(value: unknown): value is AutomationExportBundle {
  return (
    isRecord(value) &&
    value.kind === AUTOMATION_EXPORT_KIND &&
    value.version === AUTOMATION_EXPORT_VERSION &&
    Array.isArray(value.automations)
  );
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
