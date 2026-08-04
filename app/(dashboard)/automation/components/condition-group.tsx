"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Trash2, Plus, Check, ChevronsUpDown, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { AggregationLevel, CriteriaCondition, CriteriaGroup } from "@/types/auto-scale";
import {
  AD_AGE_METRIC,
  AD_AGE_UNITS,
  METRICS_BY_GROUP,
  adAgeDaysToUnit,
  adAgeUnitToDays,
  getMetricByValue,
  snapAdAgeDaysForOperator,
  type AdAgeUnit,
  type AutomationMetric,
} from "@/types/automation-metrics";
import type { AutomationAdsPlatform } from "../lib/automation-platform-labels";
import { findUnsatisfiableTextConditions } from "../lib/unsatisfiable-conditions";

// Operators available per metric type (numeric vs. text).
const OPERATORS = [
  { value: ">", label: ">", forType: "number" },
  { value: ">=", label: ">=", forType: "number" },
  { value: "<", label: "<", forType: "number" },
  { value: "<=", label: "<=", forType: "number" },
  { value: "=", label: "=", forType: "number" },
  { value: "contains", label: "contains", forType: "text" },
  { value: "not_contains", label: "doesn't contain", forType: "text" },
  { value: "equals", label: "equals", forType: "text" },
  { value: "starts_with", label: "starts with", forType: "text" },
  { value: "ends_with", label: "ends with", forType: "text" },
];

// Metric catalog + resolver shared from the parent (includes custom-event and
// workspace custom metrics discovered at runtime).
export interface MetricCatalog {
  customEventMetrics: AutomationMetric[];
  workspaceCustomMetrics: AutomationMetric[];
  getMetricInfo: (metric: string) => AutomationMetric;
  /**
   * When set, the metric picker only offers metrics whose `value` is in this
   * set. The resolver (`getMetricInfo`) is unaffected, so already-saved metrics
   * outside the set still render. Absent = all metrics selectable.
   */
  allowedMetricValues?: Set<string>;
  /**
   * Ads platform hosting the builder. Metrics that declare `platforms` are only
   * offered when they include this platform; already-saved conditions still
   * resolve and render. Absent = no platform gating.
   */
  platform?: AutomationAdsPlatform;
}

// ---------------------------------------------------------------------------
// MetricPicker — the searchable metric dropdown grouped by category.
// ---------------------------------------------------------------------------
interface MetricPickerProps {
  value: string;
  label: string;
  catalog: MetricCatalog;
  onSelect: (metric: string) => void;
}

function MetricPicker({ value, label, catalog, onSelect }: MetricPickerProps) {
  const [open, setOpen] = useState(false);
  const { customEventMetrics, workspaceCustomMetrics, allowedMetricValues, platform } = catalog;

  // Restrict each group to the allow-list (when provided) and to metrics offered
  // on this builder's ads platform; otherwise pass through.
  const filterAllowed = (metrics: AutomationMetric[]): AutomationMetric[] =>
    metrics.filter(
      (m) =>
        (!allowedMetricValues || allowedMetricValues.has(m.value)) &&
        (!m.platforms || !platform || m.platforms.includes(platform as (typeof m.platforms)[number])),
    );

  const renderGroup = (heading: string, metrics: AutomationMetric[]) =>
    metrics.length > 0 && (
      <CommandGroup heading={heading}>
        {metrics.map((m) => (
          <CommandItem
            key={m.value}
            value={m.value}
            keywords={[m.label]}
            title={m.description}
            onSelect={() => {
              onSelect(m.value);
              setOpen(false);
            }}
            className="text-xs"
          >
            <Check className={cn("mr-2 h-3 w-3", value === m.value ? "opacity-100" : "opacity-0")} />
            {m.label}
          </CommandItem>
        ))}
      </CommandGroup>
    );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[130px] h-9 text-xs px-2 justify-between font-normal"
        >
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search metric..." className="text-xs" />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>No metric found.</CommandEmpty>
            {renderGroup("Performance", filterAllowed(METRICS_BY_GROUP.performance))}
            {renderGroup("Conversion", filterAllowed(METRICS_BY_GROUP.conversion))}
            {renderGroup("Video", filterAllowed(METRICS_BY_GROUP.video))}
            {renderGroup("Engagement", filterAllowed(METRICS_BY_GROUP.engagement))}
            {renderGroup("Custom Events", filterAllowed(customEventMetrics))}
            {renderGroup("Custom", filterAllowed(workspaceCustomMetrics))}
            {renderGroup("Text Filter", filterAllowed(METRICS_BY_GROUP.text))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// AdAgeValueControls — number input + Days/Weeks/Months unit for the Ad Age
// metric. Canonical `value` is always stored in days; the unit is display-only.
// ---------------------------------------------------------------------------
interface AdAgeValueControlsProps {
  condition: CriteriaCondition;
  onChange: (condition: CriteriaCondition) => void;
}

function AdAgeValueControls({ condition, onChange }: AdAgeValueControlsProps) {
  const unit = (condition as { valueUnit?: AdAgeUnit }).valueUnit ?? "days";
  const storedDays = typeof condition.value === "number" ? condition.value : parseFloat(condition.value) || 0;

  // Local text keeps in-progress typing visible ("1." while entering "1.5");
  // every commit converts the displayed amount back to canonical days.
  const [text, setText] = useState(() => String(adAgeDaysToUnit(storedDays, unit)));
  const [lastCommittedDays, setLastCommittedDays] = useState(storedDays);
  const [lastCommittedUnit, setLastCommittedUnit] = useState(unit);
  if (storedDays !== lastCommittedDays || unit !== lastCommittedUnit) {
    // External change (e.g. removing a row above shifts another adAge condition
    // into this slot): re-derive the displayed amount from the incoming state.
    // Both days AND unit must match — two conditions can share the same days
    // (180d vs 6mo) and differ only in unit, so a days-only check would keep
    // stale text that a mere focus+blur would then commit as the wrong value.
    setLastCommittedDays(storedDays);
    setLastCommittedUnit(unit);
    setText(String(adAgeDaysToUnit(storedDays, unit)));
  }

  const commit = (displayedAmount: number, nextUnit: AdAgeUnit) => {
    const nextDays = adAgeUnitToDays(displayedAmount, nextUnit, String(condition.operator));
    setLastCommittedDays(nextDays);
    setLastCommittedUnit(nextUnit);
    onChange({ ...condition, value: nextDays, valueUnit: nextUnit } as CriteriaCondition);
  };

  return (
    <>
      <Input
        type="text"
        inputMode="decimal"
        value={text}
        onChange={(e) => {
          const val = e.target.value;
          if (val === "" || /^[0-9]*\.?[0-9]*$/.test(val)) {
            setText(val);
            commit(parseFloat(val) || 0, unit);
          }
        }}
        onBlur={() => {
          const typedAmount = parseFloat(text) || 0;
          // If the field wasn't edited, `text` is a lossy 2-decimal rounding of
          // storedDays (e.g. 10 days shows as "0.33" months). Re-deriving days
          // from it would drift the stored value (0.33 months → 9.9 days), so an
          // unedited focus+blur must NOT re-commit — keep storedDays, only
          // normalize the display.
          if (typedAmount === adAgeDaysToUnit(storedDays, unit)) {
            setText(String(adAgeDaysToUnit(storedDays, unit)));
            return;
          }
          // Edited: re-derive the display from the committed canonical days so
          // `=`'s whole-day snapping is visible immediately ("1.5" weeks →
          // "1.57"), not only after a reload. Inequalities keep the fraction.
          setText(String(adAgeDaysToUnit(adAgeUnitToDays(typedAmount, unit, String(condition.operator)), unit)));
          commit(typedAmount, unit);
        }}
        placeholder="0"
        className="h-9 text-xs bg-white w-[60px]"
      />
      {/* Unit selector — converts the display but preserves the stored DURATION:
          "180 Days" → Months shows "6" and still stores 180 days. Reinterpreting
          the current number in the new unit would change the duration by the unit
          factor (180 days → 180 months → 5,400 days). */}
      <Select
        value={unit}
        onValueChange={(v) => {
          const nextUnit = v as AdAgeUnit;
          setText(String(adAgeDaysToUnit(storedDays, nextUnit)));
          setLastCommittedDays(storedDays);
          setLastCommittedUnit(nextUnit);
          onChange({ ...condition, value: storedDays, valueUnit: nextUnit } as CriteriaCondition);
        }}
      >
        <SelectTrigger className="h-9 w-20 text-xs px-2">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {AD_AGE_UNITS.map((unitOption) => (
            <SelectItem key={unitOption.value} value={unitOption.value}>
              {unitOption.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}

// ---------------------------------------------------------------------------
// ConditionRow — a single metric / operator / value row.
// ---------------------------------------------------------------------------
interface ConditionRowProps {
  condition: CriteriaCondition;
  aggregation: AggregationLevel;
  currencySymbol: string;
  catalog: MetricCatalog;
  canRemove: boolean;
  onChange: (condition: CriteriaCondition) => void;
  onRemove: () => void;
}

function ConditionRow({
  condition,
  aggregation,
  currencySymbol,
  catalog,
  canRemove,
  onChange,
  onRemove,
}: ConditionRowProps) {
  const metricInfo = catalog.getMetricInfo(condition.metric);
  const isTextMetric = metricInfo.type === "text";
  const filteredOperators = OPERATORS.filter((op) => op.forType === metricInfo.type);

  // Per-condition aggregation: only "mixed" mode lets each row override; otherwise
  // the criteria-level setting applies (text metrics are always per-ad).
  const conditionAggregation = isTextMetric
    ? "per_ad"
    : aggregation === "mixed"
      ? (condition as { aggregation?: string }).aggregation || "per_ad"
      : aggregation;
  const isConditionAvg = conditionAggregation === "average";

  const currentOpValid = filteredOperators.some((op) => op.value === condition.operator);
  const displayOperator = currentOpValid ? condition.operator : filteredOperators[0]?.value || condition.operator;

  const handleMetricChange = (newMetric: string) => {
    const info = getMetricByValue(newMetric);
    const nextIsText = info?.type === "text";
    // Strip any previous duration unit so it never leaks onto a non-duration
    // metric; Ad Age starts at 0 canonical days with an explicit "days" unit.
    const { valueUnit: _previousValueUnit, ...baseCondition } = condition as CriteriaCondition & {
      valueUnit?: AdAgeUnit;
    };
    onChange({
      ...baseCondition,
      metric: newMetric,
      operator: (nextIsText ? "contains" : ">") as CriteriaCondition["operator"],
      value: (nextIsText ? "" : 0) as CriteriaCondition["value"],
      ...(newMetric === AD_AGE_METRIC ? { valueUnit: "days" as const } : {}),
    } as CriteriaCondition);
  };

  const setMixedAggregation = (mode: "per_ad" | "average") =>
    onChange({ ...condition, aggregation: mode } as CriteriaCondition);

  return (
    <div className={isTextMetric ? "space-y-2" : ""}>
      <div className="flex items-center gap-1.5">
        <MetricPicker
          value={condition.metric}
          label={metricInfo.label}
          catalog={catalog}
          onSelect={handleMetricChange}
        />

        <Select
          value={displayOperator}
          onValueChange={(v) => {
            const next = { ...condition, operator: v as CriteriaCondition["operator"] } as CriteriaCondition;
            // An Ad Age threshold saved under an inequality may be fractional
            // (10.5 days); switching to `=` must re-snap it to whole days or
            // the condition can never match an integer-floored age.
            if (condition.metric === AD_AGE_METRIC && typeof next.value === "number") {
              next.value = snapAdAgeDaysForOperator(next.value, v) as CriteriaCondition["value"];
            }
            onChange(next);
          }}
        >
          <SelectTrigger className={cn("h-9 text-xs px-2", isTextMetric ? "w-[132px]" : "w-[55px]")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {filteredOperators.map((op) => (
              <SelectItem key={op.value} value={op.value}>
                {op.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Value: number input for per_ad, "avg × X%" for average mode */}
        {!isTextMetric && isConditionAvg ? (
          <div className="flex items-center gap-1 shrink-0">
            {aggregation === "mixed" && (
              <button
                type="button"
                onClick={() => setMixedAggregation("per_ad")}
                className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border transition-colors bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100"
              >
                Avg
              </button>
            )}
            <span className="text-xs text-blue-600 font-medium">avg</span>
            <span className="text-xs text-muted-foreground">×</span>
            <Input
              type="text"
              inputMode="decimal"
              value={(condition as { averageThresholdPercent?: number }).averageThresholdPercent ?? ""}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "" || /^[0-9]*\.?[0-9]*$/.test(val)) {
                  onChange({
                    ...condition,
                    averageThresholdPercent: val === "" ? undefined : parseFloat(val) || 0,
                  } as CriteriaCondition);
                }
              }}
              placeholder="100"
              className="h-9 text-xs bg-white w-[45px]"
            />
            <span className="text-xs text-muted-foreground">%</span>
          </div>
        ) : !isTextMetric ? (
          <div className="flex items-center gap-0.5 flex-1 min-w-0">
            {aggregation === "mixed" && (
              <button
                type="button"
                onClick={() => setMixedAggregation("average")}
                className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border transition-colors bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 mr-1"
              >
                Per Ad
              </button>
            )}
            {metricInfo.isCurrency && <span className="text-xs text-muted-foreground">{currencySymbol}</span>}
            {condition.metric === AD_AGE_METRIC ? (
              // Ad Age: unit selector replaces the generic "days" suffix span.
              <AdAgeValueControls condition={condition} onChange={onChange} />
            ) : (
              <>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={condition.value}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "" || /^[0-9]*\.?[0-9]*$/.test(val)) {
                      onChange({
                        ...condition,
                        value: (val === "" ? "" : val) as CriteriaCondition["value"],
                      } as CriteriaCondition);
                    }
                  }}
                  onBlur={(e) =>
                    onChange({
                      ...condition,
                      value: (parseFloat(e.target.value) || 0) as CriteriaCondition["value"],
                    } as CriteriaCondition)
                  }
                  placeholder="0"
                  className="h-9 text-xs bg-white w-[60px]"
                />
                {metricInfo.suffix && <span className="text-xs text-muted-foreground">{metricInfo.suffix}</span>}
              </>
            )}
          </div>
        ) : null}

        {canRemove && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Text input on its own row for text metrics */}
      {isTextMetric && (
        <Input
          type="text"
          value={condition.value}
          onChange={(e) => onChange({ ...condition, value: e.target.value } as CriteriaCondition)}
          placeholder="e.g., promo, test, scale"
          className="h-9 text-xs bg-white"
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ConditionGroup — one OR-branch: a list of AND/OR-combined conditions.
// ---------------------------------------------------------------------------
interface ConditionGroupProps {
  group: CriteriaGroup;
  groupIndex: number;
  aggregation: AggregationLevel;
  currencySymbol: string;
  catalog: MetricCatalog;
  canRemoveGroup: boolean;
  onChange: (group: CriteriaGroup) => void;
  onRemoveGroup: () => void;
}

const NEW_CONDITION: CriteriaCondition = { metric: "spend", operator: ">", value: 0 };

export function ConditionGroup({
  group,
  groupIndex,
  aggregation,
  currencySymbol,
  catalog,
  canRemoveGroup,
  onChange,
  onRemoveGroup,
}: ConditionGroupProps) {
  const updateConditionAt = (index: number, condition: CriteriaCondition) =>
    onChange({ ...group, conditions: group.conditions.map((c, i) => (i === index ? condition : c)) });

  const addCondition = () => onChange({ ...group, conditions: [...group.conditions, { ...NEW_CONDITION }] });

  const removeConditionAt = (index: number) => {
    if (group.conditions.length <= 1) return;
    onChange({ ...group, conditions: group.conditions.filter((_, i) => i !== index) });
  };

  // AND-joined text conditions on the same field can never all match one ad, so
  // the rule would silently return 0 matches.
  const unsatisfiable = findUnsatisfiableTextConditions(group);

  return (
    <div className="rounded-md border border-muted-foreground/15 bg-muted/20 p-3 space-y-2.5">
      {/* Group header: label + within-group AND/OR + remove */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Group {groupIndex + 1}
        </span>
        <div className="flex items-center gap-1.5">
          {group.conditions.length > 1 && (
            <Select value={group.logic} onValueChange={(v) => onChange({ ...group, logic: v as "AND" | "OR" })}>
              <SelectTrigger className="w-[72px] h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AND">AND</SelectItem>
                <SelectItem value="OR">OR</SelectItem>
              </SelectContent>
            </Select>
          )}
          {canRemoveGroup && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onRemoveGroup}
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
              aria-label={`Remove group ${groupIndex + 1}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {unsatisfiable && (
        <div role="alert" className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-2.5">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-600 mt-0.5" />
          <p className="text-xs text-amber-800">
            These conditions are combined with <span className="font-medium">AND</span>, so an ad must match all{" "}
            {unsatisfiable.values.length} at once. No single ad can do that, so this group will match{" "}
            <span className="font-medium">0 ads</span>. Switch the toggle above to{" "}
            <span className="font-medium">OR</span> to match any of them.
          </p>
        </div>
      )}

      {group.conditions.map((condition, index) => (
        <ConditionRow
          key={index}
          condition={condition}
          aggregation={aggregation}
          currencySymbol={currencySymbol}
          catalog={catalog}
          canRemove={group.conditions.length > 1}
          onChange={(c) => updateConditionAt(index, c)}
          onRemove={() => removeConditionAt(index)}
        />
      ))}

      <Button variant="outline" size="sm" onClick={addCondition} className="w-full h-8">
        <Plus className="h-3.5 w-3.5 mr-2" />
        Add Condition
      </Button>
    </div>
  );
}
