export function parseAutomationRuleId(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function parseCommentAutomationId(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^comment:(\d+)$/.exec(value);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function buildCommentAutomationId(ruleId: number): string {
  return `comment:${ruleId}`;
}

export function isAutomationEditorIdentityReady(options: {
  flowId: number | string;
  selectedAutomationId: string | null;
  isLoadingFlow: boolean;
}): boolean {
  if (options.isLoadingFlow) return false;
  if (!options.selectedAutomationId) return true;

  const selectedCommentRuleId = parseCommentAutomationId(options.selectedAutomationId);
  if (selectedCommentRuleId !== null) {
    return (
      options.flowId === buildCommentAutomationId(selectedCommentRuleId) || options.flowId === selectedCommentRuleId
    );
  }

  const selectedRuleId = parseAutomationRuleId(options.selectedAutomationId);
  if (selectedRuleId !== null) {
    return typeof options.flowId === "number" && options.flowId === selectedRuleId;
  }

  if (options.selectedAutomationId === "new") {
    return typeof options.flowId === "string" && options.flowId.startsWith("flow-");
  }

  return String(options.flowId) === options.selectedAutomationId;
}

export function resolveExistingAutomationRuleId(options: {
  flowId: number | string;
  isIdentityReady: boolean;
}): number | null {
  if (!options.isIdentityReady) return null;
  if (typeof options.flowId === "number") return options.flowId;
  return parseCommentAutomationId(String(options.flowId));
}

export function getAutomationNodeEditorKey(flowId: number | string, nodeId: string): string {
  return `${typeof flowId}:${String(flowId)}:${nodeId}`;
}
