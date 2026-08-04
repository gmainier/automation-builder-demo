"use client";

import { useEffect, useState, type ReactElement } from "react";
import { TriangleAlert } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { useUserOptional } from "@/lib/providers/user-provider";

interface RateLimitStatus {
  count: number;
  since: string;
  ruleNames?: string[];
}

const MAX_NAMES_SHOWN = 3;
const POLL_INTERVAL_MS = 60_000;

function buildRuleNamesSuffix(ruleNames: string[], count: number): string | null {
  if (ruleNames.length === 0) return null;
  const shown = ruleNames.slice(0, MAX_NAMES_SHOWN);
  const remaining = count - shown.length;
  const list = shown.join(", ");
  return remaining > 0 ? `${list} +${remaining} more` : list;
}

/**
 * Warning banner shown above the automations dashboard tabs when one or more
 * automations in the CURRENT workspace were recently auto-paused after hitting
 * Meta's rate limit. Hidden entirely when the count is 0.
 */
export function RateLimitBanner(): ReactElement | null {
  const user = useUserOptional();
  const workspaceId = user?.currentWorkspace?.id ?? null;
  const [status, setStatus] = useState<RateLimitStatus | null>(null);

  useEffect(() => {
    if (!workspaceId) {
      setStatus(null);
      return;
    }

    let isMounted = true;
    const controller = new AbortController();

    const fetchStatus = async () => {
      try {
        const response = await fetch(
          `/api/automation-rules/rate-limit-status?workspaceId=${encodeURIComponent(workspaceId)}`,
          { signal: controller.signal },
        );
        if (!response.ok) return;
        const data: RateLimitStatus = await response.json();
        if (isMounted) setStatus(data);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("Failed to fetch rate limit status:", error);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, POLL_INTERVAL_MS);
    return () => {
      isMounted = false;
      controller.abort();
      clearInterval(interval);
    };
  }, [workspaceId]);

  if (!status || status.count <= 0) {
    return null;
  }

  const automationLabel = status.count === 1 ? "automation" : "automations";
  const namesSuffix = buildRuleNamesSuffix(status.ruleNames ?? [], status.count);

  return (
    <Alert
      variant="inline"
      color="warning"
      before={<TriangleAlert size={16} />}
      title={`${status.count} ${automationLabel} in this workspace were paused after hitting Meta's rate limit.`}
    >
      Reduce their check frequency (e.g. Daily) and re-enable them.
      {namesSuffix ? ` Paused: ${namesSuffix}.` : ""}
    </Alert>
  );
}
