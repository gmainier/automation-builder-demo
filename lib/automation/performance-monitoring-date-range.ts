export const PERFORMANCE_MONITORING_WEEKDAYS = [
  { value: "monday", label: "Monday", dayIndex: 1 },
  { value: "tuesday", label: "Tuesday", dayIndex: 2 },
  { value: "wednesday", label: "Wednesday", dayIndex: 3 },
  { value: "thursday", label: "Thursday", dayIndex: 4 },
  { value: "friday", label: "Friday", dayIndex: 5 },
  { value: "saturday", label: "Saturday", dayIndex: 6 },
  { value: "sunday", label: "Sunday", dayIndex: 0 },
] as const;

export type PerformanceMonitoringWeekday = (typeof PERFORMANCE_MONITORING_WEEKDAYS)[number]["value"];
export type PerformanceMonitoringComparisonWindow = "day" | "week" | "custom";

export const DEFAULT_PERFORMANCE_MONITORING_RANGE_START_DAY: PerformanceMonitoringWeekday = "monday";
export const DEFAULT_PERFORMANCE_MONITORING_RANGE_END_DAY: PerformanceMonitoringWeekday = "sunday";

export interface PerformanceMonitoringDateRange {
  since: string;
  until: string;
}

export interface PerformanceMonitoringDateRanges {
  current: PerformanceMonitoringDateRange;
  previous: PerformanceMonitoringDateRange;
  label: string;
  timezone: string;
}

export interface PerformanceMonitoringPeriodConfig {
  today: string;
  comparisonWindow: PerformanceMonitoringComparisonWindow;
  customStartDay?: PerformanceMonitoringWeekday;
  customEndDay?: PerformanceMonitoringWeekday;
}

export interface PerformanceMonitoringDateRangeConfig extends PerformanceMonitoringPeriodConfig {
  timezone?: string;
}

const WEEKDAY_INDEX = new Map<PerformanceMonitoringWeekday, number>(
  PERFORMANCE_MONITORING_WEEKDAYS.map(({ value, dayIndex }) => [value, dayIndex]),
);

const WEEKDAY_LABEL = new Map<PerformanceMonitoringWeekday, string>(
  PERFORMANCE_MONITORING_WEEKDAYS.map(({ value, label }) => [value, label]),
);

function parseDateKey(dateKey: string): Date {
  const date = new Date(`${dateKey}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || Number.isNaN(date.getTime()) || formatUtcDateKey(date) !== dateKey) {
    throw new Error(`Invalid calendar date: ${dateKey}`);
  }
  return date;
}

function formatUtcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shiftDateKey(dateKey: string, days: number): string {
  const date = parseDateKey(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return formatUtcDateKey(date);
}

function weekdayIndex(dateKey: string): number {
  return parseDateKey(dateKey).getUTCDay();
}

function resolveCustomDays(
  customStartDay?: PerformanceMonitoringWeekday,
  customEndDay?: PerformanceMonitoringWeekday,
): {
  startDay: PerformanceMonitoringWeekday;
  endDay: PerformanceMonitoringWeekday;
} {
  return {
    startDay: customStartDay ?? DEFAULT_PERFORMANCE_MONITORING_RANGE_START_DAY,
    endDay: customEndDay ?? DEFAULT_PERFORMANCE_MONITORING_RANGE_END_DAY,
  };
}

function getPeriodShape(config: PerformanceMonitoringPeriodConfig): {
  latestEnd: string;
  durationDays: number;
  stepDays: number;
} {
  const yesterday = shiftDateKey(config.today, -1);

  if (config.comparisonWindow === "day") {
    return { latestEnd: yesterday, durationDays: 1, stepDays: 1 };
  }

  if (config.comparisonWindow === "week") {
    return { latestEnd: yesterday, durationDays: 7, stepDays: 7 };
  }

  const { startDay, endDay } = resolveCustomDays(config.customStartDay, config.customEndDay);
  const startIndex = WEEKDAY_INDEX.get(startDay);
  const endIndex = WEEKDAY_INDEX.get(endDay);
  if (startIndex === undefined || endIndex === undefined) {
    throw new Error("Invalid custom reporting weekday");
  }

  const daysSinceSelectedEnd = (weekdayIndex(yesterday) - endIndex + 7) % 7;
  const latestEnd = shiftDateKey(yesterday, -daysSinceSelectedEnd);
  const durationDays = ((endIndex - startIndex + 7) % 7) + 1;

  return { latestEnd, durationDays, stepDays: 7 };
}

export function isPerformanceMonitoringWeekday(value: unknown): value is PerformanceMonitoringWeekday {
  return typeof value === "string" && WEEKDAY_INDEX.has(value as PerformanceMonitoringWeekday);
}

export function normalizePerformanceMonitoringWeekday(
  value: unknown,
  fallback: PerformanceMonitoringWeekday,
): PerformanceMonitoringWeekday {
  return isPerformanceMonitoringWeekday(value) ? value : fallback;
}

export function normalizePerformanceMonitoringComparisonWindow(value: unknown): PerformanceMonitoringComparisonWindow {
  return value === "week" || value === "custom" ? value : "day";
}

export function formatLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getPerformanceMonitoringComparisonLabel(
  comparisonWindow: PerformanceMonitoringComparisonWindow,
  customStartDay?: PerformanceMonitoringWeekday,
  customEndDay?: PerformanceMonitoringWeekday,
): string {
  if (comparisonWindow === "day") return "day over day";
  if (comparisonWindow === "week") return "week over week";

  const { startDay, endDay } = resolveCustomDays(customStartDay, customEndDay);
  return `${WEEKDAY_LABEL.get(startDay)}–${WEEKDAY_LABEL.get(endDay)} vs prior week`;
}

export function getPerformanceMonitoringComparisonDescription(
  comparisonWindow: PerformanceMonitoringComparisonWindow,
  customStartDay?: PerformanceMonitoringWeekday,
  customEndDay?: PerformanceMonitoringWeekday,
): string {
  if (comparisonWindow === "day") return "Compares yesterday vs the day before";
  if (comparisonWindow === "week") return "Compares last 7 days vs prior 7 days";

  const { startDay, endDay } = resolveCustomDays(customStartDay, customEndDay);
  return `Compares the last completed ${WEEKDAY_LABEL.get(startDay)}–${WEEKDAY_LABEL.get(
    endDay,
  )} range vs the same range one week earlier`;
}

export function buildPerformanceMonitoringPeriodBuckets(
  config: PerformanceMonitoringPeriodConfig,
  count: number,
): PerformanceMonitoringDateRange[] {
  if (!Number.isInteger(count) || count < 1) {
    throw new Error("Period bucket count must be a positive integer");
  }

  const { latestEnd, durationDays, stepDays } = getPeriodShape(config);
  const buckets: PerformanceMonitoringDateRange[] = [];

  for (let index = count - 1; index >= 0; index -= 1) {
    const until = shiftDateKey(latestEnd, -index * stepDays);
    buckets.push({
      since: shiftDateKey(until, -(durationDays - 1)),
      until,
    });
  }

  return buckets;
}

export function buildPerformanceMonitoringDateRanges(
  config: PerformanceMonitoringDateRangeConfig,
): PerformanceMonitoringDateRanges {
  const [previous, current] = buildPerformanceMonitoringPeriodBuckets(config, 2);

  return {
    current,
    previous,
    label: getPerformanceMonitoringComparisonLabel(config.comparisonWindow, config.customStartDay, config.customEndDay),
    timezone: config.timezone ?? "UTC",
  };
}
