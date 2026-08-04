"use client";

import { useMemo, useRef, useState } from "react";
import { Flame, Loader2, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useUser } from "@/lib/providers/user-provider";
import {
  AD_AGE_METRIC,
  generateCustomEventMetrics,
  getMetricByValue,
  formatMetricValue,
  type AutomationMetric,
} from "@/types/automation-metrics";
import type { AutoScaleCriteria } from "@/types/auto-scale";
import { normalizeCriteriaConditions } from "@/lib/automation/criteria-groups";
import { useCustomMetrics } from "../../reports/_features/metrics";
import { useConversionTypes } from "../../reports/_features/report-data";

const CUSTOM_METRIC_PREFIX = "custom_";

function customMetricToAutomationMetric(cm: { id: string; name: string; renderFormat: string }): AutomationMetric {
  return {
    value: `${CUSTOM_METRIC_PREFIX}${cm.id}`,
    label: cm.name,
    group: "workspaceCustom",
    type: "number",
    isCurrency: cm.renderFormat === "CURRENCY",
    suffix: cm.renderFormat === "PERCENTAGE" ? "%" : "",
    goalDirection: "HIGHER",
    customMetricId: cm.id,
  };
}

interface PerformanceThresholdPreviewProps {
  config: Record<string, any>;
  setConfig: (updater: Record<string, any> | ((prev: Record<string, any>) => Record<string, any>)) => void;
}

const DEFAULT_CRITERIA: AutoScaleCriteria = {
  conditions: [{ metric: "spend", operator: ">", value: 0 }],
  logic: "AND",
  lookbackDays: 7,
  conversionEvent: "purchase",
};

/**
 * Compact, self-contained preview for the Performance Threshold trigger.
 * Shows cached `config.previewResults` and exposes a button to refresh the preview.
 */
export function PerformanceThresholdPreview({ config, setConfig }: PerformanceThresholdPreviewProps) {
  const { extendedUser, currentWorkspace } = useUser();
  const [elapsed, setElapsed] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const rawCriteria = (config.criteria as AutoScaleCriteria) || DEFAULT_CRITERIA;
  const effectiveCriteria: AutoScaleCriteria = {
    ...rawCriteria,
    conditions: normalizeCriteriaConditions(rawCriteria.conditions),
  };

  const customMetricsQuery = useCustomMetrics(currentWorkspace?.id ?? null);
  const customMetricsByPropertyName = useMemo(() => {
    const map = new Map<string, AutomationMetric>();
    for (const cm of customMetricsQuery.data?.customMetrics ?? []) {
      const m = customMetricToAutomationMetric(cm);
      map.set(m.value, m);
    }
    return map;
  }, [customMetricsQuery.data]);

  // Need accountIds here too so Pixel custom-conversion metrics (`custom:*`,
  // `custom_cost:*`) can resolve to friendly labels like "Cost per NcPurchase"
  // instead of rendering the raw `custom_cost:offsite_conversion.fb_pixel_custom.<id>` key.
  const accountIdsForLabels = useMemo<string[]>(() => {
    if (config.accountIds?.length > 0) return config.accountIds;
    if (config.accountId) return [config.accountId];
    return [];
  }, [config.accountIds, config.accountId]);

  const { conversionMetricOptions } = useConversionTypes(accountIdsForLabels, accountIdsForLabels.length > 0);
  const customEventMetricsByValue = useMemo(() => {
    const map = new Map<string, AutomationMetric>();
    for (const m of generateCustomEventMetrics(conversionMetricOptions)) {
      map.set(m.value, m);
    }
    return map;
  }, [conversionMetricOptions]);

  const previewMetrics: AutomationMetric[] = useMemo(() => {
    const seen = new Set<string>(["spend"]);
    for (const cond of effectiveCriteria.conditions) {
      if (cond.metric && cond.metric !== "adName") seen.add(cond.metric);
    }
    const out: AutomationMetric[] = [];
    for (const value of seen) {
      const builtin = getMetricByValue(value);
      if (builtin) {
        out.push(builtin);
        continue;
      }
      const workspaceCustom = customMetricsByPropertyName.get(value);
      if (workspaceCustom) {
        out.push(workspaceCustom);
        continue;
      }
      const customEvent = customEventMetricsByValue.get(value);
      if (customEvent) {
        out.push(customEvent);
        continue;
      }
      // Workspace custom metric placeholder (formula-based, `custom_<cuid>`)
      // not yet loaded — synthesize so the column renders with the property
      // name. The friendly name shows up once useCustomMetrics resolves.
      if (value.startsWith(CUSTOM_METRIC_PREFIX) && !value.includes(":")) {
        out.push({
          value,
          label: value,
          group: "workspaceCustom",
          type: "number",
          isCurrency: false,
          suffix: "",
          goalDirection: "HIGHER",
        });
        continue;
      }
      // Pixel custom-conversion placeholder (`custom:<actionType>` /
      // `custom_cost:<actionType>`) — useConversionTypes hasn't resolved yet
      // (or didn't return a label). Fall back to a humanized action_type so
      // the column header isn't the raw metric key.
      if (value.startsWith("custom:") || value.startsWith("custom_cost:")) {
        const isCost = value.startsWith("custom_cost:");
        const actionType = value.replace(/^custom(_cost)?:/, "");
        const friendly = actionType
          .replace(/^offsite_conversion\.fb_pixel_custom\./, "")
          .replace(/^offsite_conversion\.custom\./, "")
          .replace(/^offsite_conversion\.fb_pixel_/, "")
          .replace(/_/g, " ");
        out.push({
          value,
          label: isCost ? `Cost per ${friendly}` : friendly,
          group: "customEvent",
          type: "number",
          isCurrency: isCost,
          suffix: "",
          goalDirection: isCost ? "LOWER" : "HIGHER",
        });
      }
    }
    return out.slice(0, 3);
  }, [effectiveCriteria, customMetricsByPropertyName, customEventMetricsByValue]);

  const getAccountIds = (): string[] => {
    if (config.accountIds?.length > 0) return config.accountIds;
    if (config.accountId) return [config.accountId];
    const metaAccounts = (extendedUser?.settings || []).filter((s: any) => {
      if (s.workspaceId !== extendedUser?.defaultWorkspaceId || !s.businessId) return false;
      let type = s.type || (s.tikId ? "tiktok" : null);
      if (!type && s.businessId) type = s.businessId.startsWith("act_") ? "facebook" : "tiktok";
      return type === "facebook" || type === "meta";
    });
    const ids = metaAccounts
      .map((s: { businessId?: string | null }) => s.businessId)
      .filter((id: string | null | undefined): id is string => Boolean(id));
    return [...new Set<string>(ids)];
  };

  const buildPreviewParams = (accId: string) =>
    new URLSearchParams({
      accountId: accId,
      adSetNameFilter: config.adSetNameFilter || "*",
      adSetFilterType: config.adSetFilterType || "all",
      specificAdSetId: config.specificAdSetId || "",
      adStatusFilter: config.adStatusFilter || "all",
      criteria: JSON.stringify(effectiveCriteria),
      campaignNameFilterType: config.campaignNameFilterType || "all",
      campaignNameFilter: config.campaignNameFilter || "",
      adNameFilterType: config.adNameFilterType || "all",
      adNameFilter: config.adNameFilter || "",
      minSpendFilter: config.minSpendFilter ? String(config.minSpendFilter) : "",
    });

  const runPreview = async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;

    setElapsed(0);
    const startTime = Date.now();
    // 100ms tick → shows tenths of a second (e.g. "1.3s") so users see real-time feedback.
    const intervalId = setInterval(() => setElapsed(Math.round((Date.now() - startTime) / 100) / 10), 100);
    setConfig((prev) => ({ ...prev, previewLoading: true, previewError: null }));
    try {
      const ids = getAccountIds();
      if (ids.length === 0) {
        setConfig((prev) => ({
          ...prev,
          previewLoading: false,
          previewError: "No Meta accounts found",
          previewResults: null,
        }));
        return;
      }
      const fetchForAccount = async (accId: string) => {
        // Try BigQuery first — typically 10-30× faster than Meta insights over long lookbacks.
        try {
          const bqRes = await fetch("/api/automation-rules/preview-trigger-bq", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal,
            body: JSON.stringify({
              accountId: accId,
              criteria: effectiveCriteria,
              adSetFilterType: config.adSetFilterType,
              adSetNameFilter: config.adSetNameFilter,
              specificAdSetId: config.specificAdSetId,
              adNameFilterType: config.adNameFilterType,
              adNameFilter: config.adNameFilter,
              campaignNameFilterType: config.campaignNameFilterType,
              campaignNameFilter: config.campaignNameFilter,
              minSpendFilter: config.minSpendFilter,
              adStatusFilter: config.adStatusFilter,
            }),
          });
          if (bqRes.ok) {
            const bqJson = await bqRes.json();
            if (bqJson.bigQueryAvailable) {
              return { ...bqJson, source: "bigquery" };
            }
            // Fall through to Meta if BigQuery said "not fresh / not found"
          }
        } catch (e) {
          if (signal.aborted) throw e;
          // Swallow — fall back to Meta
        }

        const res = await fetch(`/api/automation-rules/preview-trigger?${buildPreviewParams(accId)}`, { signal });
        const raw = await res.text();
        if (!res.ok) {
          return {
            error:
              `HTTP ${res.status}` +
              (res.statusText ? ` ${res.statusText}` : "") +
              (raw ? ` — ${raw.slice(0, 200)}` : ""),
            source: "meta",
          };
        }
        try {
          return { ...JSON.parse(raw), source: "meta" };
        } catch {
          return { error: `Bad response from preview endpoint (${res.status}): ${raw.slice(0, 200)}`, source: "meta" };
        }
      };

      const results = await Promise.all(ids.map(fetchForAccount));

      if (signal.aborted) return;

      const combinedAds = results.flatMap((r) => r.qualifyingAds || []);
      const campaignMap = new Map<string, { id: string; name: string }>();
      for (const r of results) for (const c of r.matchedCampaigns || []) campaignMap.set(c.id, c);
      const totalChecked = results.reduce((sum, r) => sum + (r.totalAdsChecked || 0), 0);
      const firstError = results.find((r) => r.error);
      const warning = results.find((r) => r.warning)?.warning || null;
      const source = results.every((r) => r.source === "bigquery") ? "bigquery" : "meta";

      if (firstError && combinedAds.length === 0) {
        setConfig((prev) => ({
          ...prev,
          previewLoading: false,
          previewError: firstError.error,
          previewResults: null,
        }));
      } else {
        setConfig((prev) => ({
          ...prev,
          previewLoading: false,
          previewError: null,
          previewResults: {
            qualifyingAds: combinedAds,
            matchedCampaigns: [...campaignMap.values()],
            totalAdsChecked: totalChecked,
            warning,
            source,
          },
        }));
      }
    } catch (err) {
      if (signal.aborted) {
        if (abortRef.current === controller) {
          setConfig((prev) => ({ ...prev, previewLoading: false, previewError: null, previewResults: null }));
        }
        return;
      }
      setConfig((prev) => ({
        ...prev,
        previewLoading: false,
        previewError: err instanceof Error ? err.message : "Failed to fetch preview",
        previewResults: null,
      }));
    } finally {
      clearInterval(intervalId);
    }
  };

  const cancelPreview = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setConfig((prev) => ({ ...prev, previewLoading: false, previewError: null }));
  };

  const loading = !!config.previewLoading;
  const error: string | null = config.previewError || null;
  const results = config.previewResults as
    | {
        qualifyingAds?: any[];
        matchedCampaigns?: { id: string; name: string }[];
        totalAdsChecked?: number;
        warning?: string | null;
      }
    | null
    | undefined;
  const qualifyingAds = results?.qualifyingAds || [];
  const hasResults = !!results;

  return (
    <div className="space-y-2.5">
      {/* Primary CTA — the focus of this tab */}
      {loading ? (
        <div className="flex gap-2">
          <Button className="h-9 flex-1 gap-2" variant="outline" disabled>
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking matches · <span className="ml-1 tabular-nums">{elapsed.toFixed(1)}s</span>
          </Button>
          <Button data-testid="perf-threshold-cancel" onClick={cancelPreview} variant="outline" className="h-9 gap-1.5">
            <X className="h-3.5 w-3.5" /> Cancel
          </Button>
        </div>
      ) : (
        <Button
          data-testid="perf-threshold-check-matches"
          onClick={runPreview}
          className="h-9 w-full gap-2"
          variant={hasResults ? "outline" : "default"}
        >
          {hasResults ? (
            <>
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh preview
            </>
          ) : (
            <>
              <Flame className="h-4 w-4" />
              Preview matching ads
            </>
          )}
        </Button>
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] text-red-700">{error}</div>
      )}

      {results?.warning && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800">
          {results.warning}
        </div>
      )}

      {hasResults && (
        <div className="overflow-hidden rounded-md border bg-card">
          <div className="flex items-center justify-between border-b px-2.5 py-1.5 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-foreground">
                {qualifyingAds.length} matching {qualifyingAds.length === 1 ? "ad" : "ads"}
              </span>
              {(results as any).source && (
                <span
                  className={cn(
                    "rounded px-1 py-px text-[9px] font-semibold uppercase tracking-wide",
                    (results as any).source === "bigquery"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-muted text-muted-foreground",
                  )}
                  title={
                    (results as any).source === "bigquery"
                      ? "Served from BigQuery — fast path"
                      : "Served from Meta Graph API — fallback"
                  }
                >
                  {(results as any).source === "bigquery" ? "BQ" : "Meta"}
                </span>
              )}
            </div>
            {results.matchedCampaigns && results.matchedCampaigns.length > 0 && (
              <span className="text-muted-foreground">
                in {results.matchedCampaigns.length} {results.matchedCampaigns.length === 1 ? "campaign" : "campaigns"}
              </span>
            )}
          </div>

          {qualifyingAds.length === 0 ? (
            <div className="px-2.5 py-3 text-center text-[11px] text-muted-foreground">Nothing matches right now.</div>
          ) : (
            <table className="w-full text-[11px]">
              <thead className="bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-2 py-1 text-left font-medium">Ad</th>
                  {previewMetrics.map((m) => (
                    <th key={m.value} className="px-2 py-1 text-right font-medium">
                      {m.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {qualifyingAds.slice(0, 8).map((ad: any, idx: number) => (
                  <tr key={ad.adId || idx} className="border-t">
                    <td className="max-w-[140px] truncate px-2 py-1" title={ad.adName}>
                      {ad.adName}
                    </td>
                    {previewMetrics.map((m) => (
                      <td key={m.value} className="px-2 py-1 text-right tabular-nums">
                        {/* An unknown ad age must not display as "0 days" */}
                        {m.value === AD_AGE_METRIC && ad[m.value] == null
                          ? "—"
                          : formatMetricValue(ad[m.value] ?? 0, m, config.accountCurrency)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {qualifyingAds.length > 8 && (
            <div className="border-t px-2.5 py-1 text-center text-[10.5px] text-muted-foreground">
              + {qualifyingAds.length - 8} more
            </div>
          )}
        </div>
      )}
    </div>
  );
}
