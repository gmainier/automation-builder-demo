"use client";

/**
 * Shim for `app/(dashboard)/reports/_features/metrics`.
 *
 * The real hook is React Query over `/api/custom-metrics` for the current
 * workspace. Custom metrics are a reports feature; the automation UI only reads
 * them to turn a `custom_<id>` metric id back into a friendly label.
 *
 * It lives at this exact path so the ported components keep their original
 * relative import (`../../reports/_features/metrics`) untouched.
 *
 * Returning an empty list is the documented loading behaviour of the real hook,
 * so callers already fall back to showing the raw metric id.
 */

export interface CustomMetric {
  id: string;
  name: string;
  renderFormat: string;
  formula: string;
}

interface CustomMetricsQueryResult {
  data: { customMetrics: CustomMetric[] } | undefined;
  isLoading: boolean;
  isError: boolean;
}

const EMPTY_RESULT: CustomMetricsQueryResult = {
  data: { customMetrics: [] },
  isLoading: false,
  isError: false,
};

export function useCustomMetrics(_workspaceId: string | null | undefined): CustomMetricsQueryResult {
  return EMPTY_RESULT;
}
