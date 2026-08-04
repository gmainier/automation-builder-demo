"use client";

import { useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Info, Loader2 } from "lucide-react";

interface CompatibilityBlocker {
  scope: "campaign" | "adgroup";
  adGroupId: string;
  adGroupName: string;
  bidType: string;
  reason: string;
}

type Status = "idle" | "checking" | "ok" | "blocked" | "error";

interface CompatibilityState {
  status: Status;
  blockers: CompatibilityBlocker[];
  adGroupCount?: number;
  isSmartPerformance?: boolean;
  errorMessage?: string;
}

interface Props {
  advertiserId?: string;
  entityType: "campaign" | "adgroup" | null;
  entityId?: string;
  /** Hide silent states (idle / ok). Used in Preview where we only want warnings. */
  warningsOnly?: boolean;
}

export function TikTokDuplicationCompatAlert({ advertiserId, entityType, entityId, warningsOnly }: Props) {
  const [state, setState] = useState<CompatibilityState>({ status: "idle", blockers: [] });

  useEffect(() => {
    if (!entityType || !advertiserId || !entityId) {
      setState({ status: "idle", blockers: [] });
      return;
    }
    let cancelled = false;
    setState({ status: "checking", blockers: [] });
    const params = new URLSearchParams({ advertiserId, entityType, entityId });
    fetch(`/api/manage/tiktok/duplication-compatibility?${params.toString()}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (!json?.success) {
          setState({ status: "error", blockers: [], errorMessage: json?.error || "Compatibility check failed" });
          return;
        }
        const blockers: CompatibilityBlocker[] = Array.isArray(json.blockers) ? json.blockers : [];
        setState({
          status: json.compatible ? "ok" : "blocked",
          blockers,
          adGroupCount: typeof json.adGroupCount === "number" ? json.adGroupCount : undefined,
          isSmartPerformance: json.isSmartPerformance === true,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ status: "error", blockers: [], errorMessage: String(err?.message || err) });
      });
    return () => {
      cancelled = true;
    };
  }, [advertiserId, entityType, entityId]);

  if (!entityType || !advertiserId || !entityId) return null;

  if (state.status === "checking") {
    if (warningsOnly) return null;
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground" data-testid="tiktok-compat-checking">
        <Loader2 className="h-3 w-3 animate-spin" />
        Checking duplication compatibility…
      </div>
    );
  }

  if (state.status === "blocked") {
    const campaignBlockers = state.blockers.filter((b) => b.scope === "campaign");
    const adGroupBlockers = state.blockers.filter((b) => b.scope === "adgroup");
    return (
      <Alert color="error" data-testid="tiktok-compat-blocked">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>This source will fail to duplicate</AlertTitle>
        <AlertDescription>
          {campaignBlockers.length > 0 && (
            <ul className="list-disc pl-4 text-xs space-y-1 mb-2">
              {campaignBlockers.map((b) => (
                <li key={`c-${b.adGroupId}`}>
                  <span className="font-medium">Campaign:</span> {b.reason}
                </li>
              ))}
            </ul>
          )}
          {adGroupBlockers.length > 0 && (
            <>
              <p className="mb-2 text-xs">
                {adGroupBlockers.length} ad group(s) use custom (cost-cap / bid-cap) bidding. TikTok&apos;s adgroup
                create API refuses to make new ad groups with that bid type in a campaign that carries budget controls.
                The existing source works because it was created before TikTok tightened this rule.
              </p>
              <ul className="list-disc pl-4 text-xs space-y-1">
                {adGroupBlockers.map((b) => (
                  <li key={`a-${b.adGroupId}`}>
                    <span className="font-medium">{b.adGroupName}</span>{" "}
                    <span className="text-muted-foreground">({b.bidType || "unknown bid_type"})</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs">
                Fixes: switch the source ad group(s) to Maximum Delivery or Highest Value bidding in TikTok Ads Manager,
                or enable &ldquo;Campaign shell only&rdquo; to skip duplicating children.
              </p>
            </>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  if (state.status === "error") {
    if (warningsOnly) return null;
    return (
      <p className="text-xs text-muted-foreground" data-testid="tiktok-compat-error">
        Compatibility check unavailable: {state.errorMessage}. The automation will still pre-flight at run time.
      </p>
    );
  }

  if (state.status === "ok" && entityType === "campaign" && typeof state.adGroupCount === "number") {
    if (warningsOnly) return null;
    return (
      <Alert data-testid="tiktok-compat-info">
        <Info className="h-4 w-4" />
        <AlertTitle>
          {state.adGroupCount === 0
            ? "Source campaign has no ad groups"
            : `Source campaign has ${state.adGroupCount} ad group${state.adGroupCount === 1 ? "" : "s"}`}
          {state.isSmartPerformance ? " · Smart+" : ""}
        </AlertTitle>
        <AlertDescription>
          {state.adGroupCount === 0
            ? "The duplicated campaign will be created empty. Enable 'Campaign shell only' to make this explicit, or pick a source campaign that has child ad groups."
            : `These ad groups will be duplicated into the new campaign.`}
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
