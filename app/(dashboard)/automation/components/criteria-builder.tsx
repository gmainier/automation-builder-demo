"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Plus, Check, ChevronsUpDown } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { AutoScaleCriteria, CriteriaGroup, AggregationLevel } from "@/types/auto-scale";
import { getCriteriaGroups, criteriaUsesConversionEvent } from "@/lib/automation/criteria-groups";
import { ConditionGroup, type MetricCatalog } from "./condition-group";
import {
  AD_AGE_METRIC,
  AUTOMATION_METRICS,
  getMetricByValue,
  AGGREGATION_LEVELS,
  formatAdAgeValue,
  generateCustomEventMetrics,
  type AutomationMetric,
} from "@/types/automation-metrics";
import { useConversionTypes } from "../../reports/_features/report-data";
import { useCustomMetrics } from "../../reports/_features/metrics";
import { useUser } from "@/lib/providers/user-provider";
import {
  getIncludeTodayInsightsDescription,
  supportsIncludeTodayPartialData,
  type AutomationAdsPlatform,
} from "../lib/automation-platform-labels";

const CUSTOM_METRIC_PREFIX = "custom_";

function customMetricValue(id: string): string {
  return `${CUSTOM_METRIC_PREFIX}${id}`;
}

interface CriteriaBuilderProps {
  criteria: AutoScaleCriteria;
  onChange: (criteria: AutoScaleCriteria) => void;
  conversionEvent?: string;
  currency?: string;
  accountIds?: string[];
  /**
   * Restrict the selectable metrics in the picker to this allow-list (by metric
   * `value`). When omitted, all metrics are selectable (unchanged behavior).
   * Already-saved metrics outside the list still resolve and render.
   */
  allowedMetrics?: readonly string[];
  /**
   * Hide the Conversion Event selector even when a conversion-based metric is
   * selected. For platforms (e.g. Snapchat) whose backend always evaluates
   * purchase conversions and ignores a user-picked event. When omitted/false,
   * behavior is unchanged.
   */
  hideConversionEvent?: boolean;
  /**
   * Hide the aggregation-level selector and its per-mode descriptions, keeping the
   * criteria at the default `per_ad`. For platforms (e.g. Snapchat) whose AdMetrics
   * carry no campaign/ad-set parentage, so campaign/ad-set aggregation would collapse
   * every ad into one bucket. When omitted/false, behavior is unchanged.
   */
  hideAggregation?: boolean;
  /** Ads platform for platform-specific copy and Meta-only options. Defaults to Meta. */
  platform?: AutomationAdsPlatform;
}

// Currency symbol mapping
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CAD: "C$",
  AUD: "A$",
  JPY: "¥",
  CNY: "¥",
  INR: "₹",
  BRL: "R$",
  MXN: "MX$",
  KRW: "₩",
  SGD: "S$",
  HKD: "HK$",
  NZD: "NZ$",
  SEK: "kr",
  NOK: "kr",
  DKK: "kr",
  CHF: "CHF",
  PLN: "zł",
  ZAR: "R",
  AED: "د.إ",
  THB: "฿",
  MYR: "RM",
  PHP: "₱",
  IDR: "Rp",
  VND: "₫",
  TWD: "NT$",
  TRY: "₺",
  ILS: "₪",
  CZK: "Kč",
  HUF: "Ft",
  RON: "lei",
  BGN: "лв",
  HRK: "kn",
  RUB: "₽",
  UAH: "₴",
  PKR: "₨",
  EGP: "E£",
  NGN: "₦",
  KES: "KSh",
  GHS: "GH₵",
  COP: "COL$",
  ARS: "AR$",
  CLP: "CLP$",
  PEN: "S/",
};

const getCurrencySymbol = (currency?: string): string => {
  if (!currency) return "$";
  return CURRENCY_SYMBOLS[currency.toUpperCase()] || currency;
};

// Use shared metrics from automation-metrics.ts
// AUTOMATION_METRICS, METRICS_BY_GROUP, getMetricByValue imported above

const PERFORMANCE_PERIOD_OPTIONS = [
  { value: 0, label: "Lifetime (all time)" },
  { value: 1, label: "Last 1 day" },
  { value: 3, label: "Last 3 days" },
  { value: 7, label: "Last 7 days" },
  { value: 14, label: "Last 14 days" },
  { value: 30, label: "Last 30 days" },
];

const AD_AGE_OPTIONS = [
  { value: 0, label: "All ads (no limit)" },
  { value: 7, label: "Created in last 7 days" },
  { value: 14, label: "Created in last 14 days" },
  { value: 30, label: "Created in last 30 days" },
  { value: 60, label: "Created in last 60 days" },
  { value: 90, label: "Created in last 90 days" },
];

const CONVERSION_EVENT_OPTIONS = [
  { value: "omni_purchase", label: "Purchase (All)" },
  { value: "offsite_conversion.fb_pixel_purchase", label: "Website Purchase" },
  { value: "purchase", label: "Purchase" },
  { value: "lead", label: "Lead" },
  { value: "offsite_conversion.fb_pixel_lead", label: "Website Lead" },
  { value: "complete_registration", label: "Complete Registration" },
  { value: "offsite_conversion.fb_pixel_complete_registration", label: "Website Registration" },
  { value: "add_to_cart", label: "Add to Cart" },
  { value: "offsite_conversion.fb_pixel_add_to_cart", label: "Website Add to Cart" },
  { value: "initiate_checkout", label: "Initiate Checkout" },
  { value: "offsite_conversion.fb_pixel_initiate_checkout", label: "Website Initiate Checkout" },
  { value: "view_content", label: "View Content" },
  { value: "offsite_conversion.fb_pixel_view_content", label: "Website View Content" },
  { value: "subscribe", label: "Subscribe" },
  { value: "start_trial", label: "Start Trial" },
  { value: "contact", label: "Contact" },
  { value: "omni_app_install", label: "App Install" },
];

export function CriteriaBuilder({
  criteria,
  onChange,
  conversionEvent: _conversionEvent,
  currency = "USD",
  accountIds,
  allowedMetrics,
  hideConversionEvent,
  hideAggregation,
  platform = "meta",
}: CriteriaBuilderProps) {
  const currencySymbol = getCurrencySymbol(currency);
  const includeTodayId = useId();
  const canIncludeToday = supportsIncludeTodayPartialData(platform);
  const [performancePeriodOpen, setPerformancePeriodOpen] = useState(false);
  const [adAgeOpen, setAdAgeOpen] = useState(false);
  const [conversionEventOpen, setConversionEventOpen] = useState(false);

  // Discover custom events from the selected ad account(s)
  const { conversionMetricOptions } = useConversionTypes(accountIds ?? []);
  const customEventMetrics = useMemo(
    () => generateCustomEventMetrics(conversionMetricOptions),
    [conversionMetricOptions],
  );

  // Workspace-defined custom metrics (formula-based, shared with /reports)
  const { currentWorkspace } = useUser();
  const customMetricsQuery = useCustomMetrics(currentWorkspace?.id ?? null);
  const workspaceCustomMetrics: AutomationMetric[] = useMemo(() => {
    const list = customMetricsQuery.data?.customMetrics ?? [];
    return list.map((cm) => ({
      value: customMetricValue(cm.id),
      label: cm.name,
      group: "workspaceCustom" as const,
      type: "number" as const,
      isCurrency: cm.renderFormat === "CURRENCY",
      suffix: cm.renderFormat === "PERCENTAGE" ? "%" : "",
      goalDirection: "HIGHER",
      description: cm.formula,
      customMetricId: cm.id,
    }));
  }, [customMetricsQuery.data]);

  // Combined lookup: hardcoded + custom event metrics + workspace custom metrics
  const allMetrics = useMemo(
    () => [...AUTOMATION_METRICS, ...customEventMetrics, ...workspaceCustomMetrics],
    [customEventMetrics, workspaceCustomMetrics],
  );
  const getMetricFromAll = (value: string): AutomationMetric | undefined => allMetrics.find((m) => m.value === value);

  const getMetricInfo = (metric: string): AutomationMetric =>
    getMetricFromAll(metric) || getMetricByValue(metric) || AUTOMATION_METRICS[0];

  // Metric catalog passed down to each condition group. `allowedMetricValues`
  // (when provided) restricts which metrics the picker offers; `platform` hides
  // metrics not offered on this ads platform (e.g. Ad Age is Meta-only).
  const catalog: MetricCatalog = {
    customEventMetrics,
    workspaceCustomMetrics,
    getMetricInfo,
    allowedMetricValues: allowedMetrics ? new Set(allowedMetrics) : undefined,
    platform,
  };

  // Normalize criteria into groups (groups are OR'd; conditions within a group use the
  // group's own AND/OR). Always render at least one group with one condition.
  const groups: CriteriaGroup[] = useMemo(() => {
    const normalized = getCriteriaGroups(criteria);
    if (normalized.length > 0) return normalized;
    return [{ conditions: [{ metric: "spend", operator: ">", value: 0 }], logic: criteria.logic ?? "AND" }];
  }, [criteria]);

  // Only show conversion event if at least one condition uses a conversion-dependent metric
  const hasConversionMetric = criteriaUsesConversionEvent({ groups, logic: criteria.logic });

  // Persist groups back to criteria. A single group is stored in the legacy flat form
  // (no `groups` field) so existing rules and the BigQuery fast path are unaffected.
  // Multiple groups persist `groups` plus a flattened `conditions` union for consumers
  // that only read the flat list (field selection, conversion-event detection).
  const commitGroups = (nextGroups: CriteriaGroup[]) => {
    if (nextGroups.length <= 1) {
      const only = nextGroups[0];
      onChange({
        ...criteria,
        conditions: only ? only.conditions : [],
        logic: only ? only.logic : criteria.logic,
        groups: undefined,
      });
      return;
    }
    onChange({
      ...criteria,
      groups: nextGroups,
      conditions: nextGroups.flatMap((g) => g.conditions),
      logic: nextGroups[0].logic,
    });
  };

  const updateGroupAt = (index: number, group: CriteriaGroup) =>
    commitGroups(groups.map((g, i) => (i === index ? group : g)));
  const addGroup = () =>
    commitGroups([...groups, { conditions: [{ metric: "spend", operator: ">", value: 0 }], logic: "AND" }]);
  const removeGroupAt = (index: number) => commitGroups(groups.filter((_, i) => i !== index));

  const aggregation: AggregationLevel = criteria.aggregation || "per_ad";

  return (
    <div className="space-y-4">
      {/* Performance Period */}
      <div className="space-y-2">
        <Label>Performance Period</Label>
        <Popover open={performancePeriodOpen} onOpenChange={setPerformancePeriodOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={performancePeriodOpen}
              className="w-full justify-between font-normal"
            >
              {PERFORMANCE_PERIOD_OPTIONS.find((opt) => opt.value === criteria.lookbackDays)?.label ||
                "Select period..."}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-0">
            <Command>
              <CommandInput placeholder="Search period..." />
              <CommandList>
                <CommandEmpty>No period found.</CommandEmpty>
                <CommandGroup>
                  {PERFORMANCE_PERIOD_OPTIONS.map((opt) => (
                    <CommandItem
                      key={opt.value}
                      value={opt.label}
                      onSelect={() => {
                        onChange({
                          ...criteria,
                          lookbackDays: opt.value,
                          // Clear excludeRecentDays when switching to lifetime
                          ...(opt.value === 0 ? { excludeRecentDays: undefined } : {}),
                        });
                        setPerformancePeriodOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          criteria.lookbackDays === opt.value ? "opacity-100" : "opacity-0",
                        )}
                      />
                      {opt.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <p className="text-xs text-muted-foreground">Time window used to evaluate ad performance metrics</p>
      </div>

      {/* Exclude Recent Days (Performance Period) */}
      {criteria.lookbackDays > 0 && (
        <div className="space-y-2">
          {canIncludeToday && (
            <div className="flex items-start gap-2 rounded-md border p-3">
              <Checkbox
                id={includeTodayId}
                checked={criteria.includeToday === true}
                onCheckedChange={(checked) => {
                  onChange({
                    ...criteria,
                    includeToday: checked === true,
                    excludeRecentDays: checked === true ? undefined : criteria.excludeRecentDays,
                  });
                }}
              />
              <div className="space-y-1 leading-none">
                <Label htmlFor={includeTodayId} className="text-sm font-normal cursor-pointer">
                  Include today's partial data
                </Label>
                <p className="text-xs text-muted-foreground">{getIncludeTodayInsightsDescription(platform)}</p>
              </div>
            </div>
          )}
          <Label>Exclude Recent Days</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              max={criteria.lookbackDays - 1}
              value={criteria.excludeRecentDays || ""}
              disabled={canIncludeToday && criteria.includeToday === true}
              onChange={(e) => {
                const val = e.target.value;
                onChange({
                  ...criteria,
                  excludeRecentDays: val === "" ? undefined : Math.max(0, parseInt(val, 10)),
                });
              }}
              placeholder="0"
              className="w-20 h-9 text-sm"
            />
            <span className="text-sm text-muted-foreground">days</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {canIncludeToday && criteria.includeToday
              ? "Today's partial data is included, so recent-day exclusion is disabled"
              : criteria.excludeRecentDays && criteria.excludeRecentDays > 0
                ? `Evaluating performance from days ${criteria.lookbackDays} to ${criteria.excludeRecentDays} ago`
                : "Skip the most recent days from performance data"}
          </p>
        </div>
      )}

      {/* Lookback Period (Ad Age Filter) */}
      <div className="space-y-2">
        <Label>Lookback Period</Label>
        <Popover open={adAgeOpen} onOpenChange={setAdAgeOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={adAgeOpen}
              className="w-full justify-between font-normal"
            >
              {AD_AGE_OPTIONS.find((opt) => opt.value === (criteria.adCreatedWithinDays || 0))?.label ||
                "All ads (no limit)"}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[240px] p-0">
            <Command>
              <CommandInput placeholder="Search..." />
              <CommandList>
                <CommandEmpty>No option found.</CommandEmpty>
                <CommandGroup>
                  {AD_AGE_OPTIONS.map((opt) => (
                    <CommandItem
                      key={opt.value}
                      value={opt.label}
                      onSelect={() => {
                        onChange({
                          ...criteria,
                          adCreatedWithinDays: opt.value || undefined,
                          // Clear excludeRecentCreatedDays when switching to "All ads"
                          ...(opt.value === 0 ? { excludeRecentCreatedDays: undefined } : {}),
                        });
                        setAdAgeOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          (criteria.adCreatedWithinDays || 0) === opt.value ? "opacity-100" : "opacity-0",
                        )}
                      />
                      {opt.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <p className="text-xs text-muted-foreground">Only check ads created within this time window</p>
      </div>

      {/* Exclude Recent Days (Lookback Period / Ad Creation) */}
      {criteria.adCreatedWithinDays && criteria.adCreatedWithinDays > 0 && (
        <div className="space-y-2">
          <Label>Exclude Recent Days (Ad Creation)</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              max={criteria.adCreatedWithinDays - 1}
              value={criteria.excludeRecentCreatedDays || ""}
              onChange={(e) => {
                const val = e.target.value;
                onChange({
                  ...criteria,
                  excludeRecentCreatedDays: val === "" ? undefined : Math.max(0, parseInt(val, 10)),
                });
              }}
              placeholder="0"
              className="w-20 h-9 text-sm"
            />
            <span className="text-sm text-muted-foreground">days</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {criteria.excludeRecentCreatedDays && criteria.excludeRecentCreatedDays > 0
              ? `Only checking ads created between ${criteria.adCreatedWithinDays} and ${criteria.excludeRecentCreatedDays} days ago (giving Meta ${criteria.excludeRecentCreatedDays} day${criteria.excludeRecentCreatedDays > 1 ? "s" : ""} to optimize)`
              : "Skip recently created ads to give Meta time to optimize delivery"}
          </p>
        </div>
      )}

      {/* Conditions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Conditions</Label>
          {!hideAggregation && (
            <div className="flex items-center gap-2">
              <Select
                value={criteria.aggregation || "per_ad"}
                onValueChange={(v) => onChange({ ...criteria, aggregation: v as AggregationLevel })}
              >
                <SelectTrigger className="w-[132px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AGGREGATION_LEVELS.map((level) => (
                    <SelectItem key={level.value} value={level.value}>
                      {level.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {!hideAggregation && (
          <>
            {criteria.aggregation === "average" && (
              <p className="text-xs text-muted-foreground">
                Compare each ad against the average of all ads in the selected ad sets.
              </p>
            )}

            {criteria.aggregation === "mixed" && (
              <p className="text-xs text-muted-foreground">
                Mix per-ad thresholds and average-based comparisons. Click the badge on each condition to toggle.
              </p>
            )}

            {criteria.aggregation === "adset_average" && (
              <p className="text-xs text-muted-foreground">
                Group ads by ad set, compute average metrics per ad set, and compare against the threshold. All ads from
                qualifying ad sets are included.
              </p>
            )}

            {criteria.aggregation === "adset_total" && (
              <p className="text-xs text-muted-foreground">
                Group ads by ad set, sum metrics across the ad set (ad set total), and compare against the threshold.
                All ads from qualifying ad sets are included.
              </p>
            )}

            {criteria.aggregation === "campaign_average" && (
              <p className="text-xs text-muted-foreground">
                Group ads by campaign, compute average metrics per campaign, and compare against the threshold. All ads
                from qualifying campaigns are included.
              </p>
            )}

            {criteria.aggregation === "campaign_total" && (
              <p className="text-xs text-muted-foreground">
                Group ads by campaign, sum metrics across the campaign (campaign total), and compare against the
                threshold. All ads from qualifying campaigns are included.
              </p>
            )}

            {criteria.aggregation === "top_per_adset" && (
              <p className="text-xs text-muted-foreground">
                Apply the conditions first, then select the top ranked ad from each matching ad set.
              </p>
            )}
          </>
        )}

        {groups.map((group, groupIndex) => (
          <div key={groupIndex} className="space-y-2">
            {groupIndex > 0 && (
              <div className="flex items-center gap-2 py-0.5" aria-hidden="true">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-primary">OR</span>
                <div className="h-px flex-1 bg-border" />
              </div>
            )}
            <ConditionGroup
              group={group}
              groupIndex={groupIndex}
              aggregation={aggregation}
              currencySymbol={currencySymbol}
              catalog={catalog}
              canRemoveGroup={groups.length > 1}
              onChange={(updated) => updateGroupAt(groupIndex, updated)}
              onRemoveGroup={() => removeGroupAt(groupIndex)}
            />
          </div>
        ))}

        {/* Add another OR group of conditions */}
        <Button variant="outline" size="sm" onClick={addGroup} className="w-full border-dashed">
          <Plus className="h-4 w-4 mr-2" />
          Add OR group
        </Button>
      </div>

      {/* Conversion Event Selector — only shown when conversion metrics are used */}
      {hasConversionMetric && !hideConversionEvent && (
        <div className="space-y-2">
          <Label>Conversion Event</Label>
          <Popover open={conversionEventOpen} onOpenChange={setConversionEventOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={conversionEventOpen}
                className="w-full justify-between font-normal"
              >
                {CONVERSION_EVENT_OPTIONS.find((opt) => opt.value === criteria.conversionEvent)?.label ||
                  criteria.conversionEvent ||
                  "Select conversion event..."}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[280px] p-0">
              <Command>
                <CommandInput placeholder="Search event..." />
                <CommandList className="max-h-[250px]">
                  <CommandEmpty>No event found.</CommandEmpty>
                  <CommandGroup>
                    {CONVERSION_EVENT_OPTIONS.map((opt) => (
                      <CommandItem
                        key={opt.value}
                        value={opt.value}
                        keywords={[opt.label]}
                        onSelect={() => {
                          onChange({ ...criteria, conversionEvent: opt.value });
                          setConversionEventOpen(false);
                        }}
                        className="text-xs"
                      >
                        <Check
                          className={cn(
                            "mr-2 h-3 w-3",
                            criteria.conversionEvent === opt.value ? "opacity-100" : "opacity-0",
                          )}
                        />
                        {opt.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <p className="text-xs text-muted-foreground">
            The conversion action used to calculate ROAS, CPA, conversions, etc.
          </p>
        </div>
      )}

      {/* Summary */}
      <div className="bg-muted/50 rounded-md p-3">
        <p className="text-sm">
          <span className="font-medium">Rule: </span>
          Scale ads where
          {criteria.aggregation === "adset_average" && (
            <span className="text-muted-foreground"> (ad set averages) </span>
          )}
          {criteria.aggregation === "adset_total" && <span className="text-muted-foreground"> (ad set totals) </span>}
          {criteria.aggregation === "campaign_average" && (
            <span className="text-muted-foreground"> (campaign averages) </span>
          )}
          {criteria.aggregation === "campaign_total" && (
            <span className="text-muted-foreground"> (campaign totals) </span>
          )}{" "}
          {groups.map((group, groupIndex) => (
            <span key={groupIndex}>
              {groupIndex > 0 && <span className="text-primary font-semibold"> OR </span>}
              {groups.length > 1 && "("}
              {group.conditions.map((c, i) => {
                const metricInfo = getMetricInfo(c.metric);
                const isTextMetric = metricInfo.type === "text";
                const isAvgMode =
                  !isTextMetric &&
                  (criteria.aggregation === "average" ||
                    (criteria.aggregation === "mixed" && (c as { aggregation?: string }).aggregation === "average"));
                return (
                  <span key={i}>
                    {i > 0 && <span className="text-primary font-medium"> {group.logic} </span>}
                    <span className="font-medium">{metricInfo.label}</span> {c.operator}{" "}
                    {isTextMetric ? (
                      <span className="italic">"{c.value}"</span>
                    ) : isAvgMode ? (
                      <span className="text-blue-600 font-medium">
                        avg
                        {(c as { averageThresholdPercent?: number }).averageThresholdPercent
                          ? ` × ${(c as { averageThresholdPercent?: number }).averageThresholdPercent}%`
                          : ""}
                      </span>
                    ) : c.metric === AD_AGE_METRIC ? (
                      // Ad Age stores canonical days; render in the saved display unit ("6 months", not "180days").
                      <>{formatAdAgeValue(c.value, c.valueUnit)}</>
                    ) : (
                      <>
                        {metricInfo.isCurrency && currencySymbol}
                        {c.value}
                        {metricInfo.suffix}
                      </>
                    )}
                  </span>
                );
              })}
              {groups.length > 1 && ")"}
            </span>
          ))}{" "}
          {criteria.lookbackDays ? (
            <>
              performance over the last {criteria.lookbackDays} day
              {criteria.lookbackDays > 1 ? "s" : ""}
              {canIncludeToday && criteria.includeToday ? (
                <span className="text-muted-foreground"> (including today)</span>
              ) : criteria.excludeRecentDays && criteria.excludeRecentDays > 0 ? (
                <span className="text-muted-foreground">
                  {" "}
                  (excluding last {criteria.excludeRecentDays} day
                  {criteria.excludeRecentDays > 1 ? "s" : ""})
                </span>
              ) : canIncludeToday ? (
                <span className="text-muted-foreground"> (excluding today)</span>
              ) : (
                <span className="text-muted-foreground"> (including today)</span>
              )}
            </>
          ) : (
            <>lifetime performance</>
          )}
          {criteria.adCreatedWithinDays ? (
            <span className="text-muted-foreground">
              {" "}
              (ads created in last {criteria.adCreatedWithinDays} days
              {criteria.excludeRecentCreatedDays && criteria.excludeRecentCreatedDays > 0
                ? `, excluding last ${criteria.excludeRecentCreatedDays}`
                : ""}
              )
            </span>
          ) : null}
          {hasConversionMetric && (
            <span className="text-muted-foreground">
              {" "}
              (using{" "}
              {CONVERSION_EVENT_OPTIONS.find((o) => o.value === criteria.conversionEvent)?.label ||
                criteria.conversionEvent ||
                "omni_purchase"}{" "}
              conversions)
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
