// Pure reconstruction of the OpenAI/OpenRouter wire message array from our
// persisted chat transcript. The agent loop only sends to the model when every
// tool call in the last assistant turn is resolved, so tool results are always
// complete for any assistant message that carries tool_calls.

import type {
  AssistantMessageContent,
  ChatMessageView,
  ToolCallRecord,
  ToolCallStatus,
  UserMessageContent,
  WireMessage,
  WireToolCall,
} from "./types";
import { compactAdScanToolResultForWire } from "./adscan-result-summary";

const TERMINAL_STATUSES: ReadonlySet<ToolCallStatus> = new Set(["done", "error", "discarded"]);
const DISCARDED_RESULT = "The user declined to run this tool.";
const UNRESOLVED_RESULT = "This tool call was not completed.";

// Cap each tool result sent back to the model. Large list_ads/query_reports
// payloads accumulate across a turn and overflow the model's context window,
// failing the request; the head is enough for the model to summarize.
const MAX_TOOL_RESULT_CHARS = 6000;

function capResult(text: string): string {
  if (text.length <= MAX_TOOL_RESULT_CHARS) return text;
  return `${text.slice(0, MAX_TOOL_RESULT_CHARS)}\n…[truncated ${text.length - MAX_TOOL_RESULT_CHARS} chars]`;
}

export function isAssistantContent(content: ChatMessageView["content"]): content is AssistantMessageContent {
  return "toolCalls" in content;
}

export function isResolved(call: ToolCallRecord): boolean {
  return TERMINAL_STATUSES.has(call.status);
}

/** True when every tool call in the message has been executed/declined. */
export function allResolved(calls: readonly ToolCallRecord[]): boolean {
  return calls.every(isResolved);
}

function toWireToolCall(call: ToolCallRecord): WireToolCall {
  return {
    id: call.id,
    type: "function",
    function: { name: call.name, arguments: JSON.stringify(call.args ?? {}) },
  };
}

function toolResultContent(call: ToolCallRecord): string {
  if (call.status === "discarded") return DISCARDED_RESULT;
  if (call.status === "error") return capResult(call.errorMessage ?? call.resultText ?? "Tool failed.");
  if (!isResolved(call)) return UNRESOLVED_RESULT;
  const resultText = call.resultText ?? "";
  const compactAdScanResult = compactAdScanToolResultForWire(call, { maxChars: MAX_TOOL_RESULT_CHARS });
  return capResult(
    compactAdScanResult && compactAdScanResult.length < resultText.length ? compactAdScanResult : resultText,
  );
}

function expandAssistant(content: AssistantMessageContent): WireMessage[] {
  const calls = content.toolCalls ?? [];
  if (calls.length === 0) {
    return [{ role: "assistant", content: content.text || "" }];
  }
  const assistant: WireMessage = {
    role: "assistant",
    content: content.text ? content.text : null,
    tool_calls: calls.map(toWireToolCall),
  };
  // OpenAI/OpenRouter require a tool message for EVERY tool_call id in the
  // assistant turn. Emit one for every call — including any left unresolved when
  // the user moves on without approving a gated write — so the wire is always
  // valid and the conversation can never wedge on a dangling tool_call.
  const toolMessages: WireMessage[] = calls.map((call) => ({
    role: "tool",
    tool_call_id: call.id,
    name: call.name,
    content: toolResultContent(call),
  }));
  return [assistant, ...toolMessages];
}

/** Build the full wire array: system prompt + expanded transcript. */
export function buildWireMessages(systemPrompt: string, messages: readonly ChatMessageView[]): WireMessage[] {
  const wire: WireMessage[] = [{ role: "system", content: systemPrompt }];
  for (const message of messages) {
    if (message.role === "user") {
      wire.push({ role: "user", content: (message.content as UserMessageContent).text });
    } else if (message.role === "assistant" && isAssistantContent(message.content)) {
      wire.push(...expandAssistant(message.content));
    }
  }
  return wire;
}
