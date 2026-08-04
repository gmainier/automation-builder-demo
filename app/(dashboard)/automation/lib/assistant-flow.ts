import { normalizeAssistantCriteria } from "@/lib/automation/criteria-groups";
import type { AutomationFlow, AutomationNode, NodeType } from "../contexts/automation-context";

/**
 * Translates a proposed `create_automation` MCP tool call into an
 * `AutomationFlow` the builder canvas can render. The assistant streams a gated
 * `create_automation` tool call whose arguments carry the full node flow; the
 * builder intercepts it and applies the flow instead of executing the write.
 */

export const ASSISTANT_FLOW_TOOL_NAME = "create_automation";

const NODE_TYPES: readonly NodeType[] = ["trigger", "action", "filter", "delay", "approval"];

interface AssistantFlowContext {
  readonly selectedAccountId?: string;
  readonly selectedAccountName?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNodeType(value: unknown): value is NodeType {
  return typeof value === "string" && (NODE_TYPES as readonly string[]).includes(value);
}

function normalizeNodeConfig(rawConfig: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!rawConfig) return undefined;
  if (!("criteria" in rawConfig)) return rawConfig;
  const criteria = normalizeAssistantCriteria(rawConfig.criteria);
  if (!criteria) {
    const { criteria: _dropped, ...rest } = rawConfig;
    return rest;
  }
  return { ...rawConfig, criteria };
}

function normalizeNode(raw: unknown, index: number): AutomationNode | null {
  if (!isRecord(raw) || !isNodeType(raw.type)) return null;
  const position = typeof raw.position === "number" ? raw.position : index;
  const rawConfig = isRecord(raw.config) ? raw.config : undefined;
  return {
    id: typeof raw.id === "string" && raw.id.length > 0 ? raw.id : `node-${index}`,
    type: raw.type,
    service: typeof raw.service === "string" ? raw.service : undefined,
    event: typeof raw.event === "string" ? raw.event : undefined,
    config: normalizeNodeConfig(rawConfig),
    position,
  };
}

function normalizeNodes(rawNodes: unknown): AutomationNode[] {
  if (!Array.isArray(rawNodes)) return [];
  return rawNodes
    .map((node, index) => normalizeNode(node, index))
    .filter((node): node is AutomationNode => node !== null)
    .sort((a, b) => a.position - b.position)
    .map((node, index) => ({ ...node, position: index }));
}

/**
 * Builds a canvas-ready flow from `create_automation` tool-call arguments, or
 * returns null when the args do not describe a usable flow (wrong tool, missing
 * nodes). The returned flow is inactive — activation stays a user action.
 */
export function buildAssistantFlowFromToolArgs(
  toolName: string,
  args: Record<string, unknown>,
  context: AssistantFlowContext = {},
): AutomationFlow | null {
  if (toolName !== ASSISTANT_FLOW_TOOL_NAME) return null;

  const flowArg = isRecord(args.flow) ? args.flow : undefined;
  const nodes = normalizeNodes(flowArg?.nodes);
  if (nodes.length === 0) return null;

  const name = typeof args.name === "string" && args.name.trim().length > 0 ? args.name.trim() : "AI automation";
  const accountId =
    context.selectedAccountId ?? (typeof args.accountId === "string" ? args.accountId : undefined) ?? undefined;

  return {
    id: `flow-assistant-${nodes.length}`,
    name,
    nodes,
    isActive: false,
    ...(typeof args.frequency === "string" ? { frequency: args.frequency } : {}),
    selectedAccountId: accountId,
    selectedAccountName: context.selectedAccountName,
  };
}
