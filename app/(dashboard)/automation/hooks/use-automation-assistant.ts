"use client";

import { useCallback, useRef, useState } from "react";
import { createChatApiClient, isAssistantOutputEvent } from "@/app/chat/lib/chat-api-client";
import { isRetryableStreamError } from "@/lib/errors/transient-client-error";
import type { ChatStreamEvent, ToolCallRecord } from "@/lib/chat/types";
import type { AutomationFlow } from "../contexts/automation-context";
import { ASSISTANT_FLOW_TOOL_NAME, buildAssistantFlowFromToolArgs } from "../lib/assistant-flow";
import { applyAutomationToolCall, isAutomationBuilderTool, type AssistantCanvasApi } from "../lib/assistant-canvas";
import type { ParsedAutomationSuggestion } from "../lib/parse-assistant-suggestions";

const ASSISTANT_STREAM_URL = "/api/automation-assistant/stream";

/** Transient SSE drops before any output are auto-retried this many times before surfacing an error. */
const MAX_STREAM_RETRIES = 2;
const STREAM_RETRY_BASE_DELAY_MS = 500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface AssistantToolCall {
  readonly id: string;
  readonly name: string;
  readonly status: ToolCallRecord["status"];
  readonly resultText?: string;
  readonly errorMessage?: string;
  /** True for the create_automation call the builder applies to the canvas. */
  readonly isFlowProposal: boolean;
  /** True for the live canvas builder tools (start_flow/add_step/update_step/remove_step). */
  readonly isBuilderStep: boolean;
}

export interface SuggestionBuildMetadata {
  readonly rank: number;
  readonly title: string;
  readonly subtitle?: string;
  readonly details: string;
}

export interface AssistantMessage {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly text: string;
  readonly toolCalls: AssistantToolCall[];
  /** Present when the user picked a ranked suggestion to build on canvas. */
  readonly suggestionBuild?: SuggestionBuildMetadata;
}

interface UseAutomationAssistantOptions {
  readonly selectedAccountId?: string;
  readonly selectedAccountName?: string;
  /** Live canvas surface the builder tools drive as they stream. */
  readonly canvas: AssistantCanvasApi;
  /** Fallback for a whole-flow create_automation call (legacy path). */
  readonly onFlowProposed: (flow: AutomationFlow) => void;
}

/** "suggest" makes the assistant scan the account and recommend automations before building. */
export type AssistantMode = "suggest" | "build";

interface UseAutomationAssistantResult {
  readonly messages: AssistantMessage[];
  readonly isLoading: boolean;
  readonly error: string | null;
  sendMessage(content: string, mode?: AssistantMode): Promise<void>;
  sendSuggestionBuild(suggestion: ParsedAutomationSuggestion): Promise<void>;
  clear(): void;
  stop(): void;
}

function toAssistantToolCall(record: ToolCallRecord): AssistantToolCall {
  return {
    id: record.id,
    name: record.name,
    status: record.status,
    resultText: record.resultText,
    errorMessage: record.errorMessage,
    isFlowProposal: record.name === ASSISTANT_FLOW_TOOL_NAME,
    isBuilderStep: isAutomationBuilderTool(record.name),
  };
}

export function useAutomationAssistant(options: UseAutomationAssistantOptions): UseAutomationAssistantResult {
  const { selectedAccountId, selectedAccountName, canvas, onFlowProposed } = options;

  // Keep a live ref so the streaming closure always applies to the current canvas.
  const canvasRef = useRef<AssistantCanvasApi>(canvas);
  canvasRef.current = canvas;

  // Always read the latest account at send time (avoids stale closures racing auto-select).
  const selectedAccountIdRef = useRef(selectedAccountId);
  const selectedAccountNameRef = useRef(selectedAccountName);
  selectedAccountIdRef.current = selectedAccountId;
  selectedAccountNameRef.current = selectedAccountName;

  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const conversationIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const clientRef = useRef(createChatApiClient());
  const appliedFlowToolIdsRef = useRef<Set<string>>(new Set());
  const appliedBuilderStartIdsRef = useRef<Set<string>>(new Set());
  const turnCounterRef = useRef(0);

  const upsertAssistantToolCall = useCallback((assistantId: string, record: ToolCallRecord) => {
    setMessages((prev) =>
      prev.map((message) => {
        if (message.id !== assistantId) return message;
        const next = toAssistantToolCall(record);
        const existingIndex = message.toolCalls.findIndex((call) => call.id === record.id);
        const toolCalls =
          existingIndex >= 0
            ? message.toolCalls.map((call, index) => (index === existingIndex ? { ...call, ...next } : call))
            : [...message.toolCalls, next];
        return { ...message, toolCalls };
      }),
    );
  }, []);

  /** Agent streams cumulative text (same contract as useChat). Replace, do not append. */
  const setAssistantText = useCallback((assistantId: string, text: string) => {
    setMessages((prev) => prev.map((message) => (message.id === assistantId ? { ...message, text } : message)));
  }, []);

  /** Clear a turn's assistant bubble before an auto-retry so the re-stream renders from scratch. */
  const resetAssistantTurn = useCallback((assistantId: string) => {
    setMessages((prev) =>
      prev.map((message) => (message.id === assistantId ? { ...message, text: "", toolCalls: [] } : message)),
    );
  }, []);

  const maybeApplyFlow = useCallback(
    (record: ToolCallRecord) => {
      if (record.name !== ASSISTANT_FLOW_TOOL_NAME) return;
      if (appliedFlowToolIdsRef.current.has(record.id)) return;
      const flow = buildAssistantFlowFromToolArgs(record.name, record.args, {
        selectedAccountId,
        selectedAccountName,
      });
      if (!flow) return;
      appliedFlowToolIdsRef.current.add(record.id);
      onFlowProposed(flow);
    },
    [onFlowProposed, selectedAccountId, selectedAccountName],
  );

  // Apply builder tools on tool_start for live feedback, then re-apply on tool_result
  // when args are complete (tool_start often arrives with partial/empty config).
  const maybeApplyBuilderStep = useCallback((record: ToolCallRecord, eventType: "tool_start" | "tool_result") => {
    if (!isAutomationBuilderTool(record.name)) return;

    const isResult = eventType === "tool_result";
    const shouldApply = isResult ? record.status === "done" : !appliedBuilderStartIdsRef.current.has(record.id);

    if (!shouldApply) return;

    if (!isResult) {
      appliedBuilderStartIdsRef.current.add(record.id);
    }

    applyAutomationToolCall(record, canvasRef.current);
  }, []);

  const handleEvent = useCallback(
    (assistantId: string, event: ChatStreamEvent) => {
      switch (event.type) {
        case "conversation":
          conversationIdRef.current = event.conversationId;
          return;
        case "tool_start":
          upsertAssistantToolCall(assistantId, event.toolCall);
          maybeApplyBuilderStep(event.toolCall, "tool_start");
          maybeApplyFlow(event.toolCall);
          return;
        case "tool_result":
          upsertAssistantToolCall(assistantId, event.toolCall);
          maybeApplyBuilderStep(event.toolCall, "tool_result");
          maybeApplyFlow(event.toolCall);
          return;
        case "pending_tool":
          // Gated writes pause the agent. Only create_automation is harvested onto
          // the canvas as "done"; other pending tools stay pending so we don't
          // fake a green check for unavailable tools like get_top_ads.
          if (event.toolCall.name === ASSISTANT_FLOW_TOOL_NAME) {
            upsertAssistantToolCall(assistantId, { ...event.toolCall, status: "done" });
            maybeApplyFlow(event.toolCall);
          } else {
            upsertAssistantToolCall(assistantId, { ...event.toolCall, status: "pending" });
          }
          return;
        case "text":
          setAssistantText(assistantId, event.text);
          return;
        case "error":
          // Banner only — avoid duplicating the same text into the assistant bubble.
          setError(event.message);
          return;
        default:
          return;
      }
    },
    [maybeApplyBuilderStep, maybeApplyFlow, setAssistantText, upsertAssistantToolCall],
  );

  const streamTurn = useCallback(
    async (
      trimmed: string,
      mode: AssistantMode,
      userMessageExtras: Pick<AssistantMessage, "suggestionBuild"> = {},
    ): Promise<void> => {
      const turn = turnCounterRef.current++;
      const userMessage: AssistantMessage = {
        id: `user-${turn}`,
        role: "user",
        text: trimmed,
        toolCalls: [],
        ...userMessageExtras,
      };
      const assistantId = `assistant-${turn}`;
      const assistantMessage: AssistantMessage = { id: assistantId, role: "assistant", text: "", toolCalls: [] };
      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsLoading(true);
      setError(null);

      const controller = new AbortController();
      abortRef.current = controller;

      const accountIdAtSend = selectedAccountIdRef.current;
      const accountNameAtSend = selectedAccountNameRef.current;

      try {
        // A transient SSE drop *before* any output (planning / first tool) is safe to replay: nothing
        // was applied to the canvas yet, and `resume` stops the server re-appending the user turn.
        for (let attempt = 0; attempt <= MAX_STREAM_RETRIES; attempt++) {
          let producedOutput = false;
          try {
            await clientRef.current.stream(
              ASSISTANT_STREAM_URL,
              {
                conversationId: conversationIdRef.current ?? undefined,
                message: trimmed,
                adAccountId: accountIdAtSend,
                accountName: accountNameAtSend,
                mode,
                resume: attempt > 0,
              },
              (event) => {
                if (isAssistantOutputEvent(event)) producedOutput = true;
                handleEvent(assistantId, event);
              },
              controller.signal,
            );
            return;
          } catch (err) {
            if (err instanceof DOMException && err.name === "AbortError") return;
            const canRetry = attempt < MAX_STREAM_RETRIES && !producedOutput && isRetryableStreamError(err);
            if (!canRetry) {
              const messageText = err instanceof Error ? err.message : "The assistant hit an error. Try again.";
              setError(messageText);
              return;
            }
            resetAssistantTurn(assistantId);
            await delay(STREAM_RETRY_BASE_DELAY_MS * 2 ** attempt);
          }
        }
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        setIsLoading(false);
      }
    },
    [handleEvent, resetAssistantTurn],
  );

  const sendMessage = useCallback(
    async (content: string, mode: AssistantMode = "build") => {
      const trimmed = content.trim();
      if (!trimmed || isLoading) {
        return;
      }
      await streamTurn(trimmed, mode);
    },
    [isLoading, streamTurn],
  );

  const sendSuggestionBuild = useCallback(
    async (suggestion: ParsedAutomationSuggestion) => {
      const trimmed = suggestion.buildMessage.trim();
      if (!trimmed || isLoading) {
        return;
      }
      await streamTurn(trimmed, "build", {
        suggestionBuild: {
          rank: suggestion.rank,
          title: suggestion.title,
          ...(suggestion.subtitle !== undefined ? { subtitle: suggestion.subtitle } : {}),
          details: suggestion.details,
        },
      });
    },
    [isLoading, streamTurn],
  );

  const clear = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    conversationIdRef.current = null;
    appliedFlowToolIdsRef.current = new Set();
    appliedBuilderStartIdsRef.current = new Set();
    setMessages([]);
    setError(null);
    setIsLoading(false);
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
  }, []);

  return { messages, isLoading, error, sendMessage, sendSuggestionBuild, clear, stop };
}
