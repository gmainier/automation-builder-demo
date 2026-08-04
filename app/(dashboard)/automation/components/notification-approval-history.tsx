"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Bell,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Mail,
  MessageSquare,
  RefreshCw,
  Search,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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

interface NotificationHistoryItem {
  id: string;
  type: "notification" | "approval";
  eventType: string;
  automationName: string;
  automationRuleId: number;
  executionId: number | null;
  channel?: string;
  recipient?: string;
  deliveryStatus?: string;
  approvalStatus?: string;
  resolvedBy?: string;
  summary?: string;
  createdAt: string;
}

interface NotificationApprovalHistoryProps {
  automationRuleId?: number | null;
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

const EVENT_LABELS: Record<string, string> = {
  execution_completed: "Execution Completed",
  execution_failed: "Execution Failed",
  approval_required: "Approval Required",
  approved: "Approved",
  rejected: "Rejected",
  expired: "Expired",
};

const getStatusBadge = (item: NotificationHistoryItem) => {
  if (item.type === "notification") {
    if (item.deliveryStatus === "sent") {
      return { label: "Sent", variant: "success" as const, icon: CheckCircle2 };
    }
    return { label: "Failed", variant: "destructive" as const, icon: XCircle };
  }

  // Approval
  switch (item.approvalStatus) {
    case "approved":
      return { label: "Approved", variant: "success" as const, icon: CheckCircle2 };
    case "rejected":
      return { label: "Rejected", variant: "destructive" as const, icon: XCircle };
    case "expired":
      return { label: "Expired", variant: "secondary" as const, icon: Clock };
    default:
      return { label: "Pending", variant: "outline" as const, icon: AlertTriangle };
  }
};

export function NotificationApprovalHistory({
  automationRuleId,
  onClearAutomationRuleId,
}: NotificationApprovalHistoryProps) {
  const [items, setItems] = useState<NotificationHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }]);

  const fetchHistory = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setRefreshing(true);
    try {
      const url = automationRuleId
        ? `/api/automation/notification-history?automationRuleId=${automationRuleId}`
        : "/api/automation/notification-history";
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setItems(data.items || []);
      }
    } catch (error) {
      console.error("Failed to fetch notification history:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [automationRuleId]);

  const filteredItems = useMemo(() => {
    if (!searchTerm) return items;
    const search = searchTerm.toLowerCase();
    return items.filter(
      (item) =>
        item.automationName.toLowerCase().includes(search) ||
        (EVENT_LABELS[item.eventType] || item.eventType).toLowerCase().includes(search) ||
        item.recipient?.toLowerCase().includes(search) ||
        item.channel?.toLowerCase().includes(search) ||
        item.resolvedBy?.toLowerCase().includes(search),
    );
  }, [items, searchTerm]);

  const columns = useMemo<ColumnDef<NotificationHistoryItem>[]>(
    () => [
      {
        accessorKey: "type",
        header: ({ column }) => <DataGridColumnHeader column={column} title="Type" />,
        cell: ({ row }) => {
          const isNotification = row.original.type === "notification";
          return (
            <Badge variant={isNotification ? "secondary" : "outline"} className="gap-1">
              {isNotification ? <Bell className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
              {isNotification ? "Notification" : "Approval"}
            </Badge>
          );
        },
        size: 140,
        enableSorting: true,
        meta: { headerTitle: "Type" },
      },
      {
        accessorKey: "automationName",
        header: ({ column }) => <DataGridColumnHeader column={column} title="Automation" />,
        cell: ({ row }) => (
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-100 to-yellow-200 shadow-sm shrink-0">
              <span className="text-base">&#9889;</span>
            </div>
            <span className="font-medium truncate">{row.original.automationName}</span>
          </div>
        ),
        size: 220,
        enableSorting: true,
        meta: { headerTitle: "Automation" },
      },
      {
        accessorKey: "eventType",
        header: ({ column }) => <DataGridColumnHeader column={column} title="Event" />,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {EVENT_LABELS[row.original.eventType] || row.original.eventType}
          </span>
        ),
        size: 170,
        enableSorting: true,
        meta: { headerTitle: "Event" },
      },
      {
        id: "channel",
        header: ({ column }) => <DataGridColumnHeader column={column} title="Channel / Recipient" />,
        cell: ({ row }) => {
          const item = row.original;
          if (item.type === "approval") {
            return <span className="text-sm text-muted-foreground">{item.resolvedBy || "-"}</span>;
          }
          return (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              {item.channel === "email" ? (
                <Mail className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <MessageSquare className="h-3.5 w-3.5 shrink-0" />
              )}
              <span className="truncate">{item.recipient || item.channel || "-"}</span>
            </div>
          );
        },
        size: 200,
        enableSorting: false,
        meta: { headerTitle: "Channel / Recipient" },
      },
      {
        id: "status",
        header: ({ column }) => <DataGridColumnHeader column={column} title="Status" />,
        cell: ({ row }) => {
          const statusInfo = getStatusBadge(row.original);
          const StatusIcon = statusInfo.icon;
          return (
            <Badge variant={statusInfo.variant} className="gap-1">
              <StatusIcon className="h-3 w-3" />
              {statusInfo.label}
            </Badge>
          );
        },
        size: 120,
        enableSorting: true,
        meta: { headerTitle: "Status" },
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => <DataGridColumnHeader column={column} title="Time" />,
        cell: ({ row }) => <span className="text-sm text-muted-foreground">{formatDate(row.original.createdAt)}</span>,
        size: 120,
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          const a = new Date(rowA.original.createdAt).getTime();
          const b = new Date(rowB.original.createdAt).getTime();
          return a - b;
        },
        meta: { headerTitle: "Time" },
      },
    ],
    [],
  );

  const table = useReactTable({
    data: filteredItems,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    columnResizeMode: "onChange",
    getRowId: (row) => row.id,
    initialState: {
      pagination: { pageSize: 25 },
    },
  });

  const headerContent = (
    <div className="px-4 py-4 md:px-8 md:py-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold md:text-3xl text-foreground">Notifications & Approvals</h1>
          {automationRuleId && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-muted-foreground">Filtered by automation rule #{automationRuleId}</span>
              <button onClick={() => onClearAutomationRuleId?.()} className="text-xs text-primary hover:underline">
                Show all
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="relative flex-1 md:w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, event, recipient..."
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

  const TableSkeleton = () => (
    <div className="px-4 md:px-8 pb-6">
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 space-y-3">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} className="flex items-center gap-4 py-2">
              <Skeleton className="h-6 w-24 rounded-full" />
              <div className="flex items-center gap-2 flex-1">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <Skeleton className="h-5 w-40" />
              </div>
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const MobileSkeleton = () => (
    <div className="md:hidden flex-1 overflow-auto space-y-3 p-4">
      {Array.from({ length: 5 }).map((_, idx) => (
        <div key={idx} className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-start justify-between mb-2">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
      ))}
    </div>
  );

  if (loading) {
    return (
      <div className="flex h-full flex-col bg-background">
        {headerContent}
        <MobileSkeleton />
        <div className="hidden md:block">
          <TableSkeleton />
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex h-full flex-col bg-background">
        {headerContent}
        <div className="flex flex-col items-center justify-center py-20 text-center px-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-md">
              <Bell className="h-5 w-5 text-white" />
            </div>
          </div>
          <h3 className="text-lg font-semibold mb-2">No notification history</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Notification deliveries and approval events will appear here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      {headerContent}

      {/* Mobile view */}
      <div className="md:hidden flex-1 overflow-auto space-y-3 p-4">
        {filteredItems.map((item) => {
          const statusInfo = getStatusBadge(item);
          const StatusIcon = statusInfo.icon;
          const isNotification = item.type === "notification";
          return (
            <div key={item.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between mb-2">
                <Badge variant={isNotification ? "secondary" : "outline"} className="gap-1">
                  {isNotification ? <Bell className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
                  {isNotification ? "Notification" : "Approval"}
                </Badge>
                <Badge variant={statusInfo.variant} className="gap-1">
                  <StatusIcon className="h-3 w-3" />
                  {statusInfo.label}
                </Badge>
              </div>
              <div className="text-sm space-y-1">
                <div className="font-medium">{item.automationName}</div>
                <div className="text-muted-foreground">{EVENT_LABELS[item.eventType] || item.eventType}</div>
                {item.recipient && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    {item.channel === "email" ? (
                      <Mail className="h-3.5 w-3.5" />
                    ) : (
                      <MessageSquare className="h-3.5 w-3.5" />
                    )}
                    <span className="truncate">{item.recipient}</span>
                  </div>
                )}
                {item.resolvedBy && <div className="text-muted-foreground">By: {item.resolvedBy}</div>}
                <div className="text-muted-foreground">{formatDate(item.createdAt)}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop DataGrid table */}
      <div className="hidden md:flex md:flex-col flex-1 px-8 pb-6 min-h-0 overflow-hidden">
        {filteredItems.length === 0 && searchTerm ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No results found</h3>
            <p className="text-sm text-muted-foreground">No notifications match &quot;{searchTerm}&quot;</p>
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <DataGrid
              table={table}
              recordCount={filteredItems.length}
              isLoading={loading}
              tableLayout={{
                columnsResizable: true,
                headerSticky: true,
                rowBorder: true,
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
    </div>
  );
}
