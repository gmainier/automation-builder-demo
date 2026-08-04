"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Info } from "lucide-react";
import {
  DAY_OF_MONTH_OPTIONS,
  DEFAULT_POLLING_RUN_TIME,
  POLLING_RUN_TIME_STEP_SECONDS,
  POLLING_RUN_TIME_ZONE_LABEL,
  WEEKDAY_OPTIONS,
  applyCheckDaysSelection,
  describePollingSchedule,
  isDayOfMonthGatedFrequency,
  isHourGatedFrequency,
  isWeekdayGatedFrequency,
  normalizeCheckDayOfMonth,
  normalizeCheckDays,
  normalizeRunTimeToHour,
  type PollingScheduleConfig,
} from "../../lib/polling-run-time";

/** A cadence a host trigger offers. Hosts differ: not every trigger supports Manual or Hourly. */
export interface PollingFrequencyOption {
  readonly value: string;
  readonly label: string;
}

/** Cadence value that means "no automatic run"; stored as an absent `checkFrequency`. */
const MANUAL_FREQUENCY = "manual";

/**
 * Cadences offered by the Performance Threshold triggers, which can be left
 * fully manual and support sub-daily polling.
 */
export const PERFORMANCE_THRESHOLD_FREQUENCY_OPTIONS: readonly PollingFrequencyOption[] = [
  { value: MANUAL_FREQUENCY, label: "Manual only (Run button)" },
  { value: "hourly", label: "Hourly (Beta)" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

/**
 * Cadences offered by triggers that compare a window of performance and so need
 * at least a day of data between runs.
 */
export const SCHEDULED_SCAN_FREQUENCY_OPTIONS: readonly PollingFrequencyOption[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

export interface PollingScheduleFieldProps {
  /** The trigger node's stored schedule fields. */
  config: PollingScheduleConfig;
  /** Receives only the changed fields; hosts merge into their own config. */
  onChange: (patch: PollingScheduleConfig) => void;
  /** Cadences this trigger offers, in display order. The first is the fallback. */
  frequencyOptions: readonly PollingFrequencyOption[];
  /**
   * Ad platform named in the rate-limit caveat shown when Hourly is selected,
   * e.g. "Meta". Omit on triggers that do not poll an ad platform, which have
   * no such limit to warn about.
   */
  hourlyRateLimitPlatform?: string;
}

/**
 * Cadence picker for polling triggers, plus the per-rule slot the cadence needs:
 * weekdays for Weekly, a day of month for Monthly, and a run hour for all three
 * calendar-gated cadences.
 *
 * Shared by every trigger that polls on a schedule so the cadences, defaults and
 * wording cannot drift apart between them.
 */
export function PollingScheduleField({
  config,
  onChange,
  frequencyOptions,
  hourlyRateLimitPlatform,
}: PollingScheduleFieldProps): React.JSX.Element {
  const fallbackFrequency = frequencyOptions[0]?.value ?? MANUAL_FREQUENCY;
  const storedFrequency = typeof config.checkFrequency === "string" ? config.checkFrequency : null;
  const selectedFrequency =
    storedFrequency && frequencyOptions.some((option) => option.value === storedFrequency)
      ? storedFrequency
      : fallbackFrequency;

  const handleFrequencyChange = (value: string): void => {
    // Manual is the absence of a cadence, not a cadence — the cron skips rules
    // with no checkFrequency, so storing the string would be a no-op at best.
    onChange({ checkFrequency: value === MANUAL_FREQUENCY ? undefined : value });
  };

  return (
    <div className="space-y-1.5 md:space-y-2">
      <Select value={selectedFrequency} onValueChange={handleFrequencyChange}>
        <SelectTrigger className="h-10 md:h-11 bg-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {frequencyOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hourlyRateLimitPlatform && selectedFrequency === "hourly" && (
        <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 mt-2">
          <Info className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            <span className="font-medium">Beta:</span> Hourly checks are new and run more often, so they can hit{" "}
            {hourlyRateLimitPlatform}&apos;s rate limits. If that happens the rule is auto-paused and you&apos;ll be
            notified (if error notifications are on). Consider Daily if you don&apos;t need hourly.
          </p>
        </div>
      )}

      {isWeekdayGatedFrequency(selectedFrequency) && (
        <WeekdayPicker checkDays={config.checkDays} onChange={(checkDays) => onChange({ checkDays: [...checkDays] })} />
      )}

      {isDayOfMonthGatedFrequency(selectedFrequency) && (
        <DayOfMonthPicker
          checkDayOfMonth={config.checkDayOfMonth}
          onChange={(checkDayOfMonth) => onChange({ checkDayOfMonth })}
        />
      )}

      {isHourGatedFrequency(selectedFrequency) && (
        <RunTimePicker checkTime={config.checkTime} onChange={(checkTime) => onChange({ checkTime })} />
      )}

      <p className="text-xs text-muted-foreground">
        {describePollingSchedule({ ...config, checkFrequency: selectedFrequency })}
      </p>
    </div>
  );
}

interface WeekdayPickerProps {
  checkDays: unknown;
  onChange: (checkDays: readonly string[]) => void;
}

/** Day-of-week toggles for a weekly cadence. At least one day stays selected. */
function WeekdayPicker({ checkDays, onChange }: WeekdayPickerProps): React.JSX.Element {
  const selected = normalizeCheckDays(checkDays);

  return (
    <div className="space-y-1.5 mt-2">
      <Label className="text-xs font-medium">Run on</Label>
      <ToggleGroup
        type="multiple"
        variant="outline"
        value={[...selected]}
        onValueChange={(next: string[]) => onChange(applyCheckDaysSelection(next, checkDays))}
        className="flex-wrap justify-start"
      >
        {WEEKDAY_OPTIONS.map((day) => (
          <ToggleGroupItem
            key={day.value}
            value={day.value}
            aria-label={day.label}
            className="h-10 min-w-10 px-2 bg-white data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          >
            {day.shortLabel}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <p className="text-xs text-muted-foreground">Pick one or more days. Every selected day runs at the time below.</p>
    </div>
  );
}

interface DayOfMonthPickerProps {
  checkDayOfMonth: unknown;
  onChange: (checkDayOfMonth: string) => void;
}

/** Day-of-month picker for a monthly cadence. */
function DayOfMonthPicker({ checkDayOfMonth, onChange }: DayOfMonthPickerProps): React.JSX.Element {
  return (
    <div className="space-y-1.5 mt-2">
      <Label htmlFor="polling-day-of-month" className="text-xs font-medium">
        Day of month
      </Label>
      <Select value={normalizeCheckDayOfMonth(checkDayOfMonth)} onValueChange={onChange}>
        <SelectTrigger id="polling-day-of-month" className="h-10 md:h-11 bg-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DAY_OF_MONTH_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        Only the 1st to the 28th are offered, since not every month has a 29th. Use &quot;Last day of month&quot; to run
        at the end of every month.
      </p>
    </div>
  );
}

interface RunTimePickerProps {
  checkTime: unknown;
  onChange: (checkTime: string) => void;
}

/** Run-hour picker shared by every calendar-gated cadence. */
function RunTimePicker({ checkTime, onChange }: RunTimePickerProps): React.JSX.Element {
  return (
    <div className="space-y-1.5 mt-2">
      <Label htmlFor="polling-run-time" className="text-xs font-medium">
        Run at &mdash; {POLLING_RUN_TIME_ZONE_LABEL}
      </Label>
      <Input
        id="polling-run-time"
        type="time"
        step={POLLING_RUN_TIME_STEP_SECONDS}
        className="h-10 md:h-11 bg-white"
        value={typeof checkTime === "string" ? checkTime : ""}
        onChange={(event) => onChange(normalizeRunTimeToHour(event.target.value))}
      />
      <p className="text-xs text-muted-foreground">
        Runs on the hour. Times are {POLLING_RUN_TIME_ZONE_LABEL}, not your local timezone. Leave empty to use{" "}
        {DEFAULT_POLLING_RUN_TIME}.
      </p>
    </div>
  );
}
