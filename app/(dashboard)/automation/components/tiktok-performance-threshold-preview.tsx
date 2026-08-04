"use client";

import { useMemo, useRef, useState } from "react";
import { Flame, Loader2, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/providers/user-provider";
import { getMetricByValue, formatMetricValue, type AutomationMetric } from "@/types/automation-metrics";
import type { AutoScaleCriteria } from "@/types/auto-scale";
import { isTikTokPerformanceThresholdPreviewReady } from "../lib/tiktok-performance-threshold-gaps";
import { parseIncludeZeroDeliveryAds } from "@/lib/automation/tiktok-delivery-gate";

interface TikTokPerformanceThresholdPreviewProps {
  config: Record<string, any>;
  setConfig: (updater: Record<string, any> | ((prev: Record<string, any>) => Record<string, any>)) => void;
}

const DEFAULT_CRITERIA: AutoScaleCriteria = {
  conditions: [{ metric: "spend", operator: ">", value: 0 }],
  logic: "AND",
  conversionEvent: "omni_purchase",
  lookbackDays: 7,
};

function workspaceHasTikTokAccounts(extendedUser: ReturnType<typeof useUser>["extendedUser"]): boolean {
  if (!extendedUser?.settings || !extendedUser.defaultWorkspaceId) {
    return false;
  }

  return extendedUser.settings.some((setting: { workspaceId?: string | null; type?: string | null }) => {
    return setting.workspaceId === extendedUser.defaultWorkspaceId && setting.type === "tiktok";
  });
}

/**
 * Preview-tab companion for TikTok Performance Threshold.
 * Lists exact Setup gaps when incomplete; otherwise previews matching ads.
 */
export function TikTokPerformanceThresholdPreview({ config, setConfig }: TikTokPerformanceThresholdPreviewProps) {
  const { extendedUser } = useUser();
  const [elapsed, setElapsed] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const hasConnectedTikTokAccounts = useMemo(() => workspaceHasTikTokAccounts(extendedUser), [extendedUser]);
  const isReady = useMemo(
    () => isTikTokPerformanceThresholdPreviewReady(config, { hasConnectedTikTokAccounts }),
    [config, hasConnectedTikTokAccounts],
  );

  const effectiveCriteria = (config.criteria as AutoScaleCriteria) || DEFAULT_CRITERIA;

  const previewMetrics: AutomationMetric[] = useMemo(() => {
    const seen = new Set<string>(["spend"]);
    for (const condition of effectiveCriteria.conditions || []) {
      if (condition.metric && condition.metric !== "adName") {
        seen.add(condition.metric);
      }
    }
    const metrics: AutomationMetric[] = [];
    for (const value of seen) {
      const metric = getMetricByValue(value);
      if (metric) metrics.push(metric);
    }
    return metrics.slice(0, 3);
  }, [effectiveCriteria]);

  const runPreview = async (): Promise<void> => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;

    setElapsed(0);
    const startTime = Date.now();
    const intervalId = setInterval(() => setElapsed(Math.round((Date.now() - startTime) / 100) / 10), 100);
    setConfig((prev) => ({ ...prev, previewLoading: true, previewError: null }));

    try {
      const advertiserId = typeof config.advertiserId === "string" ? config.advertiserId : "";
      if (!advertiserId) {
        setConfig((prev) => ({
          ...prev,
          previewLoading: false,
          previewError: "Select a TikTok advertiser account in Setup",
          previewResults: null,
        }));
        return;
      }

      const params = new URLSearchParams({
        advertiserId,
        adGroupNameFilter: config.adGroupNameFilter || "",
        adGroupNameFilterType: config.adGroupNameFilterType || "all",
        adStatusFilter: config.adStatusFilter || "all",
        criteria: JSON.stringify(effectiveCriteria),
        campaignNameFilterType: config.campaignNameFilterType || "all",
        campaignNameFilter: config.campaignNameFilter || "",
        includeZeroDeliveryAds: parseIncludeZeroDeliveryAds(config.includeZeroDeliveryAds) ? "true" : "false",
      });

      const response = await fetch(`/api/automation-rules/preview-tiktok-trigger?${params}`, { signal });
      const result = await response.json();

      if (signal.aborted) return;

      if (result.error) {
        setConfig((prev) => ({
          ...prev,
          previewLoading: false,
          previewError: result.error,
          previewResults: null,
        }));
        return;
      }

      setConfig((prev) => ({
        ...prev,
        previewLoading: false,
        previewError: null,
        previewResults: {
          qualifyingAds: result.qualifyingAds || [],
          totalAdsChecked: result.totalAdsChecked || 0,
        },
      }));
    } catch (error) {
      if (signal.aborted) {
        if (abortRef.current === controller) {
          setConfig((prev) => ({ ...prev, previewLoading: false, previewError: null }));
        }
        return;
      }
      setConfig((prev) => ({
        ...prev,
        previewLoading: false,
        previewError: error instanceof Error ? error.message : "Failed to fetch preview",
        previewResults: null,
      }));
    } finally {
      clearInterval(intervalId);
    }
  };

  const cancelPreview = (): void => {
    abortRef.current?.abort();
    abortRef.current = null;
    setConfig((prev) => ({ ...prev, previewLoading: false, previewError: null }));
  };

  if (!isReady) {
    // StepPreview already lists exact gaps above this component.
    return null;
  }

  const loading = !!config.previewLoading;
  const error: string | null = config.previewError || null;
  const results = config.previewResults as { qualifyingAds?: any[]; totalAdsChecked?: number } | null | undefined;
  const qualifyingAds = results?.qualifyingAds || [];
  const hasResults = !!results;

  return (
    <div className="space-y-2.5">
      {loading ? (
        <div className="flex gap-2">
          <Button className="h-9 flex-1 gap-2" variant="outline" disabled>
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking matches · <span className="ml-1 tabular-nums">{elapsed.toFixed(1)}s</span>
          </Button>
          <Button onClick={cancelPreview} variant="outline" className="h-9 gap-1.5">
            <X className="h-3.5 w-3.5" /> Cancel
          </Button>
        </div>
      ) : (
        <Button onClick={runPreview} className="h-9 w-full gap-2" variant={hasResults ? "outline" : "default"}>
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

      {hasResults && (
        <div className="overflow-hidden rounded-md border bg-card">
          <div className="flex items-center justify-between border-b px-2.5 py-1.5 text-[11px]">
            <span className="font-semibold text-foreground">
              {qualifyingAds.length} matching {qualifyingAds.length === 1 ? "ad" : "ads"}
            </span>
            <span className="text-muted-foreground">of {results?.totalAdsChecked || 0} checked</span>
          </div>

          {qualifyingAds.length === 0 ? (
            <div className="px-2.5 py-3 text-center text-[11px] text-muted-foreground">Nothing matches right now.</div>
          ) : (
            <table className="w-full text-[11px]">
              <thead className="bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-2 py-1 text-left font-medium">Ad</th>
                  {previewMetrics.map((metric) => (
                    <th key={metric.value} className="px-2 py-1 text-right font-medium">
                      {metric.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {qualifyingAds.slice(0, 8).map((ad: any, index: number) => (
                  <tr key={ad.adId || index} className="border-t">
                    <td className="max-w-[140px] truncate px-2 py-1" title={ad.adName}>
                      {ad.adName}
                    </td>
                    {previewMetrics.map((metric) => (
                      <td key={metric.value} className="px-2 py-1 text-right tabular-nums">
                        {formatMetricValue(ad[metric.value] ?? 0, metric, config.accountCurrency)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
