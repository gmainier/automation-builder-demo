"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pause, XCircle, Zap, Inbox, RefreshCw, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { summarizePollingSchedule } from "../lib/polling-run-time";

interface ActiveRule {
  id: number;
  automationRuleId: number;
  name: string;
  frequency: string;
  scheduledTime: string | null;
  dayOfWeek: string | null;
  dayOfMonth: string | null;
  /** True when the cadence comes from a polling trigger's checkFrequency. */
  isPollingSchedule?: boolean;
  /** Polling-trigger run slot, mirrored from the trigger node's config. */
  checkTime?: string | null;
  checkDays?: string[] | null;
  checkDayOfMonth?: string | null;
  accountId: string;
  accountName: string | null;
  userEmail: string | null;
  actionSummary: string | null;
  triggerService?: string | null;
  triggerEvent?: string | null;
  type: "recurring";
}

interface PendingDelay {
  id: number;
  executionId: number;
  automationRuleId: number;
  name: string;
  resumeAt: string;
  pausedAt: string;
  accountId: string;
  accountName: string | null;
  userEmail: string | null;
  actionSummary: string | null;
  type: "delayed";
}

type ActiveItem = ActiveRule | PendingDelay;

interface ActiveAutomationsTabProps {
  onCountChange?: (count: number) => void;
  onOpenAutomation?: (id: number | string) => void;
}

function formatSchedule(item: ActiveItem): string {
  if (item.type === "delayed") {
    const resumeAt = new Date(item.resumeAt);
    const now = new Date();
    if (resumeAt <= now) return "Resuming soon";
    return `Resumes ${formatDistanceToNow(resumeAt, { addSuffix: true })}`;
  }

  const rule = item as ActiveRule;
  const time = rule.scheduledTime || "";

  // Polling triggers (e.g. Google Drive) use checkFrequency
  if (rule.triggerService && rule.frequency === "hourly") {
    return "Polling every hour";
  }
  // Calendar-gated polling rules keep their slot in the trigger node, so read it
  // from there rather than the rule columns, which are null for these rules and
  // would render a weekly rule as "Every  ".
  if (rule.triggerService && rule.isPollingSchedule) {
    const pollingSummary = summarizePollingSchedule({
      checkFrequency: rule.frequency,
      checkTime: rule.checkTime,
      checkDays: rule.checkDays,
      checkDayOfMonth: rule.checkDayOfMonth,
    });
    if (pollingSummary) {
      return `Polling ${pollingSummary} (${rule.triggerEvent || rule.triggerService})`;
    }
  }

  switch (rule.frequency) {
    case "event":
      if (rule.triggerService === "app") return "On ad launch";
      return "On media upload";
    case "daily":
      return time ? `Every day at ${time}` : "Every day";
    case "weekly": {
      const day = rule.dayOfWeek ? rule.dayOfWeek.charAt(0).toUpperCase() + rule.dayOfWeek.slice(1) : "";
      return time ? `Every ${day} at ${time}` : `Every ${day}`;
    }
    case "monthly": {
      const dom = rule.dayOfMonth === "last" ? "last day" : `day ${rule.dayOfMonth}`;
      return time ? `${dom} of month at ${time}` : `${dom} of month`;
    }
    case "hourly":
      return "Polling every hour";
    default:
      return rule.frequency;
  }
}

export function ActiveAutomationsTab({ onCountChange, onOpenAutomation }: ActiveAutomationsTabProps) {
  const [items, setItems] = useState<ActiveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchActive = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setRefreshing(true);
    try {
      const response = await fetch("/api/automation/active");
      const data = await response.json();
      const combined: ActiveItem[] = [...(data.rules || []), ...(data.delays || [])];
      setItems(combined);
      onCountChange?.(data.counts?.total || 0);
    } catch (error) {
      console.error("Failed to fetch active automations:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchActive();
    const interval = setInterval(() => fetchActive(), 30000);
    return () => clearInterval(interval);
  }, []);

  const handlePause = async (ruleId: number) => {
    const key = `rule-${ruleId}`;
    setProcessingId(key);
    try {
      const response = await fetch("/api/automation-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ruleId, status: "paused" }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success("Automation paused");
        setItems((prev) => prev.filter((i) => !(i.type === "recurring" && i.id === ruleId)));
        onCountChange?.((items.length || 1) - 1);
      } else {
        toast.error(result.error || "Failed to pause automation");
      }
    } catch {
      toast.error("Failed to pause automation");
    } finally {
      setProcessingId(null);
    }
  };

  const handleCancel = async (delayId: number) => {
    const key = `delay-${delayId}`;
    setProcessingId(key);
    try {
      const response = await fetch("/api/automation/active/cancel-delay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delayedExecutionId: delayId }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success("Delayed execution cancelled");
        setItems((prev) => prev.filter((i) => !(i.type === "delayed" && i.id === delayId)));
        onCountChange?.((items.length || 1) - 1);
      } else {
        toast.error(result.error || "Failed to cancel");
      }
    } catch {
      toast.error("Failed to cancel delayed execution");
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 p-4 md:p-8 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Zap className="h-6 w-6 text-green-500" />
            Active Automations
          </h2>
          <p className="text-muted-foreground mt-1">Recurring rules and pending delayed executions</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchActive(true)} disabled={refreshing}>
          <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Inbox className="h-8 w-8 text-muted-foreground" />
            </div>
            <CardTitle className="text-lg mb-2">No Active Automations</CardTitle>
            <CardDescription className="text-center max-w-sm">
              Recurring automations and pending delayed executions will appear here.
            </CardDescription>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Ad Account</TableHead>
                <TableHead>User</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const itemKey = `${item.type}-${item.id}`;
                const isProcessing = processingId === itemKey;

                return (
                  <TableRow key={itemKey}>
                    <TableCell>
                      <button
                        className="text-left font-medium text-primary hover:underline cursor-pointer"
                        onClick={() => onOpenAutomation?.(item.automationRuleId)}
                      >
                        {item.name}
                      </button>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Rule #{item.automationRuleId}
                        {item.actionSummary && ` · ${item.actionSummary}`}
                      </div>
                      {item.type === "delayed" && (
                        <div className="text-xs text-muted-foreground">
                          Execution #{(item as PendingDelay).executionId}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.type === "recurring" ? (
                        (item as ActiveRule).frequency === "event" ? (
                          <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">
                            <Zap className="h-3 w-3 mr-1" />
                            Event
                          </Badge>
                        ) : (item as ActiveRule).triggerService ? (
                          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Polling</Badge>
                        ) : (
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Recurring</Badge>
                        )
                      ) : (
                        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                          <Timer className="h-3 w-3 mr-1" />
                          Delayed
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{formatSchedule(item)}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{item.accountName || item.accountId}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-muted-foreground">{item.userEmail || "-"}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      {item.type === "recurring" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                          onClick={() => handlePause(item.id)}
                          disabled={isProcessing}
                        >
                          <Pause className="h-4 w-4 mr-1" />
                          Pause
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleCancel(item.id)}
                          disabled={isProcessing}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Cancel
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
