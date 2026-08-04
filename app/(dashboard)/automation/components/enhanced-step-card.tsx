"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  CheckCircle2,
  XCircle,
  ChevronDown,
  ExternalLink,
  ArrowDownFromLine,
  Zap,
  Play,
  Clock,
  Loader2,
  Ban,
} from "lucide-react";
import { isEnhancedStepResult, type EnhancedStepResult } from "@/types/automation-execution";
import Image from "next/image";
import { AxonNeedsVideoCard } from "./axon-needs-video-card";
import { LaunchAdPreview } from "./launch-ad-preview";
import { normalizeAdscanEventForDisplay } from "../lib/adscan-events";

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

interface EnhancedStepCardProps {
  step: StepResult;
  stepNumber: number;
  isFirst: boolean;
  isLast: boolean;
  defaultExpanded?: boolean;
  onRefresh?: () => void;
}

// Terminal batch statuses that indicate processing is done
const TERMINAL_BATCH_STATUSES = ["Success", "Error", "Partial", "Partial Success", "Cancelled"];

/**
 * Hook to poll batch status for Launch Ad steps that are still processing.
 * Triggers onRefresh when the batch reaches a terminal status.
 */
function useBatchStatusPoller(adBatchId: string | undefined, batchStatus: string | undefined, onRefresh?: () => void) {
  const [pollingStatus, setPollingStatus] = useState<string | null>(null);
  const [polledAdIds, setPolledAdIds] = useState<string[] | null>(null);

  const poll = useCallback(async () => {
    if (!adBatchId) return;
    try {
      const res = await fetch(`/api/batch-status/${adBatchId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.adIds) && data.adIds.length > 0) {
        setPolledAdIds(data.adIds.map((id: unknown) => String(id)));
      }
      if (data.status && TERMINAL_BATCH_STATUSES.includes(data.status)) {
        setPollingStatus(data.status);
        onRefresh?.();
      }
    } catch {
      // Polling failure is non-critical
    }
  }, [adBatchId, onRefresh]);

  useEffect(() => {
    // Poll while the batch is processing OR until we've resolved the launched
    // ad IDs (the launcher persists them with the terminal status).
    if (!adBatchId || (batchStatus && polledAdIds)) return;

    const interval = setInterval(poll, 5000);
    poll(); // immediate first poll

    return () => clearInterval(interval);
  }, [adBatchId, batchStatus, polledAdIds, poll]);

  return { pollingStatus, polledAdIds };
}

// Format duration in a human-readable way
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

// Format value for display
function formatValue(value: any): string {
  if (value === null || value === undefined) return "-";
  if (Array.isArray(value)) {
    if (value.length === 0) return "(empty)";
    // Arrays of objects would otherwise render as "[object Object], [object Object]".
    // Prefer pulling a meaningful field or just showing the count.
    if (value.some((v) => v && typeof v === "object")) {
      const names = value.map((v: any) => v?.adName || v?.name || v?.title || v?.id || null).filter(Boolean);
      if (names.length === 0) return `${value.length} items`;
      if (names.length <= 3) return names.join(", ");
      return `${names.slice(0, 2).join(", ")} +${names.length - 2} more`;
    }
    if (value.length <= 3) return value.join(", ");
    return `${value.slice(0, 2).join(", ")} +${value.length - 2} more`;
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

// Build Meta filter_set parameter for one or more ad IDs
function buildMetaFilterSet(adIds: string[]): string {
  const quoted = adIds.map((id) => `%22${id}%22`).join(",");
  return `ADGROUP_SELECTED-STRING_SET%1EIN%1E[${quoted}]`;
}

// Build a platform-native ads-manager URL for a specific launched/matched ad
function buildAdsManagerUrl(
  platform: "meta" | "tiktok" | "snapchat" | "pinterest",
  accountId: string | undefined,
  adId: string | undefined,
  campaignId?: string,
  adGroupId?: string,
): string | null {
  if (!accountId || !adId) return null;
  const clean = String(accountId).replace(/^act_/, "");
  switch (platform) {
    case "meta": {
      const filterSet = buildMetaFilterSet([adId]);
      return `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${clean}&filter_set=${filterSet}&selected_ad_ids=${adId}`;
    }
    case "tiktok": {
      // TikTok Ads Manager ad URL — uses aadvid (ad account) + ad_ids
      const parts = [`aadvid=${clean}`, `ad_ids=[${adId}]`];
      if (campaignId) parts.push(`campaign_ids=[${campaignId}]`);
      if (adGroupId) parts.push(`adgroup_ids=[${adGroupId}]`);
      return `https://ads.tiktok.com/i18n/perf/ad?${parts.join("&")}`;
    }
    case "snapchat":
      return `https://ads.snapchat.com/${clean}/ads/${adId}`;
    case "pinterest":
      return `https://ads.pinterest.com/advertiser/${clean}/ads/?adId=${adId}`;
    default:
      return null;
  }
}

// Build a single Ads Manager URL that filters to ALL given ad IDs (batch view)
function buildBatchAdsManagerUrl(
  platform: "meta" | "tiktok" | "snapchat" | "pinterest",
  accountId: string | undefined,
  adIds: string[],
): string | null {
  if (!accountId || adIds.length === 0) return null;
  if (adIds.length === 1) return buildAdsManagerUrl(platform, accountId, adIds[0]);
  const clean = String(accountId).replace(/^act_/, "");
  switch (platform) {
    case "meta": {
      const filterSet = buildMetaFilterSet(adIds);
      return `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${clean}&filter_set=${filterSet}`;
    }
    case "tiktok": {
      const parts = [`aadvid=${clean}`, `ad_ids=[${adIds.join(",")}]`];
      return `https://ads.tiktok.com/i18n/perf/ad?${parts.join("&")}`;
    }
    default:
      return null;
  }
}

// Service icon component
function ServiceIcon({ service, className }: { service: string; className?: string }) {
  if (service === "meta-ads") {
    return (
      <div
        className={cn(
          "w-6 h-6 rounded bg-blue-600 flex items-center justify-center text-white text-xs font-bold",
          className,
        )}
      >
        M
      </div>
    );
  }
  if (service === "google-sheets") {
    return (
      <div
        className={cn(
          "w-6 h-6 rounded bg-green-600 flex items-center justify-center text-white text-xs font-bold",
          className,
        )}
      >
        G
      </div>
    );
  }
  return (
    <div
      className={cn(
        "w-6 h-6 rounded bg-gray-400 flex items-center justify-center text-white text-xs font-bold",
        className,
      )}
    >
      ?
    </div>
  );
}

// Status icon component
function StatusIcon({ status }: { status: string }) {
  if (status === "success") {
    return <CheckCircle2 className="h-5 w-5 text-green-600" />;
  }
  if (status === "failed") {
    return <XCircle className="h-5 w-5 text-red-600" />;
  }
  if (status === "skipped") {
    return <Ban className="h-5 w-5 text-amber-500" />;
  }
  return <div className="h-5 w-5 rounded-full bg-gray-300" />;
}

// Inputs display component
function StepInputsDisplay({ inputs, stepType }: { inputs: EnhancedStepResult["inputs"]; stepType: string }) {
  const config = inputs?.config || {};
  const configEntries = Object.entries(config).filter(([_, v]) => v !== undefined && v !== null);

  if (configEntries.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Inputs</h4>
      <div className="bg-muted/50 rounded-lg p-3 space-y-2">
        {configEntries.map(([key, value]) => (
          <div key={key} className="flex items-start gap-2 text-sm">
            <span className="text-muted-foreground min-w-[120px] capitalize">
              {key.replace(/([A-Z])/g, " $1").trim()}:
            </span>
            {key === "criteria" && typeof value === "object" ? (
              <CriteriaDisplay criteria={value} />
            ) : (
              <code className="bg-background px-1.5 py-0.5 rounded text-xs border flex-1 break-all">
                {formatValue(value)}
              </code>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Criteria display for trigger conditions
function CriteriaDisplay({ criteria }: { criteria: any }) {
  const conditions = Array.isArray(criteria?.conditions) ? criteria.conditions : [];
  if (conditions.length === 0) return <span className="text-muted-foreground">-</span>;

  return (
    <div className="flex flex-wrap gap-1">
      {conditions.map((c: any, i: number) => (
        <Badge key={i} variant="secondary" className="text-xs font-normal">
          {c.metric} {c.operator} {c.value}
        </Badge>
      ))}
      {criteria.lookbackDays && (
        <Badge variant="outline" className="text-xs font-normal">
          Last {criteria.lookbackDays} days
        </Badge>
      )}
    </div>
  );
}

// Data flow indicator
function DataFlowIndicator({ sources }: { sources: { nodeId: string; field: string; value: any }[] }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg text-sm">
      <ArrowDownFromLine className="h-4 w-4 text-blue-500 shrink-0" />
      <span className="text-blue-700">
        Using data from {sources.length === 1 ? "previous step" : `${sources.length} previous steps`}:
      </span>
      <div className="flex flex-wrap gap-1">
        {sources.map((s, i) => (
          <Badge key={i} variant="outline" className="bg-white text-xs">
            {s.field}: {Array.isArray(s.value) ? `${s.value.length} items` : formatValue(s.value)}
          </Badge>
        ))}
      </div>
    </div>
  );
}

// Launch Ad outputs with batch status polling
function LaunchAdOutputs({ outputs, onRefresh }: { outputs: Record<string, any>; onRefresh?: () => void }) {
  const outputAdIds = (outputs.adIds as string[] | undefined)?.filter(Boolean);
  // Poll batch status when we have a batch but not yet a terminal status OR the
  // launched ad IDs (the launcher captures them asynchronously after the ACK).
  const needsResolution = !!outputs.adBatchId && (!outputs.batchStatus || !outputAdIds?.length);
  const { pollingStatus, polledAdIds } = useBatchStatusPoller(
    needsResolution ? String(outputs.adBatchId) : undefined,
    outputs.batchStatus,
    onRefresh,
  );

  const batchStatus = outputs.batchStatus || pollingStatus;
  const adIds = outputAdIds?.length ? outputAdIds : (polledAdIds ?? undefined);
  const finalCount = outputs.finalAdCount ?? adIds?.length;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Outputs</h4>
      <div className="bg-muted/50 rounded-lg p-3 space-y-2">
        {outputs.adName && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Ad Name:</span>
            <span className="font-medium">{outputs.adName}</span>
          </div>
        )}
        {outputs.launchedCount !== undefined && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Submitted:</span>
            <span className="font-medium">{outputs.launchedCount}</span>
          </div>
        )}
        {finalCount !== undefined && finalCount > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Ads Created:</span>
            <span className="font-medium text-green-600">{finalCount}</span>
          </div>
        )}
        {outputs.failedCount !== undefined && outputs.failedCount > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Failed:</span>
            <span className="font-medium text-red-600">{outputs.failedCount}</span>
          </div>
        )}
        {batchStatus && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Batch Status:</span>
            <Badge
              variant="outline"
              className={cn(
                "text-xs",
                batchStatus === "Success" && "border-green-300 text-green-700 bg-green-50",
                batchStatus === "Error" && "border-red-300 text-red-700 bg-red-50",
                (batchStatus === "Partial" || batchStatus === "Partial Success") &&
                  "border-amber-300 text-amber-700 bg-amber-50",
              )}
            >
              {batchStatus}
            </Badge>
          </div>
        )}
        {!batchStatus && outputs.adBatchId && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Batch processing...</span>
          </div>
        )}
        {outputs.batchError && <div className="text-sm text-red-600">{outputs.batchError}</div>}
      </div>

      {/* Live Meta ad preview — renders the real launched ad(s) as a carousel */}
      {adIds && adIds.length > 0 && <LaunchAdPreview adIds={adIds} adName={outputs.adName} />}

      {/* Ad IDs with Ads Manager links */}
      {adIds && adIds.length > 0 && (
        <div className="space-y-1">
          {/* Batch view link — one link for all ads */}
          {adIds.length > 1 &&
            (() => {
              const batchUrl = buildBatchAdsManagerUrl("meta", outputs.accountId || outputs.adAccountId, adIds);
              return batchUrl ? (
                <a
                  href={batchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 p-2 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors text-sm text-blue-700 font-medium"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  View all {adIds.length} ads in Ads Manager
                </a>
              ) : null;
            })()}
          {adIds.slice(0, 5).map((adId: string) => {
            const adUrl = buildAdsManagerUrl("meta", outputs.accountId || outputs.adAccountId, adId);
            return (
              <a
                key={adId}
                href={adUrl || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-2 rounded-lg border bg-background hover:bg-muted/50 transition-colors text-sm"
              >
                <Badge variant="outline" className="text-xs">
                  ad
                </Badge>
                <span className="flex-1 truncate font-mono text-xs">{adId}</span>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
              </a>
            );
          })}
          {adIds.length > 5 && (
            <div className="text-center text-xs text-muted-foreground py-1">+{adIds.length - 5} more ads</div>
          )}
        </div>
      )}
    </div>
  );
}

// Skipped action outcome (e.g. Launch Ad skipped by cooldown / already launched)
function SkippedOutputs({ outputs }: { outputs: Record<string, any> }) {
  const reason = outputs.cooldownReason || "Already processed by this rule";
  const media = outputs.skippedMedia as string | undefined;
  const count = outputs.skippedCount as number | undefined;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Outcome</h4>
      <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3">
        <Ban className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="text-sm">
          <p className="font-medium text-amber-800">{count && count > 1 ? `Skipped ${count} ads` : "Launch skipped"}</p>
          <p className="mt-0.5 text-amber-700">
            {media ? (
              <>
                <span className="font-medium">{media}</span> — {reason}
              </>
            ) : (
              reason
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

// Outputs display component
function StepOutputsDisplay({
  outputs,
  stepType,
  onRefresh,
  adsManagerLink,
}: {
  outputs: Record<string, any>;
  stepType: string;
  onRefresh?: () => void;
  adsManagerLink?: string;
}) {
  // For triggers, show qualifying ads prominently (including when 0 matched)
  if (stepType === "trigger" && (outputs?.qualifyingAds !== undefined || outputs?.qualifyingAdsCount !== undefined)) {
    const qualifyingCount = outputs.qualifyingAdsCount ?? outputs.qualifyingAds?.length ?? 0;
    const hasAds = qualifyingCount > 0;

    return (
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Outputs</h4>
        <div className="space-y-3">
          {/* Summary stats */}
          <div className="flex gap-4 text-sm">
            {outputs.totalAdsChecked !== undefined && (
              <div>
                <span className="text-muted-foreground">Checked:</span>{" "}
                <span className="font-medium">{outputs.totalAdsChecked} ads</span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Matched:</span>{" "}
              <span className={cn("font-medium", hasAds ? "text-green-600" : "text-amber-600")}>
                {qualifyingCount} ads
              </span>
            </div>
          </div>

          {/* Message when no ads matched */}
          {!hasAds && outputs.message && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
              {outputs.message}
            </div>
          )}

          {/* Batch view link for all qualifying ads */}
          {hasAds &&
            outputs.qualifyingAds &&
            outputs.qualifyingAds.length > 1 &&
            (() => {
              const allAdIds = outputs.qualifyingAds.map((ad: any) => ad.adId).filter(Boolean);
              const batchUrl = buildBatchAdsManagerUrl("meta", outputs.accountId || outputs.accountIds?.[0], allAdIds);
              return batchUrl ? (
                <a
                  href={batchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 p-2 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors text-sm text-blue-700 font-medium"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  View all {allAdIds.length} ads in Ads Manager
                </a>
              ) : null;
            })()}

          {/* Qualifying ads list */}
          {hasAds && outputs.qualifyingAds && (
            <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
              {outputs.qualifyingAds.slice(0, 5).map((ad: any, i: number) => {
                const metaUrl = buildAdsManagerUrl("meta", outputs.accountId || outputs.accountIds?.[0], ad.adId);
                return (
                  <div key={ad.adId || i} className="flex items-center gap-3 p-2 text-sm">
                    {ad.thumbnailUrl && (
                      <Image
                        src={ad.thumbnailUrl}
                        alt=""
                        width={40}
                        height={40}
                        className="w-10 h-10 rounded object-cover bg-muted"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{ad.adName}</div>
                      <div className="flex gap-3 text-xs text-muted-foreground">
                        {ad.spend !== undefined && <span>Spend: ${ad.spend.toFixed(2)}</span>}
                        {ad.roas !== undefined && <span>Purchase ROAS: {ad.roas.toFixed(2)}</span>}
                        {ad.cpa !== undefined && ad.cpa > 0 && <span>CPA: ${ad.cpa.toFixed(2)}</span>}
                      </div>
                    </div>
                    {metaUrl && (
                      <a
                        href={metaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                        title="Open in Meta Ads Manager"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                );
              })}
              {outputs.qualifyingAds.length > 5 && (
                <div className="p-2 text-center text-xs text-muted-foreground">
                  +{outputs.qualifyingAds.length - 5} more ads
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // For actions, show operations/results
  if (stepType === "action") {
    // Skipped (cooldown / already launched) — show a clear outcome instead of
    // a misleading "launched" view or raw key/value rows.
    if (outputs.skippedCount !== undefined || outputs.cooldownReason || outputs.skippedMedia) {
      return <SkippedOutputs outputs={outputs} />;
    }

    // Axon "needs video" state — show upload card
    if (outputs.needsVideo && outputs.imageOnlyAds) {
      return (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Action Required</h4>
          <AxonNeedsVideoCard imageOnlyAds={outputs.imageOnlyAds} actionConfig={outputs.actionConfig || {}} />
        </div>
      );
    }

    // Launch Ad outputs (Meta)
    if (outputs.launchedCount !== undefined || outputs.adBatchId !== undefined) {
      return <LaunchAdOutputs outputs={outputs} onRefresh={onRefresh} />;
    }

    // Cross-channel Launch outputs (TikTok / Snapchat / Pinterest / Axon)
    if (Array.isArray(outputs.launchedAds) || outputs.successCount !== undefined) {
      const platformRaw = (outputs.platform as string | undefined)?.toLowerCase();
      const platform: "tiktok" | "snapchat" | "pinterest" | null =
        platformRaw === "tiktok" || platformRaw === "snapchat" || platformRaw === "pinterest" ? platformRaw : null;
      const accountId = outputs.accountId || outputs.advertiserId;
      const campaignId = outputs.campaignId;
      const adGroupId = outputs.adGroupId || outputs.adSetId;
      const launched: any[] = Array.isArray(outputs.launchedAds) ? outputs.launchedAds : [];
      const failed: any[] = Array.isArray(outputs.failedAds) ? outputs.failedAds : [];
      return (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Outputs</h4>
          <div className="space-y-2 rounded-lg bg-muted/50 p-3">
            <div className="flex gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Launched:</span>{" "}
                <span className="font-medium text-green-600">{outputs.successCount ?? launched.length}</span>
              </div>
              {typeof outputs.failedCount === "number" && outputs.failedCount > 0 && (
                <div>
                  <span className="text-muted-foreground">Failed:</span>{" "}
                  <span className="font-medium text-red-600">{outputs.failedCount}</span>
                </div>
              )}
              {typeof outputs.totalAds === "number" && (
                <div>
                  <span className="text-muted-foreground">Total:</span>{" "}
                  <span className="font-medium">{outputs.totalAds}</span>
                </div>
              )}
            </div>

            {/* Batch view link for cross-channel launches */}
            {launched.length > 1 &&
              platform &&
              (() => {
                const allAdIds = launched.map((ad: any) => ad.adId || ad.ad_id || ad.id).filter(Boolean);
                const batchUrl = buildBatchAdsManagerUrl(platform, accountId, allAdIds);
                const platformLabel =
                  platform === "tiktok" ? "TikTok" : platform === "snapchat" ? "Snapchat" : "Pinterest";
                return batchUrl ? (
                  <a
                    href={batchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 p-2 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors text-sm text-blue-700 font-medium"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    View all {allAdIds.length} ads in {platformLabel} Ads Manager
                  </a>
                ) : null;
              })()}

            {launched.length > 0 && (
              <div className="divide-y overflow-hidden rounded-md border bg-background">
                {launched.slice(0, 8).map((ad: any, i: number) => {
                  const adId = ad.adId || ad.ad_id || ad.id;
                  const name = ad.adName || ad.name || ad.ad_name || adId;
                  const url = platform ? buildAdsManagerUrl(platform, accountId, adId, campaignId, adGroupId) : null;
                  return (
                    <div key={adId || i} className="flex items-center gap-2 px-2.5 py-1.5 text-sm">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{name}</div>
                        {adId && <div className="truncate font-mono text-[10.5px] text-muted-foreground">{adId}</div>}
                      </div>
                      {url && (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                          title={`Open in ${platform === "tiktok" ? "TikTok" : platform === "snapchat" ? "Snapchat" : platform === "pinterest" ? "Pinterest" : ""} Ads Manager`}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  );
                })}
                {launched.length > 8 && (
                  <div className="px-2.5 py-1 text-center text-xs text-muted-foreground">
                    +{launched.length - 8} more
                  </div>
                )}
              </div>
            )}

            {failed.length > 0 && (
              <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs">
                <p className="mb-1 font-medium text-red-700">Failed:</p>
                <ul className="space-y-0.5">
                  {failed.slice(0, 5).map((f: any, i: number) => (
                    <li key={i} className="text-red-700">
                      <span className="font-medium">{f.adName || f.name || f.adId || "ad"}</span>
                      {f.error && <span className="text-red-600"> — {f.error}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      );
    }

    const operations = outputs.operations as
      | {
          sourceAdId: string;
          sourceAdName: string;
          copiedAdId?: string;
          copiedAdName?: string;
          status: string;
          error?: string;
          url?: string;
        }[]
      | undefined;

    // Duplicate Ad / Ad Set / Campaign outputs
    const hasDuplicateOutputs =
      outputs.successfulCopies !== undefined ||
      outputs.createdAdIds?.length > 0 ||
      (operations && operations.length > 0);

    if (hasDuplicateOutputs) {
      return (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Outputs</h4>
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            {outputs.successfulCopies !== undefined && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Successful:</span>
                <span className="font-medium text-green-600">{outputs.successfulCopies}</span>
              </div>
            )}
            {outputs.failedCopies !== undefined && outputs.failedCopies > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Failed:</span>
                <span className="font-medium text-red-600">{outputs.failedCopies}</span>
              </div>
            )}
            {outputs.createdAdIds?.length > 0 && (
              <div className="flex items-start gap-2 text-sm">
                <span className="text-muted-foreground">Created IDs:</span>
                <div className="flex flex-wrap gap-1">
                  {outputs.createdAdIds.slice(0, 3).map((id: string) => (
                    <code key={id} className="bg-background px-1.5 py-0.5 rounded text-xs border font-mono">
                      {id}
                    </code>
                  ))}
                  {outputs.createdAdIds.length > 3 && (
                    <span className="text-xs text-muted-foreground">+{outputs.createdAdIds.length - 3} more</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Batch view link — above individual operations */}
          {adsManagerLink && operations && operations.filter((op) => op.status === "success").length > 1 && (
            <a
              href={adsManagerLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 p-2 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors text-sm text-blue-700 font-medium"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View all {operations.filter((op) => op.status === "success").length} ads in Ads Manager
            </a>
          )}

          {/* Per-operation details */}
          {operations && operations.length > 0 && (
            <div className="space-y-1.5">
              {operations.map((op, i) => (
                <div
                  key={op.sourceAdId || i}
                  className={cn(
                    "flex items-start gap-2 p-2 rounded-lg border text-sm",
                    op.status === "success" ? "border-green-200 bg-green-50/50" : "border-red-200 bg-red-50/50",
                  )}
                >
                  {op.status === "success" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{op.sourceAdName || op.sourceAdId}</div>
                    {op.status === "success" && op.copiedAdName && (
                      <div className="text-xs text-green-700">
                        Created:{" "}
                        {op.url ? (
                          <a
                            href={op.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline inline-flex items-center gap-1"
                          >
                            {op.copiedAdName}
                            <ExternalLink className="h-3 w-3 inline" />
                          </a>
                        ) : (
                          op.copiedAdName
                        )}
                      </div>
                    )}
                    {op.status === "failed" && op.error && (
                      <div className="text-xs text-red-600 mt-0.5">{op.error}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
  }

  // Generic output display for legacy format
  const entries = Object.entries(outputs).filter(
    ([k, v]) => v !== undefined && v !== null && !["qualifyingAds", "operations"].includes(k),
  );

  if (entries.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Outputs</h4>
      <div className="bg-muted/50 rounded-lg p-3 space-y-2">
        {entries.slice(0, 6).map(([key, value]) => (
          <div key={key} className="flex items-start gap-2 text-sm">
            <span className="text-muted-foreground min-w-[100px] capitalize">
              {key.replace(/([A-Z])/g, " $1").trim()}:
            </span>
            <code className="bg-background px-1.5 py-0.5 rounded text-xs border flex-1 break-all">
              {formatValue(value)}
            </code>
          </div>
        ))}
      </div>
    </div>
  );
}

// Resources section
function ResourcesSection({ resources }: { resources: EnhancedStepResult["resources"] }) {
  if (!resources || resources.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Resources Created</h4>
      <div className="space-y-1">
        {resources.slice(0, 5).map((resource, i) => (
          <a
            key={resource.id || i}
            href={resource.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-2 rounded-lg border bg-background hover:bg-muted/50 transition-colors text-sm"
          >
            <Badge variant="outline" className="text-xs capitalize">
              {resource.type}
            </Badge>
            <span className="flex-1 truncate font-medium">{resource.name}</span>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
          </a>
        ))}
        {resources.length > 5 && (
          <div className="text-center text-xs text-muted-foreground py-1">+{resources.length - 5} more resources</div>
        )}
      </div>
    </div>
  );
}

export function EnhancedStepCard({
  step,
  stepNumber,
  isFirst,
  isLast,
  defaultExpanded = false,
  onRefresh,
}: EnhancedStepCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded || step.error !== undefined);

  // Check if this is an enhanced step result
  const isEnhanced = isEnhancedStepResult(step);
  const enhancedStep = isEnhanced ? (step as EnhancedStepResult) : null;

  // Determine status
  const status = isEnhanced ? enhancedStep!.status : step.success ? "success" : "failed";
  const stepType = isEnhanced ? enhancedStep!.stepType : "action";
  const service = isEnhanced ? enhancedStep!.service : "meta-ads";
  const summary = isEnhanced ? enhancedStep!.summary : undefined;
  const durationMs = isEnhanced ? enhancedStep!.durationMs : undefined;
  const inputs = isEnhanced ? enhancedStep!.inputs : undefined;
  const resources = isEnhanced ? enhancedStep!.resources : undefined;

  return (
    <div className="relative">
      {/* Connector line to next step */}
      {!isLast && <div className="absolute left-[22px] top-full h-4 w-0.5 bg-border z-0" />}

      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <div
          className={cn(
            "border rounded-lg relative z-10 bg-background transition-shadow",
            status === "success" && "border-green-200 hover:shadow-sm",
            status === "failed" && "border-red-200 bg-red-50/30",
            status === "skipped" && "border-gray-200 bg-gray-50/30 opacity-60",
          )}
        >
          {/* Header - always visible */}
          <CollapsibleTrigger asChild>
            <button className="w-full text-left">
              <div className="flex items-center gap-3 p-4">
                {/* Step number badge */}
                <div
                  className={cn(
                    "flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold",
                    status === "success" && "bg-green-100 text-green-700",
                    status === "failed" && "bg-red-100 text-red-700",
                    status === "skipped" && "bg-gray-100 text-gray-500",
                  )}
                >
                  {stepNumber}
                </div>

                {/* Service icon */}
                <ServiceIcon service={service} />

                {/* Step type badge */}
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs capitalize shrink-0",
                    stepType === "trigger" && "border-blue-200 bg-blue-50 text-blue-700",
                    stepType === "action" && "border-purple-200 bg-purple-50 text-purple-700",
                  )}
                >
                  {stepType === "trigger" ? <Zap className="h-3 w-3 mr-1" /> : <Play className="h-3 w-3 mr-1" />}
                  {stepType}
                </Badge>

                {/* Event name and summary */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{normalizeAdscanEventForDisplay(step.event)}</div>
                  {summary && <div className="text-sm text-muted-foreground truncate">{summary}</div>}
                </div>

                {/* Duration and status */}
                <div className="flex items-center gap-3 shrink-0">
                  {durationMs !== undefined && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDuration(durationMs)}
                    </div>
                  )}
                  <StatusIcon status={status} />
                  <ChevronDown
                    className={cn("h-4 w-4 text-muted-foreground transition-transform", expanded && "rotate-180")}
                  />
                </div>
              </div>
            </button>
          </CollapsibleTrigger>

          {/* Expanded content */}
          <CollapsibleContent>
            <div className="px-4 pb-4 space-y-4 border-t pt-4">
              {/* Data flow indicator */}
              {inputs?.fromPreviousStep && inputs.fromPreviousStep.length > 0 && (
                <DataFlowIndicator sources={inputs.fromPreviousStep} />
              )}

              {/* Inputs section */}
              {inputs && <StepInputsDisplay inputs={inputs} stepType={stepType} />}

              {/* Outputs section */}
              {step.outputs && Object.keys(step.outputs).length > 0 && (
                <StepOutputsDisplay
                  outputs={step.outputs}
                  stepType={stepType}
                  onRefresh={onRefresh}
                  adsManagerLink={step.adsManagerLink}
                />
              )}

              {/* Resources created */}
              {resources && <ResourcesSection resources={resources} />}

              {/* Single Ads Manager link (no resources or only 1) */}
              {step.adsManagerLink && (!resources || resources.length === 0) && (
                <a
                  href={step.adsManagerLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  View in Ads Manager
                </a>
              )}

              {/* Error message */}
              {step.error && (
                <div className="p-3 bg-red-100 border border-red-200 rounded-lg text-sm text-red-700">
                  <strong>Error:</strong> {step.error}
                </div>
              )}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
}

// Export a wrapper that handles both legacy and enhanced formats
export function StepCard({
  step,
  stepNumber,
  isLast,
  onRefresh,
}: {
  step: StepResult;
  stepNumber: number;
  isLast: boolean;
  executionId?: number;
  onRefresh?: () => void;
}) {
  return (
    <EnhancedStepCard
      step={step}
      stepNumber={stepNumber}
      isFirst={stepNumber === 1}
      isLast={isLast}
      defaultExpanded={
        ("success" in step ? !step.success : (step as any).status === "failed") || step.error !== undefined
      }
      onRefresh={onRefresh}
    />
  );
}
