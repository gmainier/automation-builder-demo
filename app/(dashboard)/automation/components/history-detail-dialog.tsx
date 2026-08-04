"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Clock, ExternalLink, Copy, ChevronDown, FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";
import { StepCard } from "./enhanced-step-card";
import { type EnhancedStepResult } from "@/types/automation-execution";

// Legacy step result type for backward compatibility
interface LegacyStepResult {
  nodeId: string;
  event: string;
  success: boolean;
  outputs?: Record<string, any>;
  error?: string;
  adsManagerLink?: string;
}

type StepResult = EnhancedStepResult | LegacyStepResult;

interface HistoryRule {
  id: number;
  name: string;
  actionType: string;
  targetId: string | null;
  accountId: string;
  status: string;
  executed: boolean;
  executedAt: string | null;
  resultId: string | null;
  errorMessage: string | null;
  executionLogs: string[] | null;
  stepResults?: StepResult[] | null;
  flow?: any;
  userEmail: string | null;
  scheduledDate: string;
  scheduledTime: string;
  duration: number | null;
  automationRuleId: number | null;
}

interface HistoryDetailDialogProps {
  rule: HistoryRule | null;
  open: boolean;
  // Client-side callback for dialog state (not a server action)
  // This is a "use client" component, so function props are valid
  onOpenChange: (open: boolean) => void;
  /** Set to false when rendered alongside another modal (e.g. Sheet) to prevent pointer-events conflicts */
  modal?: boolean;
}

export function HistoryDetailDialog({ rule, open, onOpenChange, modal }: HistoryDetailDialogProps) {
  const [logsOpen, setLogsOpen] = useState(false);

  if (!rule) return null;

  const formatActionType = (type: string) => {
    const labels: Record<string, string> = {
      "duplicate-adset": "Duplicate Ad Set",
      "duplicate-campaign": "Duplicate Campaign",
      "duplicate-ad": "Duplicate Ad",
      "launch-campaign": "Launch Campaign",
      "pause-campaign": "Pause Campaign",
    };
    return labels[type] || type;
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusInfo = () => {
    if (rule.status === "test") {
      return { label: "Test Run", variant: "outline" as const, icon: FlaskConical };
    }
    if (rule.status === "completed" || (rule.executed && !rule.errorMessage)) {
      return { label: "Success", variant: "success" as const, icon: CheckCircle2 };
    }
    if (rule.status === "failed" || rule.errorMessage) {
      return { label: "Failed", variant: "destructive" as const, icon: XCircle };
    }
    return { label: "Pending", variant: "secondary" as const, icon: Clock };
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const accountIdClean = rule.accountId != null ? String(rule.accountId).replace("act_", "") : undefined;
  const getFacebookUrl = () => {
    if (!rule.resultId) return null;
    if (rule.actionType === "duplicate-adset") {
      return `https://www.facebook.com/adsmanager/manage/adsets?act=${accountIdClean}&selected_adset_ids=${rule.resultId}`;
    }
    if (rule.actionType === "duplicate-campaign") {
      return `https://www.facebook.com/adsmanager/manage/campaigns?act=${accountIdClean}&selected_campaign_ids=${rule.resultId}`;
    }
    // For launch/pause, link to the entity that was modified
    return `https://www.facebook.com/adsmanager/manage/campaigns?act=${accountIdClean}`;
  };
  const facebookUrl = getFacebookUrl();

  // When rendered alongside another modal (Sheet), we run as modal={false}.
  // Radix's DismissableLayer then sometimes misfires onInteractOutside when a
  // descendant mounts new DOM (e.g. the Collapsible's log pane), closing the
  // dialog while the user is clicking inside it. Suppress outside-close in
  // non-modal mode — the X button and the parent Sheet still handle dismissal.
  const suppressOutsideClose = modal === false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={modal}>
      <DialogContent
        className="max-w-2xl"
        onPointerDownOutside={suppressOutsideClose ? (e) => e.preventDefault() : undefined}
        onInteractOutside={suppressOutsideClose ? (e) => e.preventDefault() : undefined}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-xl">⚡</span>
            {rule.name}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Status Badge */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status:</span>
            <Badge variant={statusInfo.variant} className="gap-1">
              <StatusIcon className="h-3 w-3" />
              {statusInfo.label}
            </Badge>
            {rule.duration && (
              <span className="text-sm text-muted-foreground">• {(rule.duration / 1000).toFixed(2)}s</span>
            )}
          </div>

          {/* Step Results (if available) */}
          {rule.stepResults && Array.isArray(rule.stepResults) && rule.stepResults.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Execution Steps</h3>
              <div className="space-y-2">
                {rule.stepResults.map((step, index) => (
                  <StepCard
                    key={step.nodeId || index}
                    step={step}
                    stepNumber={index + 1}
                    isLast={index === rule.stepResults!.length - 1}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-muted-foreground mb-1">Action Type</div>
              <div className="font-medium">{formatActionType(rule.actionType)}</div>
            </div>
            <div>
              <div className="text-muted-foreground mb-1">Executed At</div>
              <div className="font-medium">{formatDateTime(rule.executedAt)}</div>
            </div>
            <div>
              <div className="text-muted-foreground mb-1">Duration</div>
              <div className="font-medium">{rule.duration ? `${(rule.duration / 1000).toFixed(2)}s` : "-"}</div>
            </div>
            <div>
              <div className="text-muted-foreground mb-1">Execution ID</div>
              <div className="font-medium">#{rule.id}</div>
            </div>
          </div>

          {/* Target ID */}
          {rule.targetId && (
            <div className="text-sm">
              <div className="text-muted-foreground mb-1">Target ID</div>
              <div className="flex items-center gap-2">
                <code className="bg-muted px-2 py-1 rounded text-xs">{rule.targetId}</code>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(rule.targetId!)}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}

          {/* Ad Account */}
          <div className="text-sm">
            <div className="text-muted-foreground mb-1">Ad Account</div>
            <div className="flex items-center gap-2">
              <code className="bg-muted px-2 py-1 rounded text-xs">{rule.accountId}</code>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(rule.accountId)}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Result ID (Success) */}
          {rule.resultId && (
            <div className="text-sm">
              <div className="text-muted-foreground mb-1">Result ID</div>
              <div className="flex items-center gap-2">
                <code className="bg-muted px-2 py-1 rounded text-xs">{rule.resultId}</code>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(rule.resultId!)}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              {facebookUrl && (
                <a href={facebookUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block">
                  <Button size="sm" className="gap-2 bg-blue-600 hover:bg-blue-700">
                    <ExternalLink className="h-3 w-3" />
                    {rule.actionType === "duplicate-adset" ? "View Ad Set" : "View Campaign"} in Ads Manager
                  </Button>
                </a>
              )}
            </div>
          )}

          {/* Error Message (Failed) */}
          {rule.errorMessage && (
            <div className="text-sm">
              <div className="text-muted-foreground mb-1">Error</div>
              <div className="bg-destructive/10 border border-destructive/20 rounded p-3 text-destructive text-xs">
                {rule.errorMessage}
              </div>
            </div>
          )}

          {/* Execution Logs */}
          {rule.executionLogs && Array.isArray(rule.executionLogs) && rule.executionLogs.length > 0 && (
            <Collapsible open={logsOpen} onOpenChange={setLogsOpen}>
              <div className="text-sm">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between px-0 h-8">
                    <span className="text-muted-foreground">Debug Logs ({rule.executionLogs.length} entries)</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${logsOpen ? "rotate-180" : ""}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          navigator.clipboard.writeText(rule.executionLogs!.join("\n"));
                          toast.success("Logs copied to clipboard");
                        }}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy Logs
                      </Button>
                    </div>
                    <pre className="overflow-x-auto rounded-md bg-gray-900 text-green-400 p-3 text-xs font-mono max-h-64 overflow-y-auto">
                      {rule.executionLogs.join("\n")}
                    </pre>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          )}

          {/* Owner */}
          {rule.userEmail && (
            <div className="text-sm">
              <div className="text-muted-foreground mb-1">Owner</div>
              <div className="font-medium">{rule.userEmail}</div>
            </div>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
