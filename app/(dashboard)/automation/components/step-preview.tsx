"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useUser } from "@/lib/providers/user-provider";
import type { AutomationNode } from "../contexts/automation-context";
import { getNodeSummary } from "../lib/node-summary";
import { useCustomMetricsById } from "../lib/use-custom-metrics-by-id";
import { getServiceInfo } from "../lib/service-icons";
import { normalizeAdscanEventForDisplay } from "../lib/adscan-events";
import { getTikTokPerformanceThresholdGaps } from "../lib/tiktok-performance-threshold-gaps";

interface StepPreviewProps {
  node: AutomationNode;
  index: number;
}

function workspaceHasTikTokAccounts(extendedUser: ReturnType<typeof useUser>["extendedUser"]): boolean {
  if (!extendedUser?.settings || !extendedUser.defaultWorkspaceId) {
    return false;
  }

  return extendedUser.settings.some((setting: { workspaceId?: string | null; type?: string | null }) => {
    return setting.workspaceId === extendedUser.defaultWorkspaceId && setting.type === "tiktok";
  });
}

/**
 * Compact single-step summary for the right-panel "Preview" tab.
 * No labels, no dividers — just a tight readable synopsis.
 */
export function StepPreview({ node, index }: StepPreviewProps) {
  const customMetricsById = useCustomMetricsById();
  const { extendedUser } = useUser();
  const summary = getNodeSummary(node, { customMetricsById });
  const info = node.service ? getServiceInfo(node.service) : null;

  const headline = node.type === "trigger" ? "Fires when" : node.type === "action" ? "Sends" : "Runs";
  const serviceLine = info?.label
    ? `${info.label} · ${normalizeAdscanEventForDisplay(node.event) || "—"}`
    : "Not configured yet";

  const hasAnyDetail =
    summary.badges.length > 0 || summary.conditionSummary || summary.destinationSummary || summary.subtitle;

  const tikTokGaps = useMemo(() => {
    if (node.service !== "tiktok-ads" || node.event !== "Performance Threshold") {
      return [];
    }
    return getTikTokPerformanceThresholdGaps(node.config, {
      hasConnectedTikTokAccounts: workspaceHasTikTokAccounts(extendedUser),
    });
  }, [node.service, node.event, node.config, extendedUser]);

  return (
    <div className="space-y-2.5">
      {/* Headline — tight, no box */}
      <div>
        <p className="text-xs font-medium text-foreground">
          <span className="text-muted-foreground">{index + 1}.</span> {headline}
        </p>
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{serviceLine}</p>
      </div>

      {/* Summary chips — only the real config */}
      {summary.badges.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {summary.badges.map((b, i) => (
            <span
              key={i}
              className={cn(
                "inline-flex items-center rounded px-1.5 py-0.5 text-[10.5px] font-medium",
                b.tone === "muted"
                  ? "bg-muted text-muted-foreground"
                  : "bg-primary/10 text-primary ring-1 ring-inset ring-primary/15",
              )}
            >
              {b.label}
            </span>
          ))}
        </div>
      )}

      {tikTokGaps.length > 0 ? (
        <div className="rounded border border-dashed border-amber-300 bg-amber-50/60 px-2.5 py-1.5 space-y-1">
          <p className="text-[11px] font-medium text-amber-900">Missing to preview</p>
          <ul className="space-y-0.5">
            {tikTokGaps.map((gap) => (
              <li key={`${gap.where}-${gap.label}`} className="text-[11px] text-amber-900/90">
                {gap.label}
                <span className="text-amber-800/70"> — {gap.where}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        !hasAnyDetail && (
          <p className="rounded border border-dashed px-2.5 py-1.5 text-[11px] text-muted-foreground">
            Configure this step in Setup to see what it&apos;ll do.
          </p>
        )
      )}
    </div>
  );
}
