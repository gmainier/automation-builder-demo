"use client";

import { useCallback, useRef, useState } from "react";
import { parseEvents } from "@/lib/chat/sse";
import type { ToolCallRecord } from "@/lib/chat/types";
import type { ChatMessage, FollowUpSuggestion } from "../components/chat/types";
import { useAutomation } from "../contexts/automation-context";

const STREAM_URL = "/api/automation-assistant/stream";

export function useChatAutomation() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const conversationIdRef = useRef<string>("chat-" + Date.now());
  const automation = useAutomation();

  /** Update the last assistant message in place. */
  const updateLastAssistant = useCallback((updater: (prev: ChatMessage) => ChatMessage) => {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (!last || last.role !== "assistant") return prev;
      return [...prev.slice(0, -1), updater(last)];
    });
  }, []);

  const streamResponse = useCallback(async (userText: string) => {
    setIsStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;

    // Add an empty assistant message we'll fill progressively
    const assistantId = `assistant-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", text: "" },
    ]);

    const thinkingStart = Date.now();
    let isThinking = false;

    try {
      const response = await fetch(STREAM_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          conversationId: conversationIdRef.current,
          adAccountId: automation.flow.selectedAccountId ?? "demo-account",
          accountName: automation.flow.selectedAccountName ?? "Demo Ad Account",
          mode: "build",
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`Stream failed: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const { events, rest } = parseEvents(buffer);
        buffer = rest;

        for (const event of events) {
          switch (event.type) {
            case "thinking": {
              isThinking = true;
              break;
            }
            case "text": {
              const thinkingSecs = isThinking ? (Date.now() - thinkingStart) / 1000 : undefined;
              isThinking = false;
              updateLastAssistant((msg) => ({
                ...msg,
                text: event.text,
                thinkingSeconds: msg.thinkingSeconds ?? thinkingSecs,
              }));
              break;
            }
            case "tool_start": {
              const thinkingSecs = isThinking ? (Date.now() - thinkingStart) / 1000 : undefined;
              isThinking = false;
              updateLastAssistant((msg) => ({
                ...msg,
                thinkingSeconds: msg.thinkingSeconds ?? thinkingSecs,
                toolCalls: [...(msg.toolCalls ?? []), event.toolCall],
              }));
              // Apply builder tool to automation state
              applyBuilderTool(event.toolCall, automation);
              break;
            }
            case "tool_result": {
              updateLastAssistant((msg) => ({
                ...msg,
                toolCalls: (msg.toolCalls ?? []).map((tc) =>
                  tc.id === event.toolCall.id ? event.toolCall : tc,
                ),
              }));
              break;
            }
            case "error": {
              updateLastAssistant((msg) => ({
                ...msg,
                text: msg.text || `Error: ${event.message}`,
              }));
              break;
            }
            case "done": {
              updateLastAssistant((msg) => ({
                ...msg,
                followUps: generateFollowUps(msg),
              }));
              break;
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      updateLastAssistant((msg) => ({
        ...msg,
        text: msg.text || "Something went wrong. Try again.",
      }));
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [updateLastAssistant, automation]);

  const sendMessage = useCallback((text: string) => {
    const userMsg: ChatMessage = { id: `user-${Date.now()}`, role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    streamResponse(text);
  }, [streamResponse]);

  const saveCurrentAutomation = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    try {
      const result = await automation.saveAutomation({ mode: "create", name: automation.flow.name });
      if (result.ok) {
        return { ok: true };
      }
      return { ok: false, error: result.error };
    } catch {
      return { ok: false, error: "Save failed unexpectedly" };
    }
  }, [automation]);

  return { messages, isStreaming, sendMessage, saveCurrentAutomation };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Apply a builder tool call to the automation canvas. */
function applyBuilderTool(
  toolCall: ToolCallRecord,
  automation: ReturnType<typeof useAutomation>,
) {
  const { name, args } = toolCall;

  if (name === "automation_start_flow") {
    automation.startAssistantFlow({
      name: (args.name as string) ?? "Untitled Automation",
      selectedAccountId: args.accountId as string | undefined,
      selectedAccountName: args.accountName as string | undefined,
    });
  } else if (name === "automation_add_step" || name === "automation_update_step") {
    automation.upsertAssistantStep({
      id: args.stepId as string,
      type: args.type as "trigger" | "action",
      service: args.service as string,
      event: args.event as string,
      position: args.position as number | undefined,
      config: args.config as Record<string, unknown> | undefined,
    });
  } else if (name === "automation_remove_step") {
    automation.removeAssistantStep(args.stepId as string);
  }
}

/** Generate follow-up suggestions based on what was built. */
function generateFollowUps(message: ChatMessage): FollowUpSuggestion[] {
  const hasToolCalls = message.toolCalls && message.toolCalls.length > 0;
  if (!hasToolCalls) return [];

  return [
    { id: "review", title: "Show me the steps it created", description: "Review the automation details" },
    { id: "adjust", title: "Change the threshold", description: "Modify when this triggers" },
    { id: "notification", title: "Add a notification step", description: "Get alerted when it runs" },
  ];
}