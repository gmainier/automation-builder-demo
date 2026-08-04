"use client";

import { useMemo } from "react";

import { useUser } from "@/lib/providers/user-provider";
import { useCustomMetrics } from "../../reports/_features/metrics";

const CUSTOM_METRIC_PREFIX = "custom_";

/**
 * Returns a `{ "custom_<id>": "Friendly Name" }` map for the current
 * workspace's custom metrics. Used to resolve metric IDs in rule UI badges
 * and labels back to human names.
 *
 * Returns an empty map while loading or if the workspace has none — callers
 * gracefully fall back to the raw id.
 */
export function useCustomMetricsById(): Record<string, string> {
  const { currentWorkspace } = useUser();
  const query = useCustomMetrics(currentWorkspace?.id ?? null);

  return useMemo(() => {
    const map: Record<string, string> = {};
    for (const cm of query.data?.customMetrics ?? []) {
      map[`${CUSTOM_METRIC_PREFIX}${cm.id}`] = cm.name;
    }
    return map;
  }, [query.data]);
}
