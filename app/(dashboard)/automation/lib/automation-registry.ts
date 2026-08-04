/**
 * Step registry: the single source of truth for what a step can be.
 *
 * A production registry for a tool like this runs to thousands of lines covering
 * every integration the product sells. This is the same structure at a size you
 * can read in one sitting: a representative spread of triggers and actions across
 * scheduling, performance, media and notification — enough vocabulary for an
 * assistant to compose real automations.
 *
 * The shape is what matters. Adding a step here teaches the whole system at once:
 * the canvas, the config panel and the assistant all read this one catalogue.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface TriggerDefinition {
  service: string;
  event: string;
  label: string;
  description: string;
  config: ConfigField[];
  outputs: OutputField[];
  examples?: string[];
}

export interface ActionDefinition {
  service: string;
  event: string;
  label: string;
  description: string;
  config: ConfigField[];
  examples?: string[];
}

export interface ConfigField {
  name: string;
  type: "string" | "number" | "boolean" | "select" | "array";
  label: string;
  required: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  description?: string;
}

export interface OutputField {
  name: string;
  type: string;
  description: string;
}

// ============================================================================
// SHARED OPTIONS
// ============================================================================

type CadenceOptions = NonNullable<ConfigField["options"]>;

/** Cadences for triggers that can be left manual and polled sub-daily. */
export const PERFORMANCE_THRESHOLD_CADENCES: CadenceOptions = [
  { value: "manual", label: "Manual only (Run button)" },
  { value: "hourly", label: "Hourly" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

/** Cadences for triggers that compare windows and need a day between runs. */
export const SCHEDULED_SCAN_CADENCES: CadenceOptions = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const METRIC_OPTIONS: CadenceOptions = [
  { value: "roas", label: "ROAS" },
  { value: "cpa", label: "CPA" },
  { value: "ctr", label: "CTR" },
  { value: "spend", label: "Spend" },
  { value: "frequency", label: "Frequency" },
];

const COMPARISON_OPTIONS: CadenceOptions = [
  { value: "less_than", label: "is below" },
  { value: "greater_than", label: "is above" },
];

const LEVEL_OPTIONS: CadenceOptions = [
  { value: "ad", label: "Ad" },
  { value: "adset", label: "Ad set" },
  { value: "campaign", label: "Campaign" },
];

/** Schedule fields shared by every trigger a scheduler polls on a calendar. */
function scheduleFields(cadences: CadenceOptions, checksFor: string, required = false): ConfigField[] {
  return [
    {
      name: "checkFrequency",
      type: "select",
      label: "Check Frequency",
      required,
      options: cadences,
      description: `How often to automatically check for ${checksFor}.`,
    },
    {
      name: "checkTime",
      type: "string",
      label: "Run At",
      required: false,
      placeholder: "09:00",
      description: "Hour to run, 24-hour. Runs on the hour. Default: 09:00",
    },
  ];
}

// ============================================================================
// TRIGGERS
// ============================================================================

export const TRIGGERS: TriggerDefinition[] = [
  {
    service: "meta-ads",
    event: "Performance Threshold",
    label: "Performance threshold",
    description: "Fires for every ad, ad set or campaign whose metric crosses a threshold you set.",
    config: [
      {
        name: "level",
        type: "select",
        label: "Level",
        required: true,
        options: LEVEL_OPTIONS,
        description: "Which entity the metric is measured on.",
      },
      {
        name: "metric",
        type: "select",
        label: "Metric",
        required: true,
        options: METRIC_OPTIONS,
        description: "The performance metric to evaluate.",
      },
      {
        name: "comparison",
        type: "select",
        label: "Comparison",
        required: true,
        options: COMPARISON_OPTIONS,
        description: "Whether to look above or below the threshold.",
      },
      {
        name: "threshold",
        type: "number",
        label: "Threshold",
        required: true,
        description: "The value the metric is compared against.",
      },
      {
        name: "minimumSpend",
        type: "number",
        label: "Minimum spend",
        required: false,
        description: "Entities below this spend are ignored, so thin data cannot trigger the rule.",
      },
      {
        name: "lookbackWindow",
        type: "number",
        label: "Lookback (days)",
        required: true,
        description: "How many days of performance the metric is measured over.",
      },
      ...scheduleFields(PERFORMANCE_THRESHOLD_CADENCES, "matching entities"),
    ],
    outputs: [
      { name: "adId", type: "string", description: "Id of the matching ad." },
      { name: "adName", type: "string", description: "Name of the matching ad." },
      { name: "roas", type: "number", description: "ROAS over the lookback window." },
      { name: "spend", type: "number", description: "Spend over the lookback window." },
    ],
    examples: ["Pause ads under 1.0 ROAS after 50 spend", "Find ad sets above 3 ROAS"],
  },
  {
    service: "meta-ads",
    event: "Performance Monitoring",
    label: "Performance monitoring",
    description: "Fires when a metric moves by more than a set percentage versus the previous period.",
    config: [
      {
        name: "monitoringLevel",
        type: "select",
        label: "Level",
        required: true,
        options: LEVEL_OPTIONS,
        description: "Which entity to watch.",
      },
      {
        name: "monitoringMetric",
        type: "select",
        label: "Metric",
        required: true,
        options: METRIC_OPTIONS,
        description: "The metric to watch.",
      },
      {
        name: "monitoringDirection",
        type: "select",
        label: "Direction",
        required: true,
        options: [
          { value: "increases", label: "increases by" },
          { value: "decreases", label: "decreases by" },
        ],
        description: "Which way the change must go.",
      },
      {
        name: "monitoringPercentage",
        type: "number",
        label: "Change (%)",
        required: true,
        description: "Percentage change that counts as significant.",
      },
      {
        name: "monitoringComparisonWindow",
        type: "select",
        label: "Compared to",
        required: true,
        options: [
          { value: "day", label: "Previous day" },
          { value: "week", label: "Previous week" },
        ],
        description: "The period the current window is compared against.",
      },
      ...scheduleFields(SCHEDULED_SCAN_CADENCES, "significant changes", true),
    ],
    outputs: [
      { name: "entityName", type: "string", description: "Name of the entity that moved." },
      { name: "previousValue", type: "number", description: "Metric value in the previous period." },
      { name: "currentValue", type: "number", description: "Metric value in the current period." },
      { name: "actualChange", type: "number", description: "Percentage change between them." },
    ],
    examples: ["Tell me when spend drops more than 20% day over day"],
  },
  {
    service: "scheduled",
    event: "Scheduled",
    label: "On a schedule",
    description: "Runs the automation on a recurring cadence, with no condition of its own.",
    config: scheduleFields(SCHEDULED_SCAN_CADENCES, "the scheduled run", true),
    outputs: [{ name: "runAt", type: "string", description: "Timestamp of this run." }],
    examples: ["Every Monday at 9am"],
  },
  {
    service: "manual",
    event: "Manual",
    label: "Manual run",
    description: "Only runs when someone presses Run. Useful while building and testing.",
    config: [],
    outputs: [],
  },
  {
    service: "media-library",
    event: "Media Uploaded to Board",
    label: "Media uploaded",
    description: "Fires when new media lands in a board.",
    config: [
      {
        name: "boardName",
        type: "string",
        label: "Board",
        required: false,
        description: "Leave empty to watch every board.",
      },
      {
        name: "groupingEnabled",
        type: "boolean",
        label: "Wait for a batch",
        required: false,
        description: "Hold uploads until enough have arrived, instead of firing once per file.",
      },
      {
        name: "groupThreshold",
        type: "number",
        label: "Batch size",
        required: false,
        description: "How many files to wait for.",
      },
    ],
    outputs: [
      { name: "mediaId", type: "string", description: "Id of the uploaded file." },
      { name: "mediaUrl", type: "string", description: "URL of the uploaded file." },
      { name: "fileName", type: "string", description: "Original file name." },
    ],
    examples: ["Launch ads when I upload new videos"],
  },
  {
    service: "google-sheets",
    event: "New Row",
    label: "New spreadsheet row",
    description: "Fires for each new row added to a sheet.",
    config: [
      {
        name: "spreadsheetId",
        type: "string",
        label: "Spreadsheet",
        required: true,
        description: "The sheet to watch.",
      },
      {
        name: "sheetName",
        type: "string",
        label: "Tab",
        required: false,
        description: "Which tab to watch. Defaults to the first.",
      },
      ...scheduleFields(SCHEDULED_SCAN_CADENCES, "new rows"),
    ],
    outputs: [{ name: "row", type: "object", description: "The new row, keyed by column header." }],
    examples: ["Duplicate ad sets from a spreadsheet"],
  },
  {
    service: "google-drive",
    event: "New File in Folder",
    label: "New file in folder",
    description: "Fires when a file is added to a folder.",
    config: [
      { name: "folderId", type: "string", label: "Folder", required: true, description: "The folder to watch." },
      ...scheduleFields(SCHEDULED_SCAN_CADENCES, "new files"),
    ],
    outputs: [
      { name: "fileId", type: "string", description: "Id of the new file." },
      { name: "fileName", type: "string", description: "Name of the new file." },
    ],
    examples: ["Create ads from Drive files"],
  },
];

// ============================================================================
// ACTIONS
// ============================================================================

export const ACTIONS: ActionDefinition[] = [
  {
    service: "meta-ads",
    event: "Pause Ad",
    label: "Pause",
    description: "Pauses every entity that reached this step.",
    config: [],
    examples: ["Pause ads that are losing money"],
  },
  {
    service: "meta-ads",
    event: "Increase Budget",
    label: "Change budget",
    description: "Raises or lowers the parent ad set's daily budget.",
    config: [
      {
        name: "budgetChangeType",
        type: "select",
        label: "Change by",
        required: true,
        options: [
          { value: "percentage", label: "Percentage" },
          { value: "fixed", label: "Fixed amount" },
        ],
        description: "Whether the value is a percentage or an absolute amount.",
      },
      {
        name: "budgetChangeValue",
        type: "number",
        label: "Amount",
        required: true,
        description: "How much to change the budget by.",
      },
    ],
    examples: ["Increase budget by 20% on winners"],
  },
  {
    service: "meta-ads",
    event: "Duplicate Ad",
    label: "Duplicate ad",
    description: "Copies matching ads, optionally into a different ad set.",
    config: [
      {
        name: "targetAdSetId",
        type: "string",
        label: "Target ad set",
        required: false,
        description: "Leave empty to duplicate in place.",
      },
      {
        name: "duplicateStatus",
        type: "select",
        label: "Created as",
        required: false,
        options: [
          { value: "PAUSED", label: "Paused (review first)" },
          { value: "ACTIVE", label: "Active" },
        ],
        description: "Whether copies go live immediately.",
      },
    ],
    examples: ["Duplicate my best performing ads"],
  },
  {
    service: "meta-ads",
    event: "Launch Ad",
    label: "Launch ad",
    description: "Creates a new ad from the trigger's media.",
    config: [
      {
        name: "targetAdSetId",
        type: "string",
        label: "Target ad set",
        required: true,
        description: "Where the new ad is created.",
      },
      {
        name: "adNameTemplate",
        type: "string",
        label: "Ad name",
        required: false,
        description: "Supports tokens such as {{trigger.fileName}}.",
      },
    ],
    examples: ["Launch ads when I upload new videos"],
  },
  {
    service: "notification",
    event: "Send Notification",
    label: "Send notification",
    description: "Reports what the automation did.",
    config: [
      {
        name: "notificationMethod",
        type: "select",
        label: "Channel",
        required: true,
        options: [
          { value: "slack", label: "Slack" },
          { value: "email", label: "Email" },
          { value: "both", label: "Slack and email" },
        ],
        description: "Where the summary is delivered.",
      },
      {
        name: "customMessage",
        type: "string",
        label: "Message",
        required: false,
        description: "Supports tokens such as {{trigger.adName}} and {{trigger.roas}}.",
      },
    ],
    examples: ["Tell me on Slack when it runs"],
  },
  {
    service: "webhook",
    event: "Send Webhook",
    label: "Send webhook",
    description: "POSTs the trigger's output to a URL.",
    config: [
      {
        name: "webhookUrl",
        type: "string",
        label: "URL",
        required: true,
        placeholder: "https://",
        description: "Where to POST.",
      },
      {
        name: "webhookSecret",
        type: "string",
        label: "Signing secret",
        required: false,
        description: "Sent as a signature header so the receiver can verify the call.",
      },
    ],
  },
  {
    service: "google-sheets",
    event: "Append Row",
    label: "Append spreadsheet row",
    description: "Writes a row recording what happened.",
    config: [
      {
        name: "spreadsheetId",
        type: "string",
        label: "Spreadsheet",
        required: true,
        description: "The sheet to write to.",
      },
      { name: "sheetName", type: "string", label: "Tab", required: false, description: "Which tab to write to." },
    ],
    examples: ["Log my ad launches to a spreadsheet"],
  },
];

// ============================================================================
// ASSISTANT SYSTEM PROMPT
// ============================================================================

/** Renders one step as a line the model can read. */
function describeStep(step: TriggerDefinition | ActionDefinition): string {
  const fields = step.config.map((field) => `${field.name}${field.required ? "*" : ""}`).join(", ") || "no config";
  return `- ${step.service} / "${step.event}": ${step.description} Config: ${fields}`;
}

/**
 * Builds the assistant's system prompt from the catalogue above.
 *
 * Generated rather than hand-written so a step added to the registry is one the
 * assistant immediately knows about, with no second place to remember to update.
 */
export function generateSystemPrompt(): string {
  return [
    "You build ad automations as a flow of steps.",
    "A flow has exactly one trigger, then any number of filters and actions.",
    "",
    "TRIGGERS:",
    ...TRIGGERS.map(describeStep),
    "",
    "ACTIONS:",
    ...ACTIONS.map(describeStep),
    "",
    "Fields marked * are required. Never invent a service or event outside this list.",
  ].join("\n");
}

export const COPILOT_SYSTEM_PROMPT = generateSystemPrompt();

// ============================================================================
// SUGGESTED PROMPTS
// ============================================================================

export interface SuggestedPrompt {
  readonly text: string;
  readonly description: string;
  /** "suggest" routes the chip into the account-scanning recommend flow instead of building directly. */
  readonly mode?: "suggest";
}

export const SUGGESTED_PROMPTS: readonly SuggestedPrompt[] = [
  {
    text: "Suggest me an automation",
    description: "Scans the account and recommends automations",
    mode: "suggest",
  },
  {
    text: "Launch ads when I upload new videos",
    description: "Auto-create ads from media library uploads",
  },
  {
    text: "Duplicate my best performing ads",
    description: "Scale ads with high ROAS automatically",
  },
  {
    text: "Pause ads that are losing money",
    description: "Stop ads with poor performance",
  },
  {
    text: "Create ads from Drive files",
    description: "Launch ads when files are added to a folder",
  },
  {
    text: "When a campaign is paused, notify me",
    description: "Detect campaigns that change to paused status",
  },
];

// ============================================================================
// COPILOT RESPONSE TYPE
// ============================================================================

export type CopilotResponse = {
  message: string;
  steps?: Array<{
    id: string;
    type: "trigger" | "action" | "filter";
    service: string;
    event: string;
    config?: Record<string, unknown>;
  }>;
};
