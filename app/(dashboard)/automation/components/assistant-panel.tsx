"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sparkles,
  Send,
  Loader2,
  X,
  RotateCcw,
  Wand2,
  Check,
  Workflow,
  ChevronRight,
  ChevronDown,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useUser } from "@/lib/providers/user-provider";
import { useAutomation } from "../contexts/automation-context";
import { SUGGESTED_PROMPTS } from "../lib/automation-registry";
import {
  collapseAssistantMessage,
  shouldCollapseAssistantMessage,
  summarizeToolResultText,
} from "../lib/assistant-message-display";
import {
  buildSuggestionPickMessage,
  extractSuggestionIntro,
  extractSuggestionOutro,
  findScanInsightsFromToolCalls,
  resolveAssistantSuggestions,
  type ParsedAutomationSuggestion,
} from "../lib/parse-assistant-suggestions";
import { shouldSuppressSuggestionCards } from "../lib/suggestion-card-layout";
import { isAutomationBuildNudgeMessage } from "@/lib/chat/automation-build-guard";
import { AssistantSuggestionCards } from "./assistant-suggestion-cards";
import { SuggestionBuildProgressCard } from "./assistant-suggestion-build-progress";
import {
  useAutomationAssistant,
  type AssistantMessage,
  type AssistantMode,
  type AssistantToolCall,
} from "../hooks/use-automation-assistant";
import type { AssistantPanelDisplayMode } from "../lib/assistant-panel-layout";

const MCP_TOOL_LABELS: Record<string, string> = {
  automation_start_flow: "Start a fresh draft",
  automation_add_step: "Add step",
  automation_update_step: "Update step",
  automation_remove_step: "Remove step",
  create_automation: "Draft automation flow",
  scan_account_insights: "Scan account for suggestions",
  preview_performance_threshold: "Preview matched ads",
  get_automation_flow_reference: "Load flow reference",
  list_automations: "List automations",
  get_automation: "Read automation",
};

const HIGHLIGHT_CLEAR_DELAY_MS = 1200;

function humanizeToolName(name: string): string {
  return MCP_TOOL_LABELS[name] ?? name.replace(/_/g, " ");
}

const SUGGESTED_PROMPT_LIMIT = 4;

const ASSISTANT_MARKDOWN_COMPONENTS: Components = {
  p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0 leading-relaxed">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-4">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-4">{children}</ol>,
  li: ({ children }) => <li className="pl-1">{children}</li>,
  table: ({ children }) => (
    <div className="my-2 max-w-full overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[480px] border-collapse text-left text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/80">{children}</thead>,
  th: ({ children }) => (
    <th className="whitespace-nowrap border-b border-border px-2.5 py-2 font-semibold text-muted-foreground">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="border-b border-border px-2.5 py-2 align-top text-foreground">{children}</td>,
};

interface AssistantPanelProps {
  readonly onClose: () => void;
  /** Optional goal seeded from the home hero — auto-sent once on open. */
  readonly seedPrompt?: string | null;
  /** Mode for the seeded goal: "suggest" scans + recommends, "build" (default) builds directly. */
  readonly seedMode?: AssistantMode;
  readonly onSeedConsumed?: () => void;
  readonly displayMode?: AssistantPanelDisplayMode;
  readonly onExpandPanel?: () => void;
  readonly onMinimizePanel?: () => void;
}

export function AssistantPanel({
  onClose,
  seedPrompt,
  seedMode = "build",
  onSeedConsumed,
  displayMode = "normal",
  onExpandPanel,
  onMinimizePanel,
}: AssistantPanelProps): React.ReactElement {
  const {
    flow,
    applyAssistantFlow,
    startAssistantFlow,
    upsertAssistantStep,
    removeAssistantStep,
    clearAssistantActiveStep,
  } = useAutomation();
  const { extendedUser, isLoading: isUserLoading } = useUser();
  const [inputValue, setInputValue] = useState("");
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Same Meta-only filter as AutomationAdAccountSelector — used to wait for auto-select.
  const hasMetaAccountOptions = useMemo(() => {
    if (!extendedUser?.settings || !extendedUser.defaultWorkspaceId) return false;
    return extendedUser.settings.some(
      (setting: { workspaceId?: string; businessId?: string; type?: string | null }) => {
        if (setting.workspaceId !== extendedUser.defaultWorkspaceId || !setting.businessId) return false;
        const platformType = setting.type || (setting.businessId.startsWith("act_") ? "facebook" : null);
        return platformType === "facebook" || platformType === "meta";
      },
    );
  }, [extendedUser]);

  // Adapter mapping the reducer's canvas surface onto the automation context.
  const canvas = useMemo(
    () => ({
      startFlow: startAssistantFlow,
      upsertStep: upsertAssistantStep,
      removeStep: removeAssistantStep,
    }),
    [startAssistantFlow, upsertAssistantStep, removeAssistantStep],
  );

  const { messages, isLoading, error, sendMessage, sendSuggestionBuild, clear, stop } = useAutomationAssistant({
    selectedAccountId: flow.selectedAccountId,
    selectedAccountName: flow.selectedAccountName,
    canvas,
    onFlowProposed: (proposedFlow) => {
      applyAssistantFlow(proposedFlow);
      toast.success(`"${proposedFlow.name}" added to the canvas`, { position: "top-right" });
    },
  });

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fade the live "building" highlight shortly after the assistant stops.
  useEffect(() => {
    if (isLoading) return;
    const timer = setTimeout(clearAssistantActiveStep, HIGHLIGHT_CLEAR_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isLoading, clearAssistantActiveStep]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Auto-send the goal seeded from the home hero, exactly once — but only after an
  // ad account is selected. The header selector auto-fills shortly after mount; sending
  // before that races and surfaces "Chat requires a connected ad account".
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current || !seedPrompt?.trim()) return;

    if (flow.selectedAccountId) {
      seededRef.current = true;
      void sendMessage(seedPrompt, seedMode);
      onSeedConsumed?.();
      return;
    }

    if (isUserLoading) return;
    // Meta accounts exist — wait for selector auto-select / context backfill.
    if (hasMetaAccountOptions) return;

    // User loaded and no Meta accounts connected: keep the goal in the composer
    // instead of firing a doomed request.
    seededRef.current = true;
    setInputValue(seedPrompt.trim());
    onSeedConsumed?.();
  }, [seedPrompt, seedMode, sendMessage, onSeedConsumed, flow.selectedAccountId, isUserLoading, hasMetaAccountOptions]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!inputValue.trim() || isLoading) return;
    void sendMessage(inputValue);
    setInputValue("");
  };

  const handleSuggestion = (text: string, mode?: AssistantMode) => {
    if (isLoading) return;
    void sendMessage(text, mode);
  };

  const isEmpty = messages.length === 0;
  const isActiveSuggestionBuild =
    isLoading &&
    messages.length >= 2 &&
    messages[messages.length - 2]?.role === "user" &&
    Boolean(messages[messages.length - 2]?.suggestionBuild);

  /** Scan finished and fallback cards are on screen — hide the global MCP spinner. */
  const suggestCardsReady = ((): boolean => {
    if (!isLoading) return false;
    const lastAssistant = [...messages].reverse().find((message) => message.role === "assistant");
    if (!lastAssistant) return false;
    const scanStatus = lastAssistant.toolCalls.find((call) => call.name === "scan_account_insights")?.status;
    if (scanStatus !== "done") return false;
    const scanSummary = findScanInsightsFromToolCalls(lastAssistant.toolCalls);
    if (!scanSummary) return false;
    return resolveAssistantSuggestions(lastAssistant.text, scanSummary, scanStatus).length > 0;
  })();

  return (
    <div className="flex h-full flex-col bg-card">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100">
            <Sparkles className="h-4 w-4 text-violet-600" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight text-foreground">Agent</p>
            <p className="text-[11px] leading-tight text-muted-foreground">Connected via the MCP toolset</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {displayMode === "normal" && onExpandPanel && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onExpandPanel} title="Expand agent panel">
              <Maximize2 className="h-4 w-4" />
            </Button>
          )}
          {displayMode === "expanded" && onMinimizePanel && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onMinimizePanel}
              title="Minimize agent panel"
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
          )}
          {!isEmpty && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={clear} title="Start over">
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} title="Close agent">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {isEmpty ? (
          <EmptyState onSuggestion={handleSuggestion} disabled={isLoading} />
        ) : (
          messages.map((message, index) => {
            const previousMessage = index > 0 ? messages[index - 1] : null;
            if (previousMessage?.role === "user" && previousMessage.suggestionBuild) {
              return null;
            }

            if (message.role === "user" && isAutomationBuildNudgeMessage(message.text)) {
              return null;
            }

            if (message.role === "user" && message.suggestionBuild) {
              const buildMeta = message.suggestionBuild;
              const assistantMessage = messages[index + 1]?.role === "assistant" ? messages[index + 1] : null;
              const isActiveTurn = isLoading && index === messages.length - 2;
              return (
                <SuggestionBuildProgressCard
                  key={message.id}
                  suggestion={buildMeta}
                  toolCalls={assistantMessage?.toolCalls ?? []}
                  assistantText={assistantMessage?.text ?? ""}
                  isLoading={isActiveTurn}
                  hasError={Boolean(error) && index === messages.length - 2}
                  onRetry={() => {
                    if (isLoading) return;
                    void sendSuggestionBuild({
                      rank: buildMeta.rank,
                      title: buildMeta.title,
                      subtitle: buildMeta.subtitle,
                      details: buildMeta.details,
                      buildMessage: buildSuggestionPickMessage(buildMeta),
                    });
                  }}
                />
              );
            }

            return (
              <MessageRow
                key={message.id}
                message={message}
                isLoading={isLoading}
                suppressSuggestionCards={shouldSuppressSuggestionCards(messages, index)}
                onBuildSuggestion={(suggestion) => {
                  if (isLoading) {
                    return;
                  }
                  void sendSuggestionBuild(suggestion);
                }}
              />
            );
          })
        )}

        {isLoading && !isActiveSuggestionBuild && !suggestCardsReady && (
          <div className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Working through MCP...
          </div>
        )}

        {error && !isLoading && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
        )}

        <div ref={scrollAnchorRef} />
      </div>

      <form onSubmit={handleSubmit} className="space-y-2 border-t p-3">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder="Describe the automation to build..."
            disabled={isLoading}
            className="flex-1"
          />
          {isLoading ? (
            <Button type="button" variant="outline" size="icon" onClick={stop} title="Stop">
              <X className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={!inputValue.trim()}
              className="bg-violet-600 hover:bg-violet-700"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="px-1 text-[11px] text-muted-foreground">
          The agent drafts and previews. Save and Turn on stay your call.
        </p>
      </form>
    </div>
  );
}

function EmptyState({
  onSuggestion,
  disabled,
}: {
  onSuggestion: (text: string, mode?: AssistantMode) => void;
  disabled: boolean;
}): React.ReactElement {
  return (
    <div className="space-y-5">
      <div className="py-4 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-violet-100">
          <Wand2 className="h-6 w-6 text-violet-600" />
        </div>
        <h3 className="text-base font-semibold text-foreground">Build automations with AI</h3>
        <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">
          Describe what you want to automate. The agent uses the MCP toolset tools to draft the flow and preview which ads
          it would affect.
        </p>
      </div>
      <div className="space-y-2">
        {SUGGESTED_PROMPTS.slice(0, SUGGESTED_PROMPT_LIMIT).map((prompt) => {
          const isSuggest = prompt.mode === "suggest";
          return (
            <button
              key={prompt.text}
              type="button"
              disabled={disabled}
              onClick={() => onSuggestion(prompt.text, prompt.mode)}
              className={cn(
                "flex w-full items-center justify-between rounded-lg border p-3 text-left transition-all",
                "disabled:cursor-not-allowed disabled:opacity-50",
                isSuggest
                  ? "border-violet-300 bg-gradient-to-r from-violet-50 to-fuchsia-50 shadow-sm ring-1 ring-violet-200/60 hover:border-violet-400 hover:shadow-md"
                  : "hover:border-violet-200 hover:bg-violet-50",
              )}
            >
              <div className="flex items-center gap-2">
                {isSuggest && (
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white">
                    <Sparkles className="h-3.5 w-3.5" />
                  </span>
                )}
                <div>
                  <p className={cn("text-sm font-medium text-foreground", isSuggest && "text-violet-900")}>
                    {prompt.text}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{prompt.description}</p>
                </div>
              </div>
              <ChevronRight
                className={cn("h-4 w-4 flex-shrink-0", isSuggest ? "text-violet-500" : "text-muted-foreground")}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MessageRow({
  message,
  isLoading,
  suppressSuggestionCards,
  onBuildSuggestion,
}: {
  message: AssistantMessage;
  isLoading: boolean;
  suppressSuggestionCards: boolean;
  onBuildSuggestion: (suggestion: ParsedAutomationSuggestion) => void;
}): React.ReactElement {
  const scanToolStatus =
    message.role === "assistant"
      ? message.toolCalls.find((call) => call.name === "scan_account_insights")?.status
      : undefined;
  const scanSummary = message.role === "assistant" ? findScanInsightsFromToolCalls(message.toolCalls) : null;
  const suggestions =
    message.role === "assistant" ? resolveAssistantSuggestions(message.text, scanSummary, scanToolStatus) : [];

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-violet-600 px-3 py-2 text-sm text-white">
          {message.text}
        </div>
      </div>
    );
  }

  const hasContent = message.text.trim().length > 0 || message.toolCalls.length > 0;
  if (!hasContent) return <div className="hidden" />;

  return (
    <div className="space-y-2">
      {message.toolCalls.length > 0 && <ToolCallCard toolCalls={message.toolCalls} />}
      {message.text.trim().length > 0 && (
        <ExpandableAssistantText
          text={message.text}
          toolCalls={message.toolCalls}
          suggestions={suggestions}
          isLoading={isLoading}
          scanToolStatus={scanToolStatus}
          suppressSuggestionCards={suppressSuggestionCards}
          onBuildSuggestion={onBuildSuggestion}
        />
      )}
    </div>
  );
}

function ExpandableAssistantText({
  text,
  toolCalls,
  suggestions,
  isLoading,
  scanToolStatus,
  suppressSuggestionCards,
  onBuildSuggestion,
}: {
  text: string;
  toolCalls: AssistantToolCall[];
  suggestions: readonly ParsedAutomationSuggestion[];
  isLoading: boolean;
  scanToolStatus: string | undefined;
  suppressSuggestionCards: boolean;
  onBuildSuggestion: (suggestion: ParsedAutomationSuggestion) => void;
}): React.ReactElement {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasSuggestionCards = !suppressSuggestionCards && suggestions.length > 0;
  const intro = hasSuggestionCards ? extractSuggestionIntro(text, suggestions) : text.trim();
  const outro = hasSuggestionCards ? extractSuggestionOutro(text, suggestions) : "";
  const canCollapse = !hasSuggestionCards && shouldCollapseAssistantMessage(text);
  const shownIntro = !canCollapse || isExpanded ? intro : collapseAssistantMessage(intro);

  return (
    <div className="w-full min-w-0 space-y-3">
      {shownIntro && (
        <div className="rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm text-foreground">
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={ASSISTANT_MARKDOWN_COMPONENTS}>
              {shownIntro}
            </ReactMarkdown>
          </div>
          {canCollapse && (
            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-violet-700 hover:text-violet-800"
            >
              {isExpanded ? "Show less" : "Show more"}
              <ChevronDown className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-180")} />
            </button>
          )}
        </div>
      )}

      {hasSuggestionCards && (
        <AssistantSuggestionCards
          suggestions={suggestions}
          toolCalls={toolCalls}
          disabled={isLoading && scanToolStatus !== "done"}
          onBuildSuggestion={onBuildSuggestion}
        />
      )}

      {outro && (
        <div className="rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm text-foreground">
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={ASSISTANT_MARKDOWN_COMPONENTS}>
              {outro}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}

function ToolCallCard({ toolCalls }: { toolCalls: AssistantToolCall[] }): React.ReactElement {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-800">
      <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
        <Workflow className="h-3 w-3" />
        Tools
      </p>
      <ul className="space-y-1">
        {toolCalls.map((call) => (
          <ToolCallRow key={call.id} call={call} />
        ))}
      </ul>
    </div>
  );
}

function ToolCallRow({ call }: { call: AssistantToolCall }): React.ReactElement {
  const [isExpanded, setIsExpanded] = useState(false);
  const detail = summarizeToolResultText(call.errorMessage ?? call.resultText);
  const canExpand = Boolean(detail) && call.status === "error";

  return (
    <li className="rounded-lg bg-white px-2 py-1.5 text-xs shadow-sm ring-1 ring-slate-200/80">
      <button
        type="button"
        disabled={!canExpand}
        onClick={() => setIsExpanded((prev) => !prev)}
        className={cn("flex w-full items-center gap-2 text-left", canExpand ? "cursor-pointer" : "cursor-default")}
      >
        <ToolStatusIcon status={call.status} />
        <span className="min-w-0 flex-1 truncate font-medium text-slate-800">{humanizeToolName(call.name)}</span>
        {call.isFlowProposal && call.status === "done" && (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
            On canvas
          </span>
        )}
        {call.status === "error" && (
          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600">Failed</span>
        )}
        {canExpand && (
          <ChevronDown
            className={cn("h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform", isExpanded && "rotate-180")}
          />
        )}
      </button>
      {canExpand && isExpanded && detail && (
        <p className="mt-1.5 border-t border-slate-100 pt-1.5 text-[11px] leading-snug text-slate-600">{detail}</p>
      )}
    </li>
  );
}

function ToolStatusIcon({ status }: { status: AssistantToolCall["status"] }): React.ReactElement {
  if (status === "error") return <X className="h-3.5 w-3.5 shrink-0 text-red-500" />;
  if (status === "done" || status === "approved") return <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />;
  return <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-slate-400" />;
}
