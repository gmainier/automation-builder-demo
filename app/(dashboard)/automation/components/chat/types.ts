import type { ClarifyingQuestion, ToolCallRecord } from "@/lib/chat/types";

/** A follow-up suggestion shown after an assistant answer. */
export interface FollowUpSuggestion {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
}

/** A single message in the chat thread. */
export interface ChatMessage {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly text: string;
  /** Seconds the model spent thinking (collapsed indicator). */
  readonly thinkingSeconds?: number;
  /** Tool calls shown as expandable steps. */
  readonly toolCalls?: readonly ToolCallRecord[];
  /** Clarifying question card from the agent. */
  readonly question?: ClarifyingQuestion;
  /** Clickable follow-up suggestions after an answer. */
  readonly followUps?: readonly FollowUpSuggestion[];
}
