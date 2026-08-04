"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, X, Clock, ChevronRight, ShieldCheck, Inbox, RefreshCw, CheckCheck, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ApprovalReviewDialog } from "./approval-review-dialog";
import { TriggerMiniPreview } from "./trigger-media-preview";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface PendingApproval {
  id: number;
  approvalToken: string;
  pausedAtNodeId: string;
  pausedAtStep: number;
  pendingActions: any;
  status: string;
  expiresAt: string;
  createdAt: string;
  automationRule: {
    id: number;
    name: string;
  };
  execution: {
    id: number;
    name: string;
    executedAt: string;
    flow: any;
  };
  flowState?: any;
}

interface PendingApprovalsTabProps {
  onCountChange?: (count: number) => void;
}

export function PendingApprovalsTab({ onCountChange }: PendingApprovalsTabProps) {
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApproval, setSelectedApproval] = useState<PendingApproval | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState<"approve" | "reject" | null>(null);

  const fetchApprovals = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setRefreshing(true);
    try {
      const response = await fetch("/api/automation/approval/pending");
      const data = await response.json();
      if (data.approvals) {
        setApprovals(data.approvals);
        onCountChange?.(data.approvals.length);
      }
    } catch (error) {
      console.error("Failed to fetch pending approvals:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
    const interval = setInterval(() => fetchApprovals(), 30000);
    return () => clearInterval(interval);
  }, []);

  const handleQuickAction = async (approvalToken: string, action: "approve" | "reject", approvalId: number) => {
    setProcessingId(approvalId);
    try {
      const response = await fetch("/api/automation/approval", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: approvalToken, action }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(action === "approve" ? "Automation approved and resuming" : "Automation rejected");

        if (action === "approve") {
          await fetch("/api/automation/approval/resume", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ approvalToken }),
          });
        }

        setApprovals((prev) => prev.filter((a) => a.id !== approvalId));
        onCountChange?.(approvals.length - 1);
      } else {
        toast.error(result.error || "Action failed");
      }
    } catch (error) {
      toast.error("Failed to process action");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReviewClick = (approval: PendingApproval) => {
    setSelectedApproval(approval);
    setDialogOpen(true);
  };

  const handleDialogClose = (wasApproved: boolean) => {
    setDialogOpen(false);
    if (wasApproved && selectedApproval) {
      setApprovals((prev) => prev.filter((a) => a.id !== selectedApproval.id));
      onCountChange?.(approvals.length - 1);
    }
    setSelectedApproval(null);
  };

  // Get approvals eligible for bulk quick actions (excludes video required & ad limit exceeded)
  const bulkEligibleApprovals = approvals.filter((a) => {
    const pendingActions = Array.isArray(a.pendingActions) ? a.pendingActions : [];
    const isNeedsVideo = pendingActions[0]?.type === "axon_needs_video";
    const isAdLimitExceeded = pendingActions[0]?.type === "ad_limit_exceeded";
    return !isNeedsVideo && !isAdLimitExceeded;
  });

  const handleBulkAction = async (action: "approve" | "reject") => {
    if (bulkEligibleApprovals.length === 0) return;

    setBulkProcessing(action);
    let successCount = 0;
    let failCount = 0;

    for (const approval of bulkEligibleApprovals) {
      try {
        const response = await fetch("/api/automation/approval", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: approval.approvalToken, action }),
        });

        const result = await response.json();

        if (result.success) {
          if (action === "approve") {
            // Fire and forget resume - don't block the loop
            fetch("/api/automation/approval/resume", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ approvalToken: approval.approvalToken }),
            });
          }
          successCount++;
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }

    // Remove processed approvals from list
    const processedIds = new Set(bulkEligibleApprovals.map((a) => a.id));
    setApprovals((prev) => prev.filter((a) => !processedIds.has(a.id)));
    onCountChange?.(approvals.length - successCount);

    if (successCount > 0) {
      toast.success(
        `${successCount} automation${successCount !== 1 ? "s" : ""} ${action === "approve" ? "approved" : "rejected"}`,
      );
    }
    if (failCount > 0) {
      toast.error(`${failCount} action${failCount !== 1 ? "s" : ""} failed`);
    }

    setBulkProcessing(null);
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
            <ShieldCheck className="h-6 w-6 text-orange-500" />
            Pending Approvals
          </h2>
          <p className="text-muted-foreground mt-1">Review and approve automation requests before they execute</p>
        </div>
        <div className="flex items-center gap-2">
          {bulkEligibleApprovals.length > 1 && (
            <>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                    disabled={!!bulkProcessing}
                  >
                    <CheckCheck className="h-4 w-4 mr-1" />
                    Accept All ({bulkEligibleApprovals.length})
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Accept all pending approvals?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will approve and resume {bulkEligibleApprovals.length} automation
                      {bulkEligibleApprovals.length !== 1 ? "s" : ""}. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => handleBulkAction("approve")}
                    >
                      Accept All
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    disabled={!!bulkProcessing}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Reject All ({bulkEligibleApprovals.length})
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reject all pending approvals?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will reject {bulkEligibleApprovals.length} automation
                      {bulkEligibleApprovals.length !== 1 ? "s" : ""}. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-red-600 hover:bg-red-700"
                      onClick={() => handleBulkAction("reject")}
                    >
                      Reject All
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}

          <Button variant="outline" size="sm" onClick={() => fetchApprovals(true)} disabled={refreshing}>
            <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {approvals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Inbox className="h-8 w-8 text-muted-foreground" />
            </div>
            <CardTitle className="text-lg mb-2">No Pending Approvals</CardTitle>
            <CardDescription className="text-center max-w-sm">
              When automations with approval steps are triggered, they will appear here for review.
            </CardDescription>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Automation</TableHead>
                <TableHead>Triggered</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Pending Actions</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {approvals.map((approval) => {
                const expiresAt = new Date(approval.expiresAt);
                const isExpiringSoon = expiresAt.getTime() - Date.now() < 24 * 60 * 60 * 1000;
                const pendingActions = Array.isArray(approval.pendingActions) ? approval.pendingActions : [];
                const isNeedsVideo = pendingActions[0]?.type === "axon_needs_video";
                const isAdLimitExceeded = pendingActions[0]?.type === "ad_limit_exceeded";

                return (
                  <TableRow key={approval.id}>
                    <TableCell>
                      <div className="font-medium">{approval.automationRule.name}</div>
                      <div className="text-sm text-muted-foreground">Execution #{approval.execution.id}</div>
                      <TriggerMiniPreview flowState={approval.flowState} executionFlow={approval.execution.flow} />
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {formatDistanceToNow(new Date(approval.createdAt), {
                          addSuffix: true,
                        })}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(approval.createdAt), "MMM d, h:mm a")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Clock className={cn("h-4 w-4", isExpiringSoon ? "text-red-500" : "text-muted-foreground")} />
                        <div>
                          <div className={cn("text-sm", isExpiringSoon && "text-red-600 font-medium")}>
                            {formatDistanceToNow(expiresAt, {
                              addSuffix: true,
                            })}
                          </div>
                          {isExpiringSoon && (
                            <Badge variant="destructive" className="text-xs">
                              Expiring soon
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {isAdLimitExceeded ? (
                        <Badge variant="secondary" className="bg-red-100 text-red-700 border-red-200">
                          Ad Limit Exceeded
                        </Badge>
                      ) : isNeedsVideo ? (
                        <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-200">
                          Video Required
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          {pendingActions.length} action
                          {pendingActions.length !== 1 ? "s" : ""}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!isNeedsVideo && !isAdLimitExceeded && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => handleQuickAction(approval.approvalToken, "approve", approval.id)}
                            disabled={processingId === approval.id}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleQuickAction(approval.approvalToken, "reject", approval.id)}
                          disabled={processingId === approval.id}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleReviewClick(approval)}>
                          {isAdLimitExceeded ? "Manage Ads" : isNeedsVideo ? "Upload Video" : "Details"}
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <ApprovalReviewDialog approval={selectedApproval} open={dialogOpen} onClose={handleDialogClose} />
    </div>
  );
}
