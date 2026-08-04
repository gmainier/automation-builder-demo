"use client";

/**
 * Shim for `app/(dashboard)/reports/_features/report-data`.
 *
 * The real hook discovers an account's conversion action types from BigQuery and
 * enriches them with Meta's custom-conversions API. Neither is reachable here, so
 * this serves a small fixed list of the standard Meta actions instead — enough for
 * the criteria builder's metric dropdown to render something real-looking.
 *
 * Path-matched to the original so the ported components keep their relative
 * import (`../../reports/_features/report-data`) untouched.
 */

export interface ConversionMetricOption {
  propertyName: string;
  name: string;
  groupName: string;
  actionType?: string;
}

const CONVERSION_GROUP = "Conversions";

const CONVERSION_METRIC_OPTIONS: ConversionMetricOption[] = [
  { propertyName: "purchase", name: "Purchases", groupName: CONVERSION_GROUP, actionType: "purchase" },
  { propertyName: "custom_cost:purchase", name: "Cost per purchase", groupName: CONVERSION_GROUP, actionType: "purchase" },
  { propertyName: "add_to_cart", name: "Adds to cart", groupName: CONVERSION_GROUP, actionType: "add_to_cart" },
  { propertyName: "initiate_checkout", name: "Checkouts initiated", groupName: CONVERSION_GROUP, actionType: "initiate_checkout" },
  { propertyName: "lead", name: "Leads", groupName: CONVERSION_GROUP, actionType: "lead" },
  { propertyName: "custom_cost:lead", name: "Cost per lead", groupName: CONVERSION_GROUP, actionType: "lead" },
];

interface ConversionTypesResult {
  conversionMetricOptions: ConversionMetricOption[];
  isLoading: boolean;
}

export function useConversionTypes(accountIds: string[], enabled = true): ConversionTypesResult {
  const hasAccounts = Array.isArray(accountIds) && accountIds.length > 0;
  return {
    conversionMetricOptions: enabled && hasAccounts ? CONVERSION_METRIC_OPTIONS : [],
    isLoading: false,
  };
}
