"use client";

import { useState, useEffect, useMemo } from "react";
import { CheckCircle2, XCircle, ExternalLink, Clock, FlaskConical, RefreshCw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { HistoryDetailDialog } from "./history-detail-dialog";
import { DataGrid, DataGridContainer } from "@/components/ui/data-grid";
import { DataGridColumnHeader } from "@/components/ui/data-grid-column-header";
import { DataGridTable } from "@/components/ui/data-grid-table";
import { DataGridPagination } from "@/components/ui/data-grid-pagination";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  ColumnDef,
  SortingState,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import { getAffectedAccountDisplay } from "./automation-history-account";

interface HistoryRule {
  id: number;
  name: string;
  actionType: string;
  targetId: string | null;
  accountId: string;
  accountName?: string | null;
  status: string;
  effectiveStatus?: string; // For launch-ad, reflects actual batch status
  batchStatus?: string | null;
  batchProcessed?: boolean | null;
  executed: boolean;
  executedAt: string | null;
  resultId: string | null;
  errorMessage: string | null;
  executionLogs: string[] | null;
  stepResults?: any[] | null;
  userEmail: string | null;
  scheduledDate: string;
  scheduledTime: string;
  duration: number | null;
  automationRuleId: number | null;
}

/**
 * Generate a short human-readable summary from step results.
 * Returns null if no meaningful summary can be generated.
 */
function getResultSummary(rule: HistoryRule): string | null {
  if (!rule.stepResults || !Array.isArray(rule.stepResults) || rule.stepResults.length === 0) return null;

  const parts: string[] = [];

  for (const step of rule.stepResults) {
    const outputs = step.outputs;
    if (!outputs) continue;
    const event = step.event || "";

    // Performance Threshold / Monitoring triggers
    if (outputs.qualifyingAdsCount !== undefined) {
      const count = outputs.qualifyingAdsCount;
      if (count > 0) {
        const adSetCount = outputs.qualifyingAdSetIds?.length;
        parts.push(
          `${count} ad${count !== 1 ? "s" : ""} matched${adSetCount ? ` across ${adSetCount} ad set${adSetCount !== 1 ? "s" : ""}` : ""}`,
        );
      } else {
        parts.push("No ads matched criteria");
      }
    } else if (outputs.qualifyingEntitiesCount !== undefined) {
      const count = outputs.qualifyingEntitiesCount;
      parts.push(`${count} entit${count !== 1 ? "ies" : "y"} matched`);
    }

    // Ad Approved trigger
    else if (outputs.approvedAdsCount !== undefined) {
      parts.push(`${outputs.approvedAdsCount} ad${outputs.approvedAdsCount !== 1 ? "s" : ""} approved`);
    }

    // Campaign Status Change trigger
    else if (outputs.matchingCount !== undefined && outputs.matchingCampaigns) {
      parts.push(`${outputs.matchingCount} campaign${outputs.matchingCount !== 1 ? "s" : ""} changed`);
    }

    // Google Drive folder trigger
    else if (outputs.folderName && outputs.fileCount !== undefined) {
      parts.push(`Folder "${outputs.folderName}" (${outputs.fileCount} file${outputs.fileCount !== 1 ? "s" : ""})`);
    }

    // Google Drive file trigger
    else if (outputs.assetName && step.stepType === "trigger") {
      parts.push(`File: ${outputs.assetName}`);
    }

    // Google Sheets trigger
    else if (outputs.rowCount !== undefined) {
      parts.push(`${outputs.rowCount} row${outputs.rowCount !== 1 ? "s" : ""} processed`);
    }

    // Duplicate actions
    else if (outputs.successfulCopies !== undefined) {
      parts.push(`${outputs.successfulCopies} duplicated`);
    }

    // Pause actions
    else if (outputs.pausedCount !== undefined) {
      const skipped = outputs.skippedCount || 0;
      parts.push(`${outputs.pausedCount} paused${skipped ? `, ${skipped} skipped` : ""}`);
    }

    // Enable actions
    else if (outputs.enabledCount !== undefined) {
      const skipped = outputs.skippedCount || 0;
      parts.push(`${outputs.enabledCount} enabled${skipped ? `, ${skipped} skipped` : ""}`);
    }

    // Upload to Media Library
    else if (outputs.uploadedCount !== undefined) {
      parts.push(`${outputs.uploadedCount} file${outputs.uploadedCount !== 1 ? "s" : ""} uploaded`);
    }

    // Launch Ad
    else if (outputs.adBatchId) {
      const adCount = outputs.adIds?.length || outputs.adCount;
      parts.push(`${adCount ? `${adCount} ad${adCount !== 1 ? "s" : ""} launched` : "Ad launched"}`);
    }

    // Budget change
    else if (outputs.updatedCount !== undefined) {
      parts.push(`${outputs.updatedCount} budget${outputs.updatedCount !== 1 ? "s" : ""} updated`);
    }

    // Rule Condition Check
    else if (outputs.matchingAdIds) {
      const count = outputs.matchingAdIds.length || outputs.matchingCount || 0;
      parts.push(`${count} ad${count !== 1 ? "s" : ""} matched rule`);
    }
  }

  return parts.length > 0 ? parts.join(" → ") : null;
}

interface AutomationHistoryProps {
  selectedHistoryId?: number | null;
  onClearHistoryId?: () => void;
  automationRuleId?: number | null; // Filter to show history for specific automation
  onClearAutomationRuleId?: () => void;
}

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }
};

const formatActionType = (type: string) => {
  const labels: Record<string, string> = {
    "duplicate-adset": "Duplicate Ad Set",
    "duplicate-campaign": "Duplicate Campaign",
    "duplicate-ad": "Duplicate Ad",
    "launch-campaign": "Launch",
    "launch-ad": "Launch Ad",
    "pause-campaign": "Pause",
  };
  return labels[type] || type;
};

const getStatusInfo = (rule: HistoryRule) => {
  // Use effectiveStatus for launch-ad actions (reflects actual batch status)
  const status = rule.effectiveStatus || rule.status;

  if (status === "test") {
    return { label: "Test Run", variant: "outline" as const, icon: FlaskConical, isProcessing: false };
  }
  if (status === "processing") {
    return { label: "Processing", variant: "secondary" as const, icon: RefreshCw, isProcessing: true };
  }
  if (status === "completed" || (rule.executed && !rule.errorMessage)) {
    return { label: "Success", variant: "success" as const, icon: CheckCircle2, isProcessing: false };
  }
  if (status === "failed" || rule.errorMessage) {
    return { label: "Failed", variant: "destructive" as const, icon: XCircle, isProcessing: false };
  }
  return { label: "Pending", variant: "secondary" as const, icon: Clock, isProcessing: false };
};

const getAdsManagerUrl = (rule: HistoryRule) => {
  if (!rule.resultId) return null;
  const accountId = rule.accountId != null ? String(rule.accountId).replace("act_", "") : undefined;
  if (rule.actionType === "duplicate-adset") {
    return `https://www.facebook.com/adsmanager/manage/adsets?act=${accountId}&selected_adset_ids=${rule.resultId}`;
  }
  return `https://www.facebook.com/adsmanager/manage/campaigns?act=${accountId}&selected_campaign_ids=${rule.resultId}`;
};

export function AutomationHistory({
  selectedHistoryId,
  onClearHistoryId,
  automationRuleId,
  onClearAutomationRuleId,
}: AutomationHistoryProps) {
  const [history, setHistory] = useState<HistoryRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRule, setSelectedRule] = useState<HistoryRule | null>(null);
  const [automationName, setAutomationName] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sorting, setSorting] = useState<SortingState>([{ id: "executedAt", desc: true }]);

  const fetchHistory = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setRefreshing(true);
    try {
      const url = automationRuleId
        ? `/api/automation-rules?history=true&automationRuleId=${automationRuleId}`
        : "/api/automation-rules?history=true";
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        const rules = data.rules || [];
        setHistory(rules);
        // Get automation name from first result if filtering
        if (automationRuleId && rules.length > 0) {
          setAutomationName(rules[0].name);
        }
      }
    } catch (error) {
      console.error("Failed to fetch automation history:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [automationRuleId]);

  // Auto-open dialog when historyId is provided from URL
  useEffect(() => {
    if (selectedHistoryId && history.length > 0 && !loading) {
      const rule = history.find((r) => r.id === selectedHistoryId);
      if (rule) {
        setSelectedRule(rule);
      }
    }
  }, [selectedHistoryId, history, loading]);

  const handleCloseDialog = (open: boolean) => {
    if (!open) {
      setSelectedRule(null);
      onClearHistoryId?.();
    }
  };

  // Filter history by search term
  const filteredHistory = useMemo(() => {
    if (!searchTerm) return history;
    const search = searchTerm.toLowerCase();
    return history.filter(
      (rule) =>
        rule.name.toLowerCase().includes(search) ||
        rule.actionType.toLowerCase().includes(search) ||
        formatActionType(rule.actionType).toLowerCase().includes(search) ||
        rule.accountId.toLowerCase().includes(search) ||
        rule.accountName?.toLowerCase().includes(search) ||
        rule.resultId?.toLowerCase().includes(search) ||
        rule.userEmail?.toLowerCase().includes(search) ||
        String(rule.id).includes(search),
    );
  }, [history, searchTerm]);

  // Define columns for DataGrid
  const columns = useMemo<ColumnDef<HistoryRule>[]>(
    () => [
      {
        accessorKey: "id",
        header: ({ column }) => <DataGridColumnHeader column={column} title="ID" />,
        cell: ({ row }) => <span className="text-muted-foreground font-mono text-sm">#{row.original.id}</span>,
        size: 80,
        enableSorting: true,
        meta: { headerTitle: "ID" },
      },
      {
        accessorKey: "name",
        header: ({ column }) => <DataGridColumnHeader column={column} title="Name" />,
        cell: ({ row }) => (
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-100 to-yellow-200 shadow-sm shrink-0">
              <span className="text-base">⚡</span>
            </div>
            <span className="font-medium truncate">{row.original.name}</span>
          </div>
        ),
        size: 250,
        enableSorting: true,
        meta: { headerTitle: "Name" },
      },
      {
        accessorKey: "actionType",
        header: ({ column }) => <DataGridColumnHeader column={column} title="Action" />,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{formatActionType(row.original.actionType)}</span>
        ),
        size: 140,
        enableSorting: true,
        meta: { headerTitle: "Action" },
      },
      {
        id: "account",
        accessorFn: (row) => getAffectedAccountDisplay(row).title,
        header: ({ column }) => <DataGridColumnHeader column={column} title="Ad Account" />,
        cell: ({ row }) => {
          const accountDisplay = getAffectedAccountDisplay(row.original);
          return (
            <div className="min-w-0" title={accountDisplay.title}>
              <div className="truncate text-sm text-muted-foreground">{accountDisplay.primary}</div>
              {accountDisplay.secondary && (
                <div className="truncate font-mono text-xs text-muted-foreground/70">{accountDisplay.secondary}</div>
              )}
            </div>
          );
        },
        size: 180,
        enableSorting: true,
        meta: { headerTitle: "Ad Account" },
      },
      {
        id: "status",
        accessorFn: (row) => row.effectiveStatus || row.status,
        header: ({ column }) => <DataGridColumnHeader column={column} title="Status" />,
        cell: ({ row }) => {
          const statusInfo = getStatusInfo(row.original);
          const StatusIcon = statusInfo.icon;
          return (
            <div className="flex items-center gap-2">
              <Badge variant={statusInfo.variant} className="gap-1">
                <StatusIcon className={cn("h-3 w-3", statusInfo.isProcessing && "animate-spin")} />
                {statusInfo.label}
              </Badge>
              {statusInfo.isProcessing && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    fetchHistory(true);
                  }}
                  className="p-1 rounded hover:bg-muted transition-colors"
                  title="Refresh status"
                  disabled={refreshing}
                >
                  <RefreshCw className={cn("h-3.5 w-3.5 text-muted-foreground", refreshing && "animate-spin")} />
                </button>
              )}
            </div>
          );
        },
        size: 130,
        enableSorting: true,
        meta: { headerTitle: "Status" },
      },
      {
        accessorKey: "executedAt",
        header: ({ column }) => <DataGridColumnHeader column={column} title="Executed" />,
        cell: ({ row }) => <span className="text-sm text-muted-foreground">{formatDate(row.original.executedAt)}</span>,
        size: 120,
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          const a = rowA.original.executedAt ? new Date(rowA.original.executedAt).getTime() : 0;
          const b = rowB.original.executedAt ? new Date(rowB.original.executedAt).getTime() : 0;
          return a - b;
        },
        meta: { headerTitle: "Executed" },
      },
      {
        accessorKey: "userEmail",
        header: ({ column }) => <DataGridColumnHeader column={column} title="User" />,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground truncate">{row.original.userEmail || "-"}</span>
        ),
        size: 150,
        enableSorting: true,
        meta: { headerTitle: "User" },
      },
      {
        id: "result",
        header: ({ column }) => <DataGridColumnHeader column={column} title="Result / Error" />,
        cell: ({ row }) => {
          const rule = row.original;
          if (rule.resultId) {
            return (
              <a
                href={getAdsManagerUrl(rule) || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary hover:text-primary/80 hover:underline font-mono text-sm transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                {rule.resultId}
                <ExternalLink className="h-3 w-3" />
              </a>
            );
          }
          if (rule.status === "test") {
            return <span className="text-muted-foreground text-sm italic">Test run - no changes</span>;
          }
          if (rule.errorMessage) {
            return (
              <span className="text-destructive text-sm truncate max-w-[200px] block" title={rule.errorMessage}>
                {rule.errorMessage}
              </span>
            );
          }
          const summary = getResultSummary(rule);
          if (summary) {
            return (
              <span className="text-sm text-muted-foreground truncate max-w-[250px] block" title={summary}>
                {summary}
              </span>
            );
          }
          return <span className="text-muted-foreground">-</span>;
        },
        size: 200,
        enableSorting: false,
        meta: { headerTitle: "Result / Error" },
      },
    ],
    [refreshing],
  );

  // Create table instance
  const table = useReactTable({
    data: filteredHistory,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    columnResizeMode: "onChange",
    getRowId: (row) => String(row.id),
    initialState: {
      pagination: { pageSize: 25 },
    },
  });

  // Handle row click
  const handleRowClick = (rule: HistoryRule) => {
    setSelectedRule(rule);
  };

  // Header JSX - inlined to prevent focus loss on re-render
  const headerContent = (
    <div className="px-4 py-4 md:px-8 md:py-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold md:text-3xl text-foreground">Execution History</h1>
          {automationRuleId && automationName && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-muted-foreground">
                Showing history for: <span className="font-medium text-foreground">{automationName}</span>
              </span>
              <button onClick={() => onClearAutomationRuleId?.()} className="text-xs text-primary hover:underline">
                Show all
              </button>
            </div>
          )}
        </div>
        {/* Search and Refresh */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 md:w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, action, account..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-10 bg-background"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-10 px-4 shrink-0"
            onClick={() => fetchHistory(true)}
            disabled={refreshing}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>
    </div>
  );

  // Skeleton component for loading state
  const TableSkeleton = () => (
    <div className="px-4 md:px-8 pb-6">
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 space-y-3">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} className="flex items-center gap-4 py-2">
              <Skeleton className="h-4 w-12" />
              <div className="flex items-center gap-2 flex-1">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <Skeleton className="h-5 w-40" />
              </div>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-32" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Mobile skeleton
  const MobileSkeleton = () => (
    <div className="md:hidden flex-1 overflow-auto space-y-3 p-4">
      {Array.from({ length: 5 }).map((_, idx) => (
        <div key={idx} className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-5 w-32" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <div className="space-y-2 pl-10">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
      ))}
    </div>
  );

  if (loading) {
    return (
      <div className="flex h-full flex-col bg-background">
        {headerContent}
        {/* Mobile skeleton */}
        <MobileSkeleton />
        {/* Desktop skeleton */}
        <div className="hidden md:block">
          <TableSkeleton />
        </div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="flex h-full flex-col bg-background">
        {headerContent}
        <div className="flex flex-col items-center justify-center py-20 text-center px-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-md">
              <span className="text-lg text-white">📜</span>
            </div>
          </div>
          <h3 className="text-lg font-semibold mb-2">No execution history</h3>
          <p className="text-sm text-muted-foreground max-w-xs">Automations that have been executed will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      {headerContent}

      {/* Mobile view */}
      <div className="md:hidden flex-1 overflow-auto space-y-3 p-4">
        {filteredHistory.map((rule) => {
          const statusInfo = getStatusInfo(rule);
          const StatusIcon = statusInfo.icon;
          const accountDisplay = getAffectedAccountDisplay(rule);
          return (
            <div
              key={rule.id}
              className="rounded-xl border border-border bg-card p-4 cursor-pointer hover:bg-muted/40 transition-colors shadow-sm"
              onClick={() => setSelectedRule(rule)}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-mono">#{rule.id}</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-100 to-yellow-200 shadow-sm">
                    <span className="text-base">⚡</span>
                  </div>
                  <span className="font-medium">{rule.name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant={statusInfo.variant} className="gap-1">
                    <StatusIcon className={cn("h-3 w-3", statusInfo.isProcessing && "animate-spin")} />
                    {statusInfo.label}
                  </Badge>
                  {statusInfo.isProcessing && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        fetchHistory(true);
                      }}
                      className="p-1 rounded hover:bg-muted transition-colors"
                      disabled={refreshing}
                    >
                      <RefreshCw className={cn("h-3.5 w-3.5 text-muted-foreground", refreshing && "animate-spin")} />
                    </button>
                  )}
                </div>
              </div>
              <div className="text-sm text-muted-foreground space-y-1 pl-10">
                <div>Action: {formatActionType(rule.actionType)}</div>
                <div title={accountDisplay.title}>Ad Account: {accountDisplay.title}</div>
                <div>Executed: {formatDate(rule.executedAt)}</div>
                {rule.resultId && (
                  <div className="flex items-center gap-1">
                    Result: <span className="font-mono text-xs">{rule.resultId}</span>
                  </div>
                )}
                {rule.errorMessage && <div className="text-destructive truncate">Error: {rule.errorMessage}</div>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop DataGrid table */}
      <div className="hidden md:flex md:flex-col flex-1 px-8 pb-6 min-h-0 overflow-hidden">
        {filteredHistory.length === 0 && searchTerm ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No results found</h3>
            <p className="text-sm text-muted-foreground">No executions match "{searchTerm}"</p>
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <DataGrid
              table={table}
              recordCount={filteredHistory.length}
              isLoading={loading}
              onRowClick={handleRowClick}
              tableLayout={{
                columnsResizable: true,
                headerSticky: true,
                rowBorder: true,
              }}
              tableClassNames={{
                bodyRow: "cursor-pointer",
              }}
            >
              <DataGridContainer border className="rounded-xl bg-card overflow-hidden h-[calc(100vh-320px)]">
                <ScrollArea className="h-full w-full">
                  <DataGridTable />
                  <ScrollBar orientation="horizontal" />
                  <ScrollBar orientation="vertical" />
                </ScrollArea>
              </DataGridContainer>
              <DataGridPagination sizes={[10, 25, 50, 100]} />
            </DataGrid>
          </div>
        )}
      </div>

      <HistoryDetailDialog rule={selectedRule} open={!!selectedRule} onOpenChange={handleCloseDialog} />
    </div>
  );
}
