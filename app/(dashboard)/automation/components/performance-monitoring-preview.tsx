"use client";

import { useState } from "react";
import { AlertTriangle, ExternalLink, Flame, Loader2, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Meta from "@/components/ui/icons/meta";
import type { AutomationNode } from "../contexts/automation-context";
import {
  buildPerformanceMonitoringDateRanges,
  DEFAULT_PERFORMANCE_MONITORING_RANGE_END_DAY,
  DEFAULT_PERFORMANCE_MONITORING_RANGE_START_DAY,
  formatLocalDateKey,
  normalizePerformanceMonitoringComparisonWindow,
  normalizePerformanceMonitoringWeekday,
} from "@/lib/automation/performance-monitoring-date-range";

interface PerformanceMonitoringPreviewProps {
  node: AutomationNode;
  selectedAccountId?: string;
  selectedAccountName?: string;
  flowName?: string;
}

interface DryRunResponse {
  matchedCount: number;
  firstRecordLabel: string | null;
  previewSource: "live" | "sample";
  triggerError: string | null;
  triggerData?: Record<string, any>;
}

/**
 * Dry-run preview for the Performance Monitoring trigger.
 * Hits the dry-run endpoint and shows which entities currently match — no debug logs.
 */
export function PerformanceMonitoringPreview({
  node,
  selectedAccountId,
  selectedAccountName,
  flowName,
}: PerformanceMonitoringPreviewProps) {
  const [state, setState] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "ready"; data: DryRunResponse }
    | { status: "error"; message: string }
  >({ status: "idle" });
  const [elapsed, setElapsed] = useState(0);

  const runPreview = async () => {
    setState({ status: "loading" });
    setElapsed(0);
    const startTime = Date.now();
    const intervalId = setInterval(() => setElapsed(Math.round((Date.now() - startTime) / 100) / 10), 100);
    try {
      const res = await fetch("/api/automation-rules/dry-run-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          triggerNode: node,
          // Minimal action so the endpoint still returns — we only care about trigger eval
          notificationNode: { config: { notificationMethod: "email", emailRecipients: [], customMessage: "" } },
          automationName: flowName || "Preview",
          selectedAccountId,
          selectedAccountName,
        }),
      });
      const raw = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(raw);
      } catch {
        setState({
          status: "error",
          message: `Bad response (HTTP ${res.status}): ${raw.slice(0, 200)}`,
        });
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
  const triggerData = ready?.triggerData || {};
  const entities: any[] = Array.isArray(triggerData.qualifyingEntities) ? triggerData.qualifyingEntities : [];
  const direction: string = (triggerData.monitoringDirection || "").toLowerCase();
  const DirIcon = direction === "increases" ? TrendingUp : TrendingDown;
  const level: string = (triggerData.monitoringLevel || node.config?.monitoringLevel || "campaign").toLowerCase();
  const metric: string = (triggerData.monitoringMetric || node.config?.monitoringMetric || "").toLowerCase();
  const currency: string = node.config?.accountCurrency || "USD";
  const accountIdRaw: string = selectedAccountId || node.config?.accountId || "";
  const accountIdClean = accountIdRaw.startsWith("act_") ? accountIdRaw.slice(4) : accountIdRaw;

  const levelLabel =
    level === "account" ? "Account" : level === "adset" ? "Ad Set" : level === "ad" ? "Ad" : "Campaign";

  // Comparison periods — shown even before the user runs the preview
  const comparisonWindow = normalizePerformanceMonitoringComparisonWindow(node.config?.monitoringComparisonWindow);
  const customStartDay = normalizePerformanceMonitoringWeekday(
    node.config?.monitoringCustomRangeStartDay,
    DEFAULT_PERFORMANCE_MONITORING_RANGE_START_DAY,
  );
  const customEndDay = normalizePerformanceMonitoringWeekday(
    node.config?.monitoringCustomRangeEndDay,
    DEFAULT_PERFORMANCE_MONITORING_RANGE_END_DAY,
  );
  const formatShortDate = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const formatDateKey = (dateKey: string) => formatShortDate(new Date(`${dateKey}T00:00:00`));
  const formatRange = (since: string, until: string) =>
    since === until ? formatDateKey(since) : `${formatDateKey(since)} – ${formatDateKey(until)}`;
  const fallbackDateRanges = buildPerformanceMonitoringDateRanges({
    today: formatLocalDateKey(new Date()),
    comparisonWindow,
    customStartDay,
    customEndDay,
  });
  const formatStoredRange = (storedRange: unknown, fallbackSince: string, fallbackUntil: string): string => {
    if (typeof storedRange !== "string") return formatRange(fallbackSince, fallbackUntil);
    const [since, until] = storedRange.split(" to ");
    return since && until ? formatRange(since, until) : formatRange(fallbackSince, fallbackUntil);
  };
  const currentPeriod = formatStoredRange(
    triggerData.currentPeriod,
    fallbackDateRanges.current.since,
    fallbackDateRanges.current.until,
  );
  const previousPeriod = formatStoredRange(
    triggerData.previousPeriod,
    fallbackDateRanges.previous.since,
    fallbackDateRanges.previous.until,
  );
  const comparisonLabel =
    typeof triggerData.comparisonLabel === "string" ? triggerData.comparisonLabel : fallbackDateRanges.label;

  const buildAdsManagerUrl = (entityId: string): string | null => {
    if (!accountIdClean || !entityId) return null;
    if (level === "campaign")
      return `https://www.facebook.com/adsmanager/manage/campaigns?act=${accountIdClean}&selected_campaign_ids=${entityId}`;
    if (level === "adset")
      return `https://www.facebook.com/adsmanager/manage/adsets?act=${accountIdClean}&selected_adset_ids=${entityId}`;
    if (level === "ad")
      return `https://www.facebook.com/adsmanager/manage/ads?act=${accountIdClean}&selected_ad_ids=${entityId}`;
    return `https://www.facebook.com/adsmanager/manage/accounts?act=${accountIdClean}`;
  };

  const formatValue = (v: number | string | null | undefined): string => {
    if (v == null || v === "") return "—";
    const n = typeof v === "string" ? parseFloat(v) : v;
    if (!Number.isFinite(n)) return String(v);
    const isCurrency = metric === "spend" || metric === "cpa" || metric === "cpm" || metric === "cpc";
    if (isCurrency) {
      const sym = currency === "GBP" ? "£" : currency === "EUR" ? "€" : "$";
      return `${sym}${n.toFixed(2)}`;
    }
    if (metric === "ctr") return `${n.toFixed(2)}%`;
    if (metric === "roas") return n.toFixed(2);
    if (metric === "impressions" || metric === "conversions") return Math.round(n).toLocaleString();
    return n.toFixed(2);
  };

  return (
    <div className="space-y-2.5">
      <Button
        data-testid="perf-monitoring-check-matches"
        onClick={runPreview}
        disabled={state.status === "loading"}
        className="h-9 w-full gap-2"
        variant={ready ? "outline" : "default"}
      >
        {state.status === "loading" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking matches · <span className="ml-1 tabular-nums">{elapsed.toFixed(1)}s</span>
          </>
        ) : ready ? (
          <>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </>
        ) : (
          <>
            <Flame className="h-4 w-4" />
            Check what matches right now
          </>
        )}
      </Button>

      {/* Comparison period — always visible so users know what's being compared */}
      <div className="rounded-md border bg-muted/30 px-2.5 py-2 text-[10.5px]">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Comparing · {comparisonLabel}
        </p>
        <div className="mt-1 flex items-center gap-2 tabular-nums text-foreground">
          <span className="font-medium">{currentPeriod}</span>
          <span className="text-muted-foreground">vs</span>
          <span className="font-medium">{previousPeriod}</span>
        </div>
      </div>

      {state.status === "error" && (
        <div className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] text-red-700">
          {state.message}
        </div>
      )}

      {ready?.triggerError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] text-red-700">
          {ready.triggerError}
        </div>
      )}

      {ready && !ready.triggerError && ready.matchedCount === 0 && (
        <>
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div>
              <p className="font-semibold">No matches right now</p>
              <p className="mt-0.5 text-amber-800">
                Nothing in <span className="font-medium">{selectedAccountName || "this account"}</span> crossed your
                threshold. The actual values being checked are below — entities with £0 simply had no spend in the
                period.
              </p>
            </div>
          </div>

          {Array.isArray(triggerData.evaluatedEntities) && triggerData.evaluatedEntities.length > 0 && (
            <div className="overflow-hidden rounded-md border bg-card">
              <div className="flex items-center justify-between border-b bg-muted/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <span>
                  {triggerData.evaluatedEntities.length} {levelLabel}
                  {triggerData.evaluatedEntities.length === 1 ? "" : "s"} evaluated · none matched
                </span>
                <span>{metric ? metric.toUpperCase() : ""}</span>
              </div>
              <ul className="divide-y">
                {triggerData.evaluatedEntities
                  .slice()
                  .sort((a: any, b: any) => Math.abs(b.percentageChange ?? 0) - Math.abs(a.percentageChange ?? 0))
                  .slice(0, 8)
                  .map((entity: any, i: number) => {
                    const change = Number(entity.percentageChange ?? 0);
                    const isDrop = change < 0;
                    const id = entity.entityId || entity.id || "";
                    const adsManagerUrl = buildAdsManagerUrl(id);
                    const status = entity.status as string | undefined;
                    return (
                      <li key={id || i} className="flex items-center gap-2 px-2.5 py-2">
                        <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-muted/60">
                          <Meta className="h-4 w-4" grayscale={false} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-[11.5px] font-medium text-foreground">
                              {entity.entityName || "—"}
                            </p>
                            {status && (
                              <span
                                className={cn(
                                  "rounded px-1 py-px text-[9px] font-semibold uppercase tracking-wide",
                                  status === "ACTIVE"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-muted text-muted-foreground",
                                )}
                              >
                                {status}
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-[10.5px] tabular-nums text-muted-foreground">
                            {formatValue(entity.previousValue)} → {formatValue(entity.currentValue)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              "inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums",
                              Math.abs(change) < 0.1
                                ? "text-muted-foreground"
                                : isDrop
                                  ? "text-red-600"
                                  : "text-emerald-600",
                            )}
                          >
                            <DirIcon className="h-3 w-3" />
                            {change > 0 ? "+" : ""}
                            {change.toFixed(1)}%
                          </span>
                          {adsManagerUrl && (
                            <a
                              href={adsManagerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                              title="Open in Ads Manager"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </li>
                    );
                  })}
              </ul>
              {triggerData.evaluatedEntities.length > 8 && (
                <div className="border-t px-2.5 py-1 text-center text-[10.5px] text-muted-foreground">
                  + {triggerData.evaluatedEntities.length - 8} more
                </div>
              )}
            </div>
          )}
        </>
      )}

      {ready && !ready.triggerError && ready.previewSource === "live" && (
        <>
          {/* Fallback single-match card — shows when the trigger returned a match
               with top-level fields (entityName / actualChange / ...) but no
               qualifyingEntities[] array. Normalized into a 1-row list. */}
          {entities.length === 0 && ready.matchedCount > 0 && triggerData.entityName && (
            <div className="overflow-hidden rounded-md border bg-card">
              <div className="flex items-center justify-between border-b bg-muted/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <span>1 {levelLabel} matching</span>
                <span>{metric ? metric.toUpperCase() : ""}</span>
              </div>
              <div className="flex items-center gap-2 px-2.5 py-2">
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-muted/60">
                  <Meta className="h-4 w-4" grayscale={false} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="rounded bg-muted px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {levelLabel}
                    </span>
                    <p className="truncate text-[11.5px] font-medium text-foreground">{triggerData.entityName}</p>
                  </div>
                  <p className="mt-0.5 text-[10.5px] tabular-nums text-muted-foreground">
                    {formatValue(triggerData.previousValue)} → {formatValue(triggerData.currentValue)}
                    {triggerData.entityId ? ` · ID ${triggerData.entityId}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {triggerData.actualChange != null && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums",
                        Number(triggerData.actualChange) < 0 ? "text-red-600" : "text-emerald-600",
                      )}
                    >
                      <DirIcon className="h-3 w-3" />
                      {Number(triggerData.actualChange) > 0 ? "+" : ""}
                      {Number(triggerData.actualChange).toFixed(1)}%
                    </span>
                  )}
                  {buildAdsManagerUrl(triggerData.entityId) && (
                    <a
                      href={buildAdsManagerUrl(triggerData.entityId) as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Open in Ads Manager"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Summary callout — only when there's no usable per-entity breakdown */}
          {entities.length === 0 && ready.matchedCount > 0 && !triggerData.entityName && triggerData.summary && (
            <div className="rounded-md border bg-card px-3 py-2">
              <p className="text-[11px] text-muted-foreground">
                {ready.matchedCount} match{ready.matchedCount === 1 ? "" : "es"}
              </p>
              <p className="mt-0.5 text-xs font-medium text-foreground">{triggerData.summary}</p>
            </div>
          )}

          {entities.length > 0 && (
            <div className="overflow-hidden rounded-md border bg-card">
              <div className="flex items-center justify-between border-b bg-muted/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <span>{entities.length === 1 ? `1 ${levelLabel}` : `${entities.length} ${levelLabel}s`} matching</span>
                <span>{metric ? metric.toUpperCase() : ""}</span>
              </div>
              <ul className="divide-y">
                {entities.slice(0, 8).map((entity: any, i: number) => {
                  const change = Number(entity.percentageChange ?? entity.actualChange ?? 0);
                  const isDrop = change < 0;
                  const name = entity.entityName || entity.name || "—";
                  const id = entity.entityId || entity.id || "";
                  const adsManagerUrl = buildAdsManagerUrl(id);
                  return (
                    <li key={id || i} className="flex items-center gap-2 px-2.5 py-2">
                      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-muted/60">
                        <Meta className="h-4 w-4" grayscale={false} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="rounded bg-muted px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {levelLabel}
                          </span>
                          <p className="truncate text-[11.5px] font-medium text-foreground">{name}</p>
                        </div>
                        <p className="mt-0.5 text-[10.5px] tabular-nums text-muted-foreground">
                          {formatValue(entity.previousValue)} → {formatValue(entity.currentValue)}
                          {id ? ` · ID ${id}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums",
                            isDrop ? "text-red-600" : "text-emerald-600",
                          )}
                        >
                          <DirIcon className="h-3 w-3" />
                          {change > 0 ? "+" : ""}
                          {change.toFixed(1)}%
                        </span>
                        {adsManagerUrl && (
                          <a
                            href={adsManagerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                            title="Open in Ads Manager"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {entities.length > 8 && (
                <div className="border-t px-2.5 py-1 text-center text-[10.5px] text-muted-foreground">
                  + {entities.length - 8} more
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
