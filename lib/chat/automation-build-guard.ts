import { isAssistantContent } from "./wire";
import type { ChatMessageView, McpToolMeta } from "./types";

/** Matches `buildSuggestionPickMessage` user turns. */
export const BUILD_SUGGESTION_PICK_PATTERN = /^Build suggestion #\d+:/;

/** Prefix for agent-loop nudge messages (hidden from automation UI). */
export const AUTOMATION_BUILD_NUDGE_PREFIX = "[Automation build retry]";

/** Automatic nudges injected when the model replies with text only. */
export const MAX_AUTOMATION_BUILD_NUDGES = 2;

const AUTOMATION_CANVAS_BUILDER_TOOLS: ReadonlySet<string> = new Set([
  "automation_start_flow",
  "automation_add_step",
  "automation_update_step",
  "automation_remove_step",
  "create_automation",
]);
const AUTOMATION_ADD_STEP_TOOL_NAME = "automation_add_step";

const BUILD_COMPLETE_SIGNALS: readonly RegExp[] = [
  /\bon the canvas\b/i,
  /\bnodes are on\b/i,
  /\bnext steps for you\b/i,
  /\bready to review\b/i,
  /\bautomation is ready\b/i,
  /\bclick .*(?:save|preview|turn it on)\b/i,
  /\bpreview result\b/i,
  /\bflow built\b/i,
];

const BLOCKING_USER_INPUT_PATTERNS: readonly RegExp[] = [
  /drop the .+ here/i,
  /need (?:an?|your) .*(?:address|email)/i,
  /do you want (?:it|them|this|me to send)/i,
  /which (?:one|email)/i,
  /reply (?:with|in|below|here)/i,
  /send (?:it|them) to/i,
];

export function isBuildSuggestionPickMessage(text: string): boolean {
  return BUILD_SUGGESTION_PICK_PATTERN.test(text.trim());
}

export function isAutomationBuildNudgeMessage(text: string): boolean {
  return text.trimStart().startsWith(AUTOMATION_BUILD_NUDGE_PREFIX);
}

export function isAutomationAssistantSession(systemPrompt: string): boolean {
  return systemPrompt.includes("automation_start_flow");
}

export function isAutomationCanvasBuilderTool(name: string): boolean {
  return AUTOMATION_CANVAS_BUILDER_TOOLS.has(name);
}

export function hasAutomationCanvasBuilderTools(toolMetas: ReadonlyMap<string, McpToolMeta>): boolean {
  return [...toolMetas.keys()].some((name) => isAutomationCanvasBuilderTool(name));
}

/** True when the assistant paused for missing user info (not a retry candidate). */
export function detectAutomationBuildAwaitingUserInput(assistantText: string): boolean {
  const trimmed = assistantText.trim();
  if (!trimmed) return false;
  if (BUILD_COMPLETE_SIGNALS.some((pattern) => pattern.test(trimmed))) return false;
  return BLOCKING_USER_INPUT_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function findLatestBuildSuggestionPickIndex(messages: readonly ChatMessageView[]): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === "user" && isBuildSuggestionPickMessage(message.content.text)) {
      return index;
    }
  }
  return -1;
}

export function countAutomationBuildNudgesSincePick(messages: readonly ChatMessageView[], pickIndex: number): number {
  let count = 0;
  for (let index = pickIndex + 1; index < messages.length; index += 1) {
    const message = messages[index];
    if (message.role === "user" && isAutomationBuildNudgeMessage(message.content.text)) {
      count += 1;
    }
  }
  return count;
}

export function hasAutomationStepCallsSincePick(messages: readonly ChatMessageView[], pickIndex: number): boolean {
  for (let index = pickIndex + 1; index < messages.length; index += 1) {
    const message = messages[index];
    if (message.role !== "assistant" || !isAssistantContent(message.content)) continue;
    if (message.content.toolCalls.some((call) => call.name === AUTOMATION_ADD_STEP_TOOL_NAME)) {
      return true;
    }
  }
  return false;
}

export interface ShouldRetryAutomationBuildOptions {
  readonly systemPrompt: string;
  readonly toolMetas: ReadonlyMap<string, McpToolMeta>;
  readonly messages: readonly ChatMessageView[];
  readonly assistantText: string;
}

/**
 * When a ranked suggestion build finishes with prose only, inject a nudge and
 * continue the agent loop so the model gets another turn to call canvas tools.
 */
export function shouldRetryAutomationBuildWithoutCanvasTools(options: ShouldRetryAutomationBuildOptions): boolean {
  if (!isAutomationAssistantSession(options.systemPrompt)) return false;
  if (!hasAutomationCanvasBuilderTools(options.toolMetas)) return false;
  if (detectAutomationBuildAwaitingUserInput(options.assistantText)) return false;

  const pickIndex = findLatestBuildSuggestionPickIndex(options.messages);
  if (pickIndex < 0) return false;
  if (hasAutomationStepCallsSincePick(options.messages, pickIndex)) return false;

  const nudgeCount = countAutomationBuildNudgesSincePick(options.messages, pickIndex);
  return nudgeCount < MAX_AUTOMATION_BUILD_NUDGES;
}

export function buildAutomationBuildNudgeMessage(attempt: number): string {
  return (
    `${AUTOMATION_BUILD_NUDGE_PREFIX} Attempt ${attempt}/${MAX_AUTOMATION_BUILD_NUDGES}: ` +
    "Your last reply did not add any nodes to the canvas. " +
    "If the flow has not started, call automation_start_flow once with the selected accountId. " +
    "Then call automation_add_step for every trigger and action node. " +
    "Do not repeat account analysis — build on the canvas now."
  );
}
