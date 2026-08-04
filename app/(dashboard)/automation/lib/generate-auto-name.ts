import type { AutomationNode } from "../contexts/automation-context";

/**
 * Generates an automatic name from trigger and action nodes.
 * Format: "[Trigger event] -> [Action event]"
 * Falls back to service labels if events aren't set.
 */
export function generateAutoName(nodes: AutomationNode[]): string {
  const triggerNode = nodes.find((n) => n.type === "trigger");
  const actionNode = nodes.find((n) => n.type === "action");

  const triggerLabel = triggerNode?.event || triggerNode?.service || null;
  const actionLabel = actionNode?.event || actionNode?.service || null;

  if (triggerLabel && actionLabel) {
    return `${triggerLabel} -> ${actionLabel}`;
  }
  if (triggerLabel) {
    return triggerLabel;
  }
  if (actionLabel) {
    return actionLabel;
  }
  return "Automation";
}

/**
 * Returns true if the name is a default/empty name that should be auto-replaced.
 */
export function isDefaultName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed === "" || trimmed === "Untitled Zap";
}
