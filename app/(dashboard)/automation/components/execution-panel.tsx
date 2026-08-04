"use client";

import { useAutomation, type AutomationNode } from "../contexts/automation-context";
import { deriveIsExecuting } from "../lib/execution-log-state";
import { getServiceInfo } from "../lib/service-icons";
import { nodeTypeBadgeStyles } from "../lib/service-themes";
import { normalizeAdscanEventForDisplay } from "../lib/adscan-events";
import Meta from "@/components/ui/icons/meta";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import Image from "next/image";
import {
  CheckCircle2,
  Circle,
  XCircle,
  Loader2,
  Copy,
  ExternalLink,
  History,
  Ban,
  Zap,
  Play,
  Filter,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useState, useEffect, type ComponentProps } from "react";
import { StepCard } from "./enhanced-step-card";
type StepCardStep = ComponentProps<typeof StepCard>["step"];

interface ExecutionPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Fallback message if no real progress has been received yet
const DEFAULT_EXECUTION_MESSAGE = "Executing automation...";

export function ExecutionPanel({ open, onOpenChange }: ExecutionPanelProps) {
  const {
    executionLog,
    flow,
    isExecuting: contextIsExecuting,
    cancelExecution,
    lastExecutionId,
    fetchLastExecution,
  } = useAutomation();
  const router = useRouter();
  const [logsOpen, setLogsOpen] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);

  // Fetch last execution when panel opens and no active execution
  useEffect(() => {
    if (open && !contextIsExecuting && executionLog.length === 0 && lastExecutionId) {
      fetchLastExecution();
    }
  }, [open, contextIsExecuting, executionLog.length, lastExecutionId, fetchLastExecution]);

  // Extract data from execution logs
  const stepResults = executionLog.find((log) => log.data?.stepResults)?.data?.stepResults as
    | StepCardStep[]
    | undefined;
  const debugLogs = executionLog.find((log) => log.data?.logs)?.data?.logs as string[] | undefined;
  const historyLog = executionLog.find((log) => log.nodeId === "history");
  const historyId = historyLog?.data?.historyId;
  const resultId = historyLog?.data?.resultId;
  const accountId = historyLog?.data?.accountId;
  const actionType = historyLog?.data?.actionType;

  const isExecuting = deriveIsExecuting(executionLog);
  const hasError = executionLog.some((log) => log.status === "error");
  const isCancelled = executionLog.some((log) => log.status === "cancelled");
  const isComplete = executionLog.some((log) => log.status === "success" && log.nodeId === "history");

  // Track execution start time
  useEffect(() => {
    if (isExecuting && !startTime) {
      setStartTime(Date.now());
      setElapsedTime(0);
    } else if (!isExecuting && startTime) {
      setStartTime(null);
      setElapsedTime(0);
    }
  }, [isExecuting, startTime]);

  // Update elapsed time counter every 100ms
  useEffect(() => {
    if (!isExecuting || !startTime) {
      return;
    }

    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      setElapsedTime(elapsed);
    }, 100);

    return () => clearInterval(interval);
  }, [isExecuting, startTime]);

  // Get the latest progress message from execution logs
  const latestProgressMessage =
    executionLog.filter((log) => log.status === "running").pop()?.message || DEFAULT_EXECUTION_MESSAGE;

  // Build per-step state timeline — derive each node's current status from the
  // SSE events we've received so far, so the panel can render step-by-step progress
  // while the execution is still running (not just after it finishes).
  const stepState = (() => {
    const runningEntry = executionLog.filter((log) => log.status === "running").pop();
    const runningNodeId = runningEntry?.nodeId;
    const completedNodeIds = new Set(
      executionLog
        .filter((log) => log.status === "success" && log.nodeId && log.nodeId !== "system" && log.nodeId !== "history")
        .map((log) => log.nodeId),
    );
    const errorNodeIds = new Set(
      executionLog
        .filter((log) => log.status === "error" && log.nodeId && log.nodeId !== "system")
        .map((log) => log.nodeId),
    );
    return flow.nodes.map((n: AutomationNode, i: number) => {
      const info = n.service ? getServiceInfo(n.service) : null;
      let status: "pending" | "running" | "success" | "error" = "pending";
      if (errorNodeIds.has(n.id)) status = "error";
      else if (completedNodeIds.has(n.id)) status = "success";
      else if (isExecuting && runningNodeId === n.id) status = "running";
      else if (isExecuting && !runningNodeId && i === 0) status = "running"; // first step while initializing
      // A running step trails completed siblings — mark earlier pending steps running
      // implicitly so users see the sequence, not just the head.
      return { node: n, index: i, info, status };
    });
  })();
  // Fold in implicit progress: everything before the running step should look completed.
  const runningIdx = stepState.findIndex((s) => s.status === "running");
  if (runningIdx > -1) {
    for (let i = 0; i < runningIdx; i++) {
      if (stepState[i].status === "pending") stepState[i].status = "success";
    }
  }

  const navigateToHistory = (id: number) => {
    onOpenChange(false);
    router.push(`/automation?tab=history&historyId=${id}`);
  };

  const getAdsManagerUrl = () => {
    if (!resultId || !accountId) return null;
    const actId = String(accountId).replace("act_", "");
    if (actionType === "duplicate-adset") {
      return `https://business.facebook.com/adsmanager/manage/adsets?act=${actId}&selected_adset_ids=${resultId}`;
    }
    if (actionType === "duplicate-campaign") {
      return `https://business.facebook.com/adsmanager/manage/campaigns?act=${actId}&selected_campaign_ids=${resultId}`;
    }
    return null;
  };

  const adsManagerUrl = getAdsManagerUrl();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Execution Results</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Loading state */}
          {isExecuting && (
            <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              <div className="flex items-center justify-between flex-1">
                <span className="text-blue-700 font-medium">{latestProgressMessage}</span>
                <div className="flex items-center gap-2">
                  <span className="text-blue-600 text-sm font-mono">{elapsedTime.toFixed(1)}s</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={cancelExecution}
                  >
                    <Ban className="h-3.5 w-3.5 mr-1" />
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Cancelled state */}
          {isCancelled && (
            <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <Ban className="h-5 w-5 text-amber-600" />
              <span className="text-amber-700 font-medium">Execution was cancelled</span>
            </div>
          )}

          {/* Empty state */}
          {executionLog.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center">
              <p className="text-sm text-muted-foreground">No execution logs yet</p>
              <p className="text-xs text-muted-foreground">Run your automation to see results here</p>
            </div>
          )}

          {/* Live step timeline — mirrors the flow-card layout so users see
               the same step numbering + service icon + type badge as the builder. */}
          {(isExecuting || (!stepResults && executionLog.length > 0)) && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Steps</h3>
              <ol className="space-y-2">
                {stepState.map((s) => {
                  const typeBadge = nodeTypeBadgeStyles[s.node.type];
                  const iconType = s.info?.iconType || "emoji";
                  const nodeTypeIcon =
                    s.node.type === "trigger"
                      ? Zap
                      : s.node.type === "action"
                        ? Play
                        : s.node.type === "filter"
                          ? Filter
                          : s.node.type === "delay"
                            ? Clock
                            : ShieldCheck;
                  const NodeTypeIcon = nodeTypeIcon;
                  return (
                    <li
                      key={s.node.id}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                        s.status === "running" && "border-blue-200 bg-blue-50",
                        s.status === "success" && "border-emerald-200 bg-emerald-50/50",
                        s.status === "error" && "border-red-200 bg-red-50",
                        s.status === "pending" && "border-dashed bg-muted/20",
                      )}
                    >
                      {/* Step number + service icon (matches flow card top-left) */}
                      <div className="flex flex-shrink-0 items-center gap-2">
                        <span
                          className={cn(
                            "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
                            s.status === "success" && "bg-emerald-100 text-emerald-700",
                            s.status === "error" && "bg-red-100 text-red-700",
                            s.status === "running" && "bg-blue-100 text-blue-700",
                            s.status === "pending" && "bg-muted text-muted-foreground",
                          )}
                        >
                          {s.index + 1}
                        </span>
                        <div
                          className={cn(
                            "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-muted/50",
                          )}
                        >
                          {s.node.service === "meta-ads" ? (
                            <Meta className="h-5 w-5" grayscale={false} />
                          ) : s.info && iconType === "image" ? (
                            <Image src={s.info.icon} alt={s.info.label} width={20} height={20} />
                          ) : s.info ? (
                            <span className="text-base">{s.info.icon}</span>
                          ) : (
                            <NodeTypeIcon className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>

                      {/* Step body — type badge + service · event */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                              typeBadge?.bg,
                              typeBadge?.text,
                            )}
                          >
                            {s.node.type}
                          </span>
                          <p className="truncate text-sm font-medium text-foreground">
                            {s.info?.label
                              ? `${s.info.label} · ${normalizeAdscanEventForDisplay(s.node.event) || ""}`
                              : normalizeAdscanEventForDisplay(s.node.event) || "Step"}
                          </p>
                        </div>
                        {s.status === "running" && (
                          <p className="mt-0.5 truncate text-xs text-blue-700">{latestProgressMessage}</p>
                        )}
                        {s.status === "pending" && (
                          <p className="mt-0.5 text-xs text-muted-foreground">Waiting for previous step…</p>
                        )}
                      </div>

                      {/* Right side: elapsed + status icon */}
                      <div className="flex flex-shrink-0 items-center gap-2">
                        {s.status === "running" && (
                          <span className="font-mono text-xs tabular-nums text-blue-700">
                            {elapsedTime.toFixed(1)}s
                          </span>
                        )}
                        {s.status === "running" && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
                        {s.status === "success" && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
                        {s.status === "error" && <XCircle className="h-5 w-5 text-red-600" />}
                        {s.status === "pending" && <Circle className="h-4 w-4 text-muted-foreground/40" />}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          {/* Step Results - prominent display */}
          {stepResults && stepResults.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Execution Details</h3>
              <div className="space-y-2">
                {stepResults.map((step, index) => (
                  <StepCard
                    key={step.nodeId || index}
                    step={step}
                    stepNumber={index + 1}
                    isLast={index === stepResults.length - 1}
                    executionId={lastExecutionId ?? undefined}
                    onRefresh={fetchLastExecution}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          {isComplete && (
            <div className="flex flex-wrap gap-2">
              {historyId && (
                <Button variant="outline" size="sm" className="gap-2" onClick={() => navigateToHistory(historyId)}>
                  <History className="h-4 w-4" />
                  View in History
                </Button>
              )}
              {adsManagerUrl && (
                <a href={adsManagerUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" className="gap-2 bg-blue-600 hover:bg-blue-700">
                    <ExternalLink className="h-4 w-4" />
                    View in Ads Manager
                  </Button>
                </a>
              )}
            </div>
          )}

          {/* Debug Logs - collapsed */}
          {debugLogs && debugLogs.length > 0 && (
            <Collapsible open={logsOpen} onOpenChange={setLogsOpen}>
              <div className="border rounded-lg">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between px-4 py-3 h-auto">
                    <span className="text-sm text-muted-foreground">Debug Logs ({debugLogs.length} entries)</span>
                    <ChevronDown className={cn("h-4 w-4 transition-transform", logsOpen && "rotate-180")} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-4 pb-4 space-y-2">
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          navigator.clipboard.writeText(debugLogs.join("\n"));
                          toast.success("Logs copied to clipboard");
                        }}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </Button>
                    </div>
                    <pre className="overflow-x-auto rounded-md bg-gray-900 text-green-400 p-3 text-xs font-mono max-h-64 overflow-y-auto">
                      {debugLogs.join("\n")}
                    </pre>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          )}

          {/* Error state - show if any errors and no step results showing the failure */}
          {hasError && (!stepResults || stepResults.length === 0) && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 text-red-700">
                <XCircle className="h-5 w-5" />
                <span className="font-medium">Execution failed</span>
              </div>
              {executionLog.find((log) => log.status === "error")?.message && (
                <p className="mt-2 text-sm text-red-600">
                  {executionLog.find((log) => log.status === "error")?.message}
                </p>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
