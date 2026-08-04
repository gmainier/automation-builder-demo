"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Plus,
  MoreVertical,
  Trash2,
  History,
  Search,
  Star,
  Settings2,
  Archive,
  Copy,
  Download,
  Upload,
  RefreshCw,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ServiceIcon, getServiceInfo } from "../lib/service-icons";
import { normalizeAdscanEventForDisplay } from "../lib/adscan-events";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
import {
  buildAutomationExportBundle,
  createAutomationDuplicatePayload,
  createAutomationImportPayload,
  parseAutomationImportText,
} from "@/lib/automation/automation-import-export";
import { canManageAutomationRules } from "@/lib/automation/automation-access";
import { useUser } from "@/lib/providers/user-provider";
import { AutomationTemplatesContent } from "./automation-templates-tab";
import { mapRuleStatusToUiStatus, isRuleToggleDisabled } from "@/lib/automation/rule-status";
import { isStaffEmail } from "@/lib/auth/is-staff";
import { doesAutomationMatchSearch } from "./automations-table-filter";
import {
  buildAutomationRowKey,
  COMMENT_AUTOMATION_SOURCE,
  FLOW_AUTOMATION_SOURCE,
  mapCommentAutomationToTableRow,
  type AutomationTableSource,
  type CommentAutomationApiRule,
} from "../lib/map-comment-automation-to-table-row";

interface AutomationStep {
  service: string;
  event?: string;
}

const RATE_LIMIT_LOCK_HINT =
  "Paused after hitting Meta's rate limit. It unlocks automatically within 24h — contact Automation Builder to re-enable sooner.";

interface AutomationRule {
  rowKey: string;
  source: AutomationTableSource;
  id: number;
  name: string;
  steps: AutomationStep[];
  lastModified: Date;
  lastRun?: Date;
  status: "on" | "off" | "draft" | "archived";
  userEmail: string;
  userInitials: string;
  nodes: any[];
  accountId?: string;
  accountName?: string;
  runCount: number;
  favourite: boolean;
  rateLimited: boolean;
  pageId?: string;
}

type ApiAutomationRule = Record<string, unknown> & {
  readonly id?: number;
  readonly name?: string;
};

function downloadJsonFile(options: { readonly filename: string; readonly content: unknown }): void {
  const blob = new Blob([JSON.stringify(options.content, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = options.filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function getSafeFileName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Generate consistent color based on email string (lighter, softer colors)
function getUserColor(email: string): string {
  const colors = [
    "from-blue-400 to-blue-500",
    "from-emerald-400 to-emerald-500",
    "from-violet-400 to-violet-500",
    "from-amber-400 to-amber-500",
    "from-rose-400 to-rose-500",
    "from-teal-400 to-teal-500",
    "from-indigo-400 to-indigo-500",
    "from-sky-400 to-sky-500",
    "from-fuchsia-400 to-fuchsia-500",
    "from-lime-400 to-lime-500",
  ];

  // Hash the email to get a consistent index
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

const formatDate = (date: Date) => {
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
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
};

interface AutomationsTableCallbacks {
  onOpenAutomation: (id: number | string) => void;
}

interface AutomationsTableProps {
  callbacks: AutomationsTableCallbacks;
}

export function AutomationsTable({ callbacks }: AutomationsTableProps) {
  const { onOpenAutomation } = callbacks;
  const { extendedUser } = useUser();
  const canManageAutomations = canManageAutomationRules(extendedUser?.role);
  // Automation Builder staff can override a rate-limit lock (unlock a throttled rule);
  // regular users must wait for the 24h window to clear.
  const isStaffUser = isStaffEmail(extendedUser?.email);
  const isToggleLocked = (rule: Pick<AutomationRule, "status" | "rateLimited">): boolean =>
    isRuleToggleDisabled(rule.status) || (rule.rateLimited && !isStaffUser);
  const [automations, setAutomations] = useState<AutomationRule[]>([]);
  const [rawApiData, setRawApiData] = useState<ApiAutomationRule[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sorting, setSorting] = useState<SortingState>([{ id: "lastModified", desc: true }]);
  const [showFavourites, setShowFavourites] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [duplicatingIds, setDuplicatingIds] = useState<Set<number>>(new Set());

  // Fetch automations from API
  useEffect(() => {
    fetchAutomations();
  }, []);

  async function fetchAutomations() {
    try {
      const [flowResponse, commentResponse] = await Promise.all([
        fetch("/api/automation-rules"),
        fetch("/api/comment-automation-rules"),
      ]);

      const flowRows: AutomationRule[] = [];
      if (flowResponse.ok) {
        const data = await flowResponse.json();
        setRawApiData(data.rules || []);
        for (const rule of data.rules || []) {
          flowRows.push({
            rowKey: buildAutomationRowKey(FLOW_AUTOMATION_SOURCE, rule.id),
            source: FLOW_AUTOMATION_SOURCE,
            id: rule.id,
            name: rule.name,
            steps: extractStepsFromFlow(rule.flow),
            lastModified: new Date(rule.updatedAt),
            lastRun: rule.executedAt ? new Date(rule.executedAt) : undefined,
            status: mapRuleStatusToUiStatus(rule.status),
            userEmail: rule.userEmail || "",
            userInitials: rule.userEmail?.slice(0, 2).toUpperCase() || "U",
            nodes: rule.flow?.nodes || [],
            accountId: rule.accountId || null,
            accountName: rule.accountName || null,
            runCount: rule.runCount || 0,
            favourite: rule.favourite ?? false,
            rateLimited: rule.rateLimited === true,
          });
        }
      }

      const commentRows: AutomationRule[] = [];
      if (commentResponse.ok) {
        const commentData = await commentResponse.json();
        const commentRules = (commentData.rules || []) as CommentAutomationApiRule[];
        for (const rule of commentRules) {
          commentRows.push(mapCommentAutomationToTableRow(rule));
        }
      } else if (commentResponse.status !== 401) {
        // Soft-fail: keep flow automations visible if comments service is down.
        console.error("Failed to fetch comment automations:", commentResponse.status);
      }

      setAutomations([...flowRows, ...commentRows]);
    } catch (error) {
      console.error("Failed to fetch automations:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await fetchAutomations();
  }

  function getSelectedRawRules(): ApiAutomationRule[] {
    const selectedFlowIds = new Set(
      automations
        .filter((rule) => rule.source === FLOW_AUTOMATION_SOURCE && selectedIds.has(rule.rowKey))
        .map((rule) => rule.id),
    );
    return rawApiData.filter((rule) => typeof rule.id === "number" && selectedFlowIds.has(rule.id));
  }

  function handleExportSelected() {
    const selectedRules = getSelectedRawRules();
    if (selectedRules.length === 0) {
      toast.error("Select at least one flow automation to export (comment automations cannot be exported yet)");
      return;
    }

    const bundle = buildAutomationExportBundle({
      rules: selectedRules,
      exportedAt: new Date().toISOString(),
    });
    downloadJsonFile({
      filename: `app-automations-${selectedRules.length}.json`,
      content: bundle,
    });
    toast.success(`Exported ${selectedRules.length} automation${selectedRules.length === 1 ? "" : "s"}`);
  }

  function handleExportOne(id: number) {
    const rule = rawApiData.find((rawRule) => rawRule.id === id);
    if (!rule) {
      toast.error("Automation data is not ready yet");
      return;
    }

    const bundle = buildAutomationExportBundle({
      rules: [rule],
      exportedAt: new Date().toISOString(),
    });
    const fileName = getSafeFileName(rule.name || `automation-${id}`) || `automation-${id}`;
    downloadJsonFile({ filename: `${fileName}.json`, content: bundle });
    toast.success(`Exported "${rule.name || `Automation ${id}`}"`);
  }

  async function handleDuplicate(id: number) {
    if (!canManageAutomations) {
      toast.error("You do not have permission to manage automations");
      return;
    }

    const rule = rawApiData.find((rawRule) => rawRule.id === id);
    if (!rule) {
      toast.error("Automation data is not ready yet");
      return;
    }

    setDuplicatingIds((previousIds) => new Set(previousIds).add(id));

    try {
      const response = await fetch("/api/automation-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createAutomationDuplicatePayload(rule)),
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        const errorMessage =
          isRecord(errorBody) && typeof errorBody.error === "string"
            ? errorBody.error
            : "Failed to duplicate automation";
        throw new Error(errorMessage);
      }

      toast.success(`Duplicated "${rule.name || `Automation ${id}`}" as paused`);
      await fetchAutomations();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to duplicate automation");
    } finally {
      setDuplicatingIds((previousIds) => {
        const nextIds = new Set(previousIds);
        nextIds.delete(id);
        return nextIds;
      });
    }
  }

  function handleImportFile() {
    if (!canManageAutomations) {
      toast.error("You do not have permission to manage automations");
      return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const jsonText = String(reader.result || "");
          const importedRules = parseAutomationImportText(jsonText);
          const responses = await Promise.all(
            importedRules.map((rule) =>
              fetch("/api/automation-rules", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(createAutomationImportPayload(rule)),
              }),
            ),
          );
          const failedResponse = responses.find((response) => !response.ok);
          if (failedResponse) {
            const errorBody = await failedResponse.json().catch(() => null);
            const errorMessage =
              isRecord(errorBody) && typeof errorBody.error === "string"
                ? errorBody.error
                : "Failed to import automation bundle";
            throw new Error(errorMessage);
          }

          toast.success(
            `Imported ${importedRules.length} automation${importedRules.length === 1 ? "" : "s"} as paused`,
          );
          setSelectedIds(new Set());
          await fetchAutomations();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Invalid automation JSON");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  async function handleDelete(rule: AutomationRule) {
    if (!canManageAutomations) {
      toast.error("You do not have permission to manage automations");
      return;
    }

    try {
      const response =
        rule.source === COMMENT_AUTOMATION_SOURCE
          ? await fetch(`/api/comment-automation-rules?id=${rule.id}`, { method: "DELETE" })
          : await fetch(`/api/automation-rules?id=${rule.id}`, { method: "DELETE" });

      if (response.ok) {
        toast.success(`Deleted "${rule.name}"`);
        setAutomations((prev) => prev.filter((a) => a.rowKey !== rule.rowKey));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(rule.rowKey);
          return next;
        });
      } else {
        toast.error("Failed to delete automation");
      }
    } catch {
      toast.error("Failed to delete automation");
    }
  }

  // Extract all steps from flow nodes (showing ALL steps, not just unique services)
  function extractStepsFromFlow(flow: any): AutomationStep[] {
    if (!flow?.nodes) return [];
    return flow.nodes
      .filter((node: any) => node.service) // Only nodes with a service
      .map((node: any) => ({
        service: node.service,
        event: node.event,
      }));
  }

  const toggleSelection = (rowKey: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(rowKey)) {
      newSelection.delete(rowKey);
    } else {
      newSelection.add(rowKey);
    }
    setSelectedIds(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === automations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(automations.map((a) => a.rowKey)));
    }
  };

  const toggleAutomationStatus = async (rule: AutomationRule) => {
    if (!canManageAutomations) {
      toast.error("You do not have permission to manage automations");
      return;
    }

    // Defensive: the disabled toggle should already block this, but never let a
    // non-staff user re-enable a rate-limit-locked rule.
    if (isToggleLocked(rule)) {
      if (rule.rateLimited && !isStaffUser) toast.error(RATE_LIMIT_LOCK_HINT);
      return;
    }

    const currentStatus = rule.status;
    const newUiStatus = currentStatus === "on" ? "off" : "on";
    const newDbStatus = newUiStatus === "on" ? "active" : "paused";

    // Optimistic UI update
    setAutomations((prev) =>
      prev.map((auto) => {
        if (auto.rowKey === rule.rowKey) {
          return { ...auto, status: newUiStatus };
        }
        return auto;
      }),
    );

    try {
      const response =
        rule.source === COMMENT_AUTOMATION_SOURCE
          ? await fetch("/api/comment-automation-rules", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "toggle", id: rule.id }),
            })
          : await fetch("/api/automation-rules", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: rule.id, status: newDbStatus }),
            });
      if (!response.ok) {
        setAutomations((prev) =>
          prev.map((auto) => (auto.rowKey === rule.rowKey ? { ...auto, status: currentStatus } : auto)),
        );
      }
    } catch {
      setAutomations((prev) =>
        prev.map((auto) => (auto.rowKey === rule.rowKey ? { ...auto, status: currentStatus } : auto)),
      );
    }
  };

  const toggleFavourite = async (rule: AutomationRule) => {
    if (rule.source === COMMENT_AUTOMATION_SOURCE) {
      toast.message("Favourites are not available for comment automations yet");
      return;
    }

    if (!canManageAutomations) {
      toast.error("You do not have permission to manage automations");
      return;
    }

    const currentFavourite = rule.favourite;
    const newFavourite = !currentFavourite;

    // Optimistic UI update
    setAutomations((prev) =>
      prev.map((auto) => (auto.rowKey === rule.rowKey ? { ...auto, favourite: newFavourite } : auto)),
    );

    try {
      const response = await fetch("/api/automation-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rule.id, favourite: newFavourite }),
      });
      if (!response.ok) {
        setAutomations((prev) =>
          prev.map((auto) => (auto.rowKey === rule.rowKey ? { ...auto, favourite: currentFavourite } : auto)),
        );
      }
    } catch {
      setAutomations((prev) =>
        prev.map((auto) => (auto.rowKey === rule.rowKey ? { ...auto, favourite: currentFavourite } : auto)),
      );
    }
  };

  const archiveAutomation = async (rule: AutomationRule) => {
    if (rule.source === COMMENT_AUTOMATION_SOURCE) {
      toast.message("Archive is not available for comment automations yet");
      return;
    }

    if (!canManageAutomations) {
      toast.error("You do not have permission to manage automations");
      return;
    }

    const currentStatus = rule.status;
    const isArchived = currentStatus === "archived";
    const newUiStatus = isArchived ? "off" : "archived";
    const newDbStatus = isArchived ? "paused" : "archived";

    setAutomations((prev) =>
      prev.map((auto) => (auto.rowKey === rule.rowKey ? { ...auto, status: newUiStatus } : auto)),
    );

    try {
      const response = await fetch("/api/automation-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rule.id, status: newDbStatus }),
      });
      if (!response.ok) {
        setAutomations((prev) =>
          prev.map((auto) => (auto.rowKey === rule.rowKey ? { ...auto, status: currentStatus } : auto)),
        );
      }
    } catch {
      setAutomations((prev) =>
        prev.map((auto) => (auto.rowKey === rule.rowKey ? { ...auto, status: currentStatus } : auto)),
      );
    }
  };

  // Filter automations by search term + view settings
  const filteredAutomations = useMemo(() => {
    let filtered = automations;

    // Filter by view settings
    if (!showArchived) {
      filtered = filtered.filter((auto) => auto.status !== "archived");
    }
    if (showFavourites) {
      // Sort favourites to top (don't filter out non-favourites)
      filtered = [...filtered].sort((a, b) => {
        if (a.favourite && !b.favourite) return -1;
        if (!a.favourite && b.favourite) return 1;
        return 0;
      });
    }

    return filtered.filter((auto) => doesAutomationMatchSearch(auto, searchTerm));
  }, [automations, searchTerm, showFavourites, showArchived]);

  // Define columns for DataGrid
  const columns = useMemo<ColumnDef<AutomationRule>[]>(
    () => [
      {
        id: "select",
        header: () => (
          <Checkbox
            checked={selectedIds.size === automations.length && automations.length > 0}
            onCheckedChange={toggleSelectAll}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={selectedIds.has(row.original.rowKey)}
            onCheckedChange={() => toggleSelection(row.original.rowKey)}
            onClick={(e) => e.stopPropagation()}
          />
        ),
        size: 50,
        enableSorting: false,
        enableResizing: false,
      },
      {
        accessorKey: "id",
        header: ({ column }) => <DataGridColumnHeader column={column} title="ID" />,
        cell: ({ row }) => (
          <span className="text-muted-foreground font-mono text-sm">
            {row.original.source === COMMENT_AUTOMATION_SOURCE ? `C#${row.original.id}` : `#${row.original.id}`}
          </span>
        ),
        size: 80,
        minSize: 60,
        enableSorting: true,
        meta: { headerTitle: "ID" },
      },
      {
        accessorKey: "name",
        header: ({ column }) => <DataGridColumnHeader column={column} title="Name" />,
        cell: ({ row }) => (
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg shadow-sm shrink-0",
                row.original.source === COMMENT_AUTOMATION_SOURCE
                  ? "bg-gradient-to-br from-sky-100 to-cyan-200"
                  : "bg-gradient-to-br from-amber-100 to-yellow-200",
              )}
            >
              <span className="text-base">{row.original.source === COMMENT_AUTOMATION_SOURCE ? "💬" : "⚡"}</span>
            </div>
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="font-medium line-clamp-2 break-words">{row.original.name}</span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[400px]">
                  <p>{row.original.name}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        ),
        size: 350,
        minSize: 200,
        enableSorting: true,
        meta: { headerTitle: "Name", cellClassName: "!whitespace-normal" },
      },
      {
        id: "steps",
        header: "Steps",
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5 overflow-hidden max-w-[160px]">
            <TooltipProvider delayDuration={100}>
              {row.original.steps.map((step, idx) => {
                const info = getServiceInfo(step.service);
                return (
                  <Tooltip key={idx}>
                    <TooltipTrigger asChild>
                      <div
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-card shadow-sm flex-shrink-0 cursor-help"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ServiceIcon service={step.service} size={16} />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[220px] p-2">
                      <p className="font-semibold text-sm">{info.label}</p>
                      {step.event && (
                        <p className="text-sm text-foreground/80 mt-0.5">
                          {normalizeAdscanEventForDisplay(step.event)}
                        </p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </TooltipProvider>
          </div>
        ),
        size: 160,
        minSize: 80,
        enableSorting: false,
      },
      {
        accessorKey: "accountName",
        header: ({ column }) => <DataGridColumnHeader column={column} title="Ad Account" />,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground truncate max-w-[150px] block">
            {row.original.accountName || row.original.accountId || "-"}
          </span>
        ),
        size: 150,
        minSize: 100,
        enableSorting: true,
        meta: { headerTitle: "Ad Account" },
      },
      {
        accessorKey: "lastRun",
        header: ({ column }) => <DataGridColumnHeader column={column} title="Last Run" />,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.lastRun
              ? row.original.lastRun.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                })
              : "-"}
          </span>
        ),
        size: 140,
        minSize: 130,
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          const a = rowA.original.lastRun?.getTime() || 0;
          const b = rowB.original.lastRun?.getTime() || 0;
          return a - b;
        },
        meta: { headerTitle: "Last Run" },
      },
      {
        accessorKey: "runCount",
        header: ({ column }) => <DataGridColumnHeader column={column} title="Runs" />,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground tabular-nums">
            {row.original.runCount > 0 ? row.original.runCount.toLocaleString() : "-"}
          </span>
        ),
        size: 100,
        minSize: 90,
        enableSorting: true,
        meta: { headerTitle: "Runs" },
      },
      {
        accessorKey: "lastModified",
        header: ({ column }) => <DataGridColumnHeader column={column} title="Modified" />,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{formatDate(row.original.lastModified)}</span>
        ),
        size: 130,
        minSize: 120,
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          const a = rowA.original.lastModified.getTime();
          const b = rowB.original.lastModified.getTime();
          return a - b;
        },
        meta: { headerTitle: "Modified" },
      },
      {
        accessorKey: "status",
        header: ({ column }) => <DataGridColumnHeader column={column} title="Status" />,
        cell: ({ row }) => (
          <Switch
            checked={row.original.status === "on"}
            disabled={!canManageAutomations || isToggleLocked(row.original)}
            title={row.original.rateLimited && !isStaffUser ? RATE_LIMIT_LOCK_HINT : undefined}
            onCheckedChange={() => toggleAutomationStatus(row.original)}
            onClick={(e) => e.stopPropagation()}
          />
        ),
        size: 110,
        minSize: 100,
        enableSorting: true,
        meta: { headerTitle: "Status" },
      },
      {
        accessorKey: "userEmail",
        header: ({ column }) => <DataGridColumnHeader column={column} title="User" />,
        cell: ({ row }) => (
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br text-xs font-semibold text-white shadow-sm cursor-help",
                    getUserColor(row.original.userEmail),
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  {row.original.userInitials}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>{row.original.userEmail || "Unknown user"}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ),
        size: 100,
        minSize: 90,
        enableSorting: true,
        meta: { headerTitle: "User" },
      },
      {
        accessorKey: "favourite",
        header: "",
        cell: ({ row }) => (
          <button
            className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted transition-colors"
            disabled={!canManageAutomations || row.original.source === COMMENT_AUTOMATION_SOURCE}
            onClick={(e) => {
              e.stopPropagation();
              toggleFavourite(row.original);
            }}
          >
            <Star
              className={cn(
                "h-4 w-4 transition-colors",
                row.original.favourite
                  ? "fill-amber-400 text-amber-400"
                  : "text-muted-foreground/30 hover:text-muted-foreground/60",
              )}
            />
          </button>
        ),
        size: 50,
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          const a = rowA.original.favourite ? 1 : 0;
          const b = rowB.original.favourite ? 1 : 0;
          return a - b;
        },
        meta: { headerTitle: "Favourite" },
        enableResizing: false,
      },
      {
        id: "actions",
        cell: ({ row }) => {
          const isComment = row.original.source === COMMENT_AUTOMATION_SOURCE;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {!isComment && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExportOne(row.original.id);
                    }}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export JSON
                  </DropdownMenuItem>
                )}
                {canManageAutomations && !isComment && (
                  <DropdownMenuItem
                    disabled={duplicatingIds.has(row.original.id)}
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDuplicate(row.original.id);
                    }}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    {duplicatingIds.has(row.original.id) ? "Duplicating..." : "Duplicate"}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isComment) {
                      onOpenAutomation(`comment:${row.original.id}`);
                      return;
                    }
                    window.location.href = `/automation?tab=history&automationRuleId=${row.original.id}`;
                  }}
                >
                  <History className="mr-2 h-4 w-4" />
                  {isComment ? "Edit in Builder" : "View History"}
                </DropdownMenuItem>
                {canManageAutomations && (
                  <>
                    {!isComment && (
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          archiveAutomation(row.original);
                        }}
                      >
                        <Archive className="mr-2 h-4 w-4" />
                        {row.original.status === "archived" ? "Unarchive" : "Archive"}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(row.original);
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
        size: 50,
        enableSorting: false,
        enableResizing: false,
      },
    ],
    [selectedIds, automations.length, duplicatingIds, canManageAutomations, isStaffUser],
  );

  // Create table instance
  const table = useReactTable({
    data: filteredAutomations,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    columnResizeMode: "onChange",
    getRowId: (row) => row.rowKey,
    initialState: {
      pagination: { pageSize: 25 },
    },
  });

  // Handle row click — comment rules open in the flow builder with a comment:id.
  const handleRowClick = (automation: AutomationRule) => {
    if (automation.source === COMMENT_AUTOMATION_SOURCE) {
      onOpenAutomation(`comment:${automation.id}`);
      return;
    }
    onOpenAutomation(automation.id);
  };

  // Mobile card skeleton
  const MobileCardSkeleton = () => (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, idx) => (
        <div key={idx} className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-5 w-5 rounded" />
                <Skeleton className="h-5 w-32" />
              </div>
              <div className="flex items-center gap-2 mb-3">
                <Skeleton className="h-7 w-7 rounded" />
                <Skeleton className="h-7 w-7 rounded" />
              </div>
              <div className="flex items-center gap-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Skeleton className="h-8 w-8 rounded-md" />
              <Skeleton className="h-6 w-11 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  // Desktop table skeleton
  const TableSkeleton = () => (
    <div className="px-4 md:px-8 pb-6">
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 space-y-3">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} className="flex items-center gap-4 py-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-12" />
              <div className="flex items-center gap-2 flex-1">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <Skeleton className="h-5 w-40" />
              </div>
              <div className="flex gap-1">
                <Skeleton className="h-7 w-7 rounded" />
                <Skeleton className="h-7 w-7 rounded" />
              </div>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-6 w-11 rounded-full" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      {/* Header */}
      <div className="px-4 py-4 md:px-8 md:py-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h1 className="text-2xl font-semibold md:text-3xl text-foreground">My Automations</h1>
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 md:w-[300px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, account ID, user..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-10 bg-background"
              />
            </div>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleExportSelected}
                      className="relative h-10 w-10"
                      disabled={selectedIds.size === 0}
                      aria-label="Export selected automations"
                    >
                      <Download className="h-4 w-4" />
                      {selectedIds.size > 0 && (
                        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium leading-none text-primary-foreground">
                          {selectedIds.size}
                        </span>
                      )}
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>Export selected automations</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleImportFile}
                    className="h-10 w-10"
                    disabled={!canManageAutomations}
                    aria-label="Import automation JSON"
                  >
                    <Upload className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {canManageAutomations ? "Import automation JSON" : "Manage automation permission required"}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="h-10 w-10"
                    aria-label="Refresh automations"
                  >
                    <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refresh automations</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-10 px-4 gap-2">
                  <Settings2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Settings</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 p-2">
                <div className="flex items-center justify-between px-2 py-2 rounded-md hover:bg-muted transition-colors">
                  <div className="flex items-center gap-2.5">
                    <Star className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Show favourites</span>
                  </div>
                  <Switch checked={showFavourites} onCheckedChange={setShowFavourites} />
                </div>
                <div className="flex items-center justify-between px-2 py-2 rounded-md hover:bg-muted transition-colors">
                  <div className="flex items-center gap-2.5">
                    <Archive className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Show archived</span>
                  </div>
                  <Switch checked={showArchived} onCheckedChange={setShowArchived} />
                </div>
              </PopoverContent>
            </Popover>
            {canManageAutomations && (
              <Button onClick={() => onOpenAutomation("new")} className="h-10 px-4 gap-2 shadow-sm">
                <Plus className="h-5 w-5" />
                <span className="hidden sm:inline">Create</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile view */}
      <div className="flex-1 overflow-auto p-4 md:hidden">
        {loading ? (
          <MobileCardSkeleton />
        ) : automations.length === 0 ? (
          <div className="-m-4 flex min-h-full flex-col">
            <div className="px-4 pb-1 pt-4">
              <h2 className="text-lg font-semibold">Start with a template</h2>
              <p className="text-sm text-muted-foreground">Choose a template or create an automation from scratch.</p>
            </div>
            <AutomationTemplatesContent onUseTemplate={onOpenAutomation} />
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAutomations.map((automation) => (
              <div
                key={automation.rowKey}
                className="rounded-lg border border-border bg-card p-4"
                onClick={() => handleRowClick(automation)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-muted-foreground font-mono">
                        {automation.source === COMMENT_AUTOMATION_SOURCE ? `C#${automation.id}` : `#${automation.id}`}
                      </span>
                      <span className="text-lg">{automation.source === COMMENT_AUTOMATION_SOURCE ? "💬" : "⚡"}</span>
                      <span className="font-medium text-base">{automation.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mb-2 overflow-x-auto max-w-full scrollbar-hide">
                      <TooltipProvider delayDuration={100}>
                        {automation.steps.map((step, idx) => {
                          const info = getServiceInfo(step.service);
                          return (
                            <Tooltip key={idx}>
                              <TooltipTrigger asChild>
                                <div className="flex h-7 w-7 items-center justify-center rounded border border-border bg-background flex-shrink-0 cursor-help">
                                  <ServiceIcon service={step.service} size={16} />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="max-w-[220px] p-2">
                                <p className="font-semibold text-sm">{info.label}</p>
                                {step.event && (
                                  <p className="text-sm text-foreground/80 mt-0.5">
                                    {normalizeAdscanEventForDisplay(step.event)}
                                  </p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </TooltipProvider>
                    </div>
                    {(automation.accountName || automation.accountId) && (
                      <div className="text-xs text-muted-foreground mb-2">
                        {automation.accountName || automation.accountId}
                      </div>
                    )}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>Modified {formatDate(automation.lastModified)}</span>
                      {automation.lastRun && (
                        <span>
                          Run{" "}
                          {automation.lastRun.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true,
                          })}
                        </span>
                      )}
                      {automation.runCount > 0 && <span>{automation.runCount} runs</span>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted transition-colors"
                        disabled={!canManageAutomations || automation.source === COMMENT_AUTOMATION_SOURCE}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavourite(automation);
                        }}
                      >
                        <Star
                          className={cn(
                            "h-4 w-4 transition-colors",
                            automation.favourite ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30",
                          )}
                        />
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {canManageAutomations && automation.source === FLOW_AUTOMATION_SOURCE && (
                            <DropdownMenuItem
                              disabled={duplicatingIds.has(automation.id)}
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleDuplicate(automation.id);
                              }}
                            >
                              <Copy className="mr-2 h-4 w-4" />
                              {duplicatingIds.has(automation.id) ? "Duplicating..." : "Duplicate"}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              if (automation.source === COMMENT_AUTOMATION_SOURCE) {
                                onOpenAutomation(`comment:${automation.id}`);
                                return;
                              }
                              window.location.href = `/automation?tab=history&automationRuleId=${automation.id}`;
                            }}
                          >
                            <History className="mr-2 h-4 w-4" />
                            {automation.source === COMMENT_AUTOMATION_SOURCE ? "Edit in Builder" : "View History"}
                          </DropdownMenuItem>
                          {canManageAutomations && (
                            <>
                              {automation.source === FLOW_AUTOMATION_SOURCE && (
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    archiveAutomation(automation);
                                  }}
                                >
                                  <Archive className="mr-2 h-4 w-4" />
                                  {automation.status === "archived" ? "Unarchive" : "Archive"}
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(automation);
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <Switch
                      checked={automation.status === "on"}
                      disabled={!canManageAutomations || isToggleLocked(automation)}
                      title={automation.rateLimited && !isStaffUser ? RATE_LIMIT_LOCK_HINT : undefined}
                      onCheckedChange={() => {
                        toggleAutomationStatus(automation);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {!loading && automations.length > 0 && (
          <div className="mt-4 text-sm text-muted-foreground text-center">{filteredAutomations.length} automations</div>
        )}
      </div>

      {/* Desktop DataGrid Table */}
      <div className="hidden md:flex md:flex-col flex-1 px-8 pb-6 min-h-0 overflow-hidden">
        {loading ? (
          <TableSkeleton />
        ) : automations.length === 0 ? (
          <div className="-mx-8 -mb-6 flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="px-8 pb-1">
              <h2 className="text-lg font-semibold">Start with a template</h2>
              <p className="text-sm text-muted-foreground">Choose a template or create an automation from scratch.</p>
            </div>
            <AutomationTemplatesContent onUseTemplate={onOpenAutomation} />
          </div>
        ) : filteredAutomations.length === 0 && searchTerm ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No results found</h3>
            <p className="text-sm text-muted-foreground">No automations match "{searchTerm}"</p>
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <DataGrid
              table={table}
              recordCount={filteredAutomations.length}
              isLoading={loading}
              onRowClick={handleRowClick}
              tableLayout={{
                columnsResizable: true,
                headerSticky: true,
                rowBorder: true,
              }}
              tableClassNames={{
                bodyRow: "cursor-pointer group",
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
