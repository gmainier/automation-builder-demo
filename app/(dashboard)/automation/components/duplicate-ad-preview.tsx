"use client";

import { useState } from "react";
import { ArrowRight, ExternalLink, Flame, Loader2, RefreshCw, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Meta from "@/components/ui/icons/meta";
import type { AutomationNode } from "../contexts/automation-context";

interface DuplicateAdPreviewProps {
  /** The Duplicate Ad action node (for config). */
  node: AutomationNode;
  /** The flow's trigger so we can dry-run it and discover qualifying ads. */
  triggerNode?: AutomationNode;
  selectedAccountId?: string;
  selectedAccountName?: string;
}

interface DryRunResponse {
  matchedCount: number;
  previewSource?: "live" | "sample";
  triggerError: string | null;
  triggerData?: Record<string, any>;
}

/**
 * Preview for the "Duplicate Ad" action.
 * - Runs the preceding trigger in dry-run mode to find qualifying ads.
 * - Shows which ads will be duplicated and where they will land.
 */
export function DuplicateAdPreview({
  node,
  triggerNode,
  selectedAccountId,
  selectedAccountName,
}: DuplicateAdPreviewProps) {
  const [state, setState] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "ready"; data: DryRunResponse }
    | { status: "error"; message: string }
  >({ status: "idle" });
  const [elapsed, setElapsed] = useState(0);

  const config = node.config || {};
  const targetAdSetMatchType: string = config.targetAdSetMatchType || "specific";
  const targetAdSetName: string | undefined = config.targetAdSetName;
  const targetAdSetNameFilter: string | undefined = config.targetAdSetNameFilter;
  const targetCampaignMatchType: string | undefined = config.targetCampaignMatchType;
  const targetCampaignName: string | undefined = config.targetCampaignName;
  const targetCampaignNameFilter: string | undefined = config.targetCampaignNameFilter;
  const adNameTemplate: string | undefined = config.adNameTemplate;
  const adStatus: string = config.adStatus || "PAUSED";

  const targetAdSetLabel = (() => {
    if (targetAdSetMatchType === "specific") return targetAdSetName || "(not selected)";
    const verb =
      targetAdSetMatchType === "contains"
        ? "contains"
        : targetAdSetMatchType === "equals"
          ? "equals"
          : targetAdSetMatchType === "not_contains"
            ? "does not contain"
            : targetAdSetMatchType === "starts_with"
              ? "starts with"
              : targetAdSetMatchType === "ends_with"
                ? "ends with"
                : targetAdSetMatchType;
    return targetAdSetNameFilter ? `Ad sets where name ${verb} "${targetAdSetNameFilter}"` : `Ad sets (${verb} …)`;
  })();

  const targetCampaignLabel = (() => {
    if (!targetCampaignMatchType || targetCampaignMatchType === "all") return null;
    if (targetCampaignMatchType === "specific") return targetCampaignName || "(campaign not selected)";
    return targetCampaignNameFilter ? `Campaigns ${targetCampaignMatchType}: "${targetCampaignNameFilter}"` : null;
  })();

  const runPreview = async () => {
    if (!triggerNode) {
      setState({ status: "error", message: "No trigger configured in this flow" });
      return;
    }
    setState({ status: "loading" });
    setElapsed(0);
    const startTime = Date.now();
    const intervalId = setInterval(() => setElapsed(Math.round((Date.now() - startTime) / 100) / 10), 100);
    try {
      const res = await fetch("/api/automation-rules/dry-run-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          triggerNode,
          // Dummy notification — we only care about the trigger output for this preview.
          notificationNode: { config: { notificationMethod: "email", emailRecipients: [], customMessage: "" } },
          automationName: "Duplicate Ad Preview",
          selectedAccountId,
          selectedAccountName,
        }),
      });
      const raw = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(raw);
      } catch {
        setState({ status: "error", message: `Bad response (HTTP ${res.status}): ${raw.slice(0, 200)}` });
        return;
      }
      if (!res.ok || data?.error) {
        setState({
          status: "error",
          message:
            data?.error ||
            `HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ""}` + (raw ? ` — ${raw.slice(0, 200)}` : ""),
        });
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
  const qualifyingAds: Array<{
    adId: string;
    adName?: string;
    adsetName?: string;
    campaignName?: string;
    spend?: number;
  }> = (ready?.triggerData?.qualifyingAds as any[]) || [];

  const accountCurrency: string = ready?.triggerData?.accountCurrency || "USD";
  const sym = accountCurrency === "GBP" ? "£" : accountCurrency === "EUR" ? "€" : "$";

  // Meta Ads Manager URL for each source ad
  const metaAccountRaw: string =
    triggerNode?.config?.accountId || triggerNode?.config?.accountIds?.[0] || selectedAccountId || "";
  const metaAccountClean = metaAccountRaw.startsWith("act_") ? metaAccountRaw.slice(4) : metaAccountRaw;
  const buildMetaAdUrl = (adId: string): string | null => {
    if (!metaAccountClean || !adId) return null;
    return `https://www.facebook.com/adsmanager/manage/ads?act=${metaAccountClean}&selected_ad_ids=${adId}`;
  };

  const renderRename = (srcName: string): string => {
    if (!adNameTemplate) return srcName;
    return adNameTemplate
      .replace(/\{\{original_name\}\}/g, srcName)
      .replace(/\{\{filename\}\}/g, srcName)
      .replace(/\{\{date\}\}/g, new Date().toISOString().split("T")[0]);
  };

  return (
    <div className="space-y-3">
      {/* Target summary — what we're duplicating INTO */}
      <div className="rounded-md border bg-muted/30 px-3 py-2.5 text-[11px] leading-relaxed">
        <div className="flex items-center gap-1.5">
          <Target className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Duplicating into
          </span>
        </div>
        <dl className="mt-1 grid grid-cols-[80px_1fr] gap-x-2 gap-y-0.5 text-[11px]">
          <dt className="text-muted-foreground">Ad set</dt>
          <dd className="font-medium text-foreground">{targetAdSetLabel}</dd>
          {targetCampaignLabel && (
            <>
              <dt className="text-muted-foreground">Campaign</dt>
              <dd className="font-medium text-foreground">{targetCampaignLabel}</dd>
            </>
          )}
          <dt className="text-muted-foreground">Status</dt>
          <dd>
            <span
              className={cn(
                "rounded px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide",
                adStatus === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground",
              )}
            >
              {adStatus}
            </span>
          </dd>
          {adNameTemplate && (
            <>
              <dt className="text-muted-foreground">New name</dt>
              <dd className="truncate font-mono text-[10.5px] text-muted-foreground" title={adNameTemplate}>
                {adNameTemplate}
              </dd>
            </>
          )}
        </dl>
      </div>

      {/* CTA */}
      <Button
        onClick={runPreview}
        disabled={state.status === "loading" || !triggerNode}
        className="h-9 w-full gap-2"
        variant={ready ? "outline" : "default"}
      >
        {state.status === "loading" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Finding source ads · <span className="ml-1 tabular-nums">{elapsed.toFixed(1)}s</span>
          </>
        ) : ready ? (
          <>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </>
        ) : (
          <>
            <Flame className="h-4 w-4" />
            Preview what would be duplicated
          </>
        )}
      </Button>

      {state.status === "error" && (
        <div className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] text-red-700">
          {state.message}
        </div>
      )}

      {ready?.triggerError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] text-red-700">
          Trigger: {ready.triggerError}
        </div>
      )}

      {ready && !ready.triggerError && qualifyingAds.length === 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-900">
          <p className="font-semibold">Nothing to duplicate right now</p>
          <p className="mt-0.5 text-amber-800">
            The trigger didn&apos;t return any qualifying ads. If it did match when this rule runs, those ads would be
            duplicated into the target above.
          </p>
        </div>
      )}

      {qualifyingAds.length > 0 && (
        <div className="overflow-hidden rounded-md border bg-card">
          <div className="flex items-center justify-between border-b bg-muted/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span>
              {qualifyingAds.length} ad{qualifyingAds.length === 1 ? "" : "s"} would be duplicated
            </span>
            <span className="truncate text-right">→ {targetAdSetLabel}</span>
          </div>
          <ul className="divide-y">
            {qualifyingAds.slice(0, 8).map((ad, i) => {
              const renamed = renderRename(ad.adName || "");
              return (
                <li key={ad.adId || i} className="flex items-start gap-2 px-2.5 py-2">
                  <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-muted/60">
                    <Meta className="h-4 w-4" grayscale={false} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11.5px] font-medium text-foreground">{ad.adName || ad.adId}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-[10.5px] text-muted-foreground">
                      <span className="truncate">{ad.campaignName || "—"}</span>
                      {ad.adsetName && (
                        <>
                          <span className="text-muted-foreground/50">·</span>
                          <span className="truncate">{ad.adsetName}</span>
                        </>
                      )}
                      {ad.spend != null && (
                        <>
                          <span className="text-muted-foreground/50">·</span>
                          <span className="tabular-nums">
                            {sym}
                            {Number(ad.spend).toFixed(2)}
                          </span>
                        </>
                      )}
                    </p>
                    {adNameTemplate && renamed !== ad.adName && (
                      <p className="mt-1 flex items-center gap-1 text-[10.5px] text-muted-foreground">
                        <ArrowRight className="h-2.5 w-2.5 flex-shrink-0" />
                        <span className="truncate font-mono text-foreground" title={renamed}>
                          {renamed}
                        </span>
                      </p>
                    )}
                  </div>
                  {buildMetaAdUrl(ad.adId) && (
                    <a
                      href={buildMetaAdUrl(ad.adId) as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Open in Meta Ads Manager"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
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
