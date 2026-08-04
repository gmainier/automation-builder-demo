"use client";

import { useState } from "react";
import { Flame, Hash, Loader2, Mail, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AutomationNode } from "../contexts/automation-context";

interface NotificationPreviewProps {
  node: AutomationNode;
  triggerNode?: AutomationNode;
  flowName?: string;
  selectedAccountId?: string;
  selectedAccountName?: string;
}

interface DryRunResponse {
  subject: string;
  body: string;
  hasEmail: boolean;
  hasSlack: boolean;
  emailRecipients: string[];
  slackChannel: { id: string; name: string } | null;
  matchedCount: number;
  firstRecordLabel: string | null;
  previewSource: "live" | "sample" | "baseline" | "timeout";
  triggerError: string | null;
}

export function NotificationPreview({
  node,
  triggerNode,
  flowName,
  selectedAccountId,
  selectedAccountName,
}: NotificationPreviewProps) {
  const config = node.config || {};
  const method: string = config.notificationMethod || "email";
  const hasEmail = method === "email" || method === "both";
  const hasSlack = method === "slack" || method === "both";
  const customMessage: string = (config.customMessage || "").trim();

  const [state, setState] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "ready"; data: DryRunResponse }
    | { status: "error"; message: string }
  >({ status: "idle" });
  const [elapsed, setElapsed] = useState(0);

  const canDryRun = !!triggerNode?.service;
  const automationName = flowName || "Automation";

  const runDryPreview = async () => {
    if (!triggerNode) {
      setState({ status: "error", message: "No trigger configured" });
      return;
    }
    setState({ status: "loading" });
    setElapsed(0);
    const startTime = Date.now();
    const intervalId = setInterval(() => setElapsed(Math.round((Date.now() - startTime) / 100) / 10), 100);
    try {
      const res = await fetch("/api/automation-rules/dry-run-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          triggerNode,
          notificationNode: node,
          automationName,
          selectedAccountId,
          selectedAccountName,
        }),
      });
      const raw = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(raw);
      } catch {
        setState({ status: "error", message: `Bad response (HTTP ${res.status}): ${raw.slice(0, 200)}` });
        return;
      }
      if (!res.ok || data?.error) {
        const msg =
          data?.error ||
          `HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ""}` + (raw ? ` — ${raw.slice(0, 200)}` : "");
        setState({ status: "error", message: msg });
        return;
      }
      setState({ status: "ready", data });
    } catch (err) {
      setState({ status: "error", message: err instanceof Error ? err.message : "Failed to run preview" });
    } finally {
      clearInterval(intervalId);
    }
  };

  const ready = state.status === "ready" ? state.data : null;

  // Before a dry run, show the raw template body so users know what placeholders will be filled
  const displayedBody = ready ? ready.body : customMessage;
  const displayedRecipients = ready ? ready.emailRecipients : config.emailRecipients || [];
  const displayedSlackChannel =
    ready?.slackChannel?.name || config.slackChannelOverride?.name || (ready ? null : "your org default");
  const displayedSubject = ready ? ready.subject : `Notification: ${automationName}`;

  if (!hasEmail && !hasSlack) {
    return (
      <div className="rounded-md border border-dashed px-3 py-4 text-center text-[11px] text-muted-foreground">
        Choose a channel in the Setup tab to preview this notification.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Primary CTA */}
      <Button
        data-testid="notification-dry-run"
        onClick={runDryPreview}
        disabled={state.status === "loading" || !canDryRun}
        className="h-9 w-full gap-2"
        variant={ready ? "outline" : "default"}
      >
        {state.status === "loading" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Running dry run · <span className="ml-1 tabular-nums">{elapsed.toFixed(1)}s</span>
          </>
        ) : ready ? (
          <>
            <RefreshCw className="h-3.5 w-3.5" />
            Re-run dry preview
          </>
        ) : (
          <>
            <Flame className="h-4 w-4" />
            Dry-run this notification
          </>
        )}
      </Button>

      {state.status === "error" && (
        <div className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] text-red-700">
          {state.message}
        </div>
      )}

      {ready?.triggerError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] text-red-700">
          Trigger: {ready.triggerError}
        </div>
      )}

      {ready && !ready.triggerError && (
        <div
          className={cn(
            "rounded-md border px-2.5 py-1.5 text-[11px]",
            ready.previewSource === "live"
              ? "border-green-200 bg-green-50 text-green-800"
              : ready.previewSource === "baseline"
                ? "border-sky-200 bg-sky-50 text-sky-800"
                : "border-amber-200 bg-amber-50 text-amber-800",
          )}
        >
          {ready.previewSource === "live" ? (
            <>
              {ready.matchedCount} live match{ready.matchedCount === 1 ? "" : "es"} found.
              {ready.firstRecordLabel ? (
                <>
                  {" "}
                  Rendering for <span className="font-medium">{ready.firstRecordLabel}</span>.
                </>
              ) : null}
            </>
          ) : ready.previewSource === "baseline" ? (
            <>
              First run — recorded {ready.matchedCount} existing competitor ad
              {ready.matchedCount === 1 ? "" : "s"} as the baseline. New ads from your selected advertisers will trigger
              this notification on the next poll.
            </>
          ) : (
            <>No matching ads right now — showing sample data so you can see what would get sent.</>
          )}
        </div>
      )}

      {hasEmail && (
        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-1.5 text-[10.5px] text-muted-foreground">
            <Mail className="h-3 w-3" />
            <span className="font-semibold uppercase tracking-wide">Email</span>
            <span className="ml-auto truncate">
              {displayedRecipients.length === 0
                ? "No recipients"
                : displayedRecipients.length === 1
                  ? displayedRecipients[0]
                  : `${displayedRecipients.length} recipients`}
            </span>
          </div>
          <div className="space-y-2 px-3 py-2.5">
            <div className="flex items-start gap-2.5">
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                AM
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11.5px] font-semibold text-foreground">{displayedSubject}</p>
                <p className="truncate text-[10.5px] text-muted-foreground">
                  to {displayedRecipients[0] || "you@example.com"}
                  {displayedRecipients.length > 1 ? ` +${displayedRecipients.length - 1}` : ""}
                </p>
              </div>
            </div>
            <p
              className={cn(
                "whitespace-pre-line text-[11.5px] leading-relaxed text-foreground",
                !displayedBody && "italic text-muted-foreground",
              )}
            >
              {displayedBody || "— No custom message configured. Add one in Setup. —"}
            </p>
          </div>
        </div>
      )}

      {hasSlack && (
        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-1.5 text-[10.5px] text-muted-foreground">
            <img src="/slack-logo.svg" alt="" className="h-3 w-3" />
            <span className="font-semibold uppercase tracking-wide">Slack</span>
            <span className={cn("ml-auto flex items-center gap-0.5", !displayedSlackChannel && "italic")}>
              {displayedSlackChannel ? (
                <>
                  <Hash className="h-2.5 w-2.5" />
                  {displayedSlackChannel}
                </>
              ) : (
                "no channel configured"
              )}
            </span>
          </div>
          <div className="px-3 py-2.5">
            <div className="flex items-start gap-2.5">
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-amber-50 text-base leading-none">
                🔔
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[11.5px] font-semibold text-foreground">the app Updates</span>
                  <span className="rounded bg-muted px-1 py-px text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                    APP
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </span>
                </div>
                <p className="mt-1 text-[12px] font-bold text-foreground">🔔 {automationName}</p>
                <p
                  className={cn(
                    "mt-0.5 whitespace-pre-line text-[11.5px] leading-relaxed text-foreground",
                    !displayedBody && "italic text-muted-foreground",
                  )}
                >
                  {displayedBody || "— No custom message configured. —"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
