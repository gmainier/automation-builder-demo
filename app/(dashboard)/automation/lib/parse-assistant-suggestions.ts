/**
 * Parse ranked automation suggestions from suggest-mode assistant replies and
 * structured payloads from the scan_account_insights MCP tool.
 */

export interface ParsedAutomationSuggestion {
  readonly rank: number;
  readonly title: string;
  readonly subtitle?: string;
  readonly details: string;
  /** Message sent to the assistant when the user picks this suggestion. */
  readonly buildMessage: string;
  /** Enriched-signal type when this card came from a data-grounded scan signal (for the UI chip). */
  readonly signalType?: string;
}

/** One enriched signal surfaced by the scan (trend / fatigue / funnel / placement / action leak). */
export interface EnrichedScanSignal {
  readonly type: string;
  readonly reason: string;
  readonly suggestion: string;
  readonly adName?: string;
}

/** Same signal type rolled up across multiple ads (e.g. five trend_cpa_rise rows → one card). */
export interface AggregatedEnrichedSignal {
  readonly type: string;
  readonly reasons: readonly string[];
  readonly suggestion: string;
}

/** Collapse per-ad enriched signals into one entry per signal type, preserving scan order. */
export function aggregateEnrichedSignalsByType(signals: readonly EnrichedScanSignal[]): AggregatedEnrichedSignal[] {
  const order: string[] = [];
  const groups = new Map<string, { reasons: string[]; suggestion: string }>();

  for (const signal of signals) {
    const existing = groups.get(signal.type);
    if (existing) {
      existing.reasons.push(signal.reason);
      continue;
    }
    order.push(signal.type);
    groups.set(signal.type, { reasons: [signal.reason], suggestion: signal.suggestion });
  }

  return order.map((type) => {
    const group = groups.get(type);
    return {
      type,
      reasons: group?.reasons ?? [],
      suggestion: group?.suggestion ?? "",
    };
  });
}

export interface AccountInsightsScanSummary {
  readonly lookbackDays: number;
  readonly behaviorSignals: ReadonlyArray<{
    readonly action: string;
    readonly count: number;
    readonly suggestion: string;
  }>;
  readonly totals: {
    readonly spend: number;
    readonly adCount: number;
    readonly blendedRoas: number;
    readonly conversions: number;
  };
  readonly winnersCount: number;
  readonly losersCount: number;
  readonly scalingCandidatesCount: number;
  /** Data-grounded signals from the enriched scan, ranked above generic guardrails. */
  readonly enrichedSignals: ReadonlyArray<EnrichedScanSignal>;
}

interface SuggestionHeaderMatch {
  readonly rank: number;
  readonly title: string;
  readonly subtitle?: string;
  readonly index: number;
  readonly length: number;
}

/** Core inline match: `1. **Title**` anywhere in the text. */
const SIMPLE_INLINE_NUMBERED_BOLD = /(\d+)\.\s+\*\*([^*]+)\*\*/g;

/** Inline bold-prefix: `**1. Title**`. */
const INLINE_BOLD_PREFIX = /\*\*(\d+)\.\s+([^*]+)\*\*/g;

/** Markdown heading numbered: `### 1. Title`. */
const HEADING_NUMBERED = /^#{1,4}\s*(\d+)\.\s+(.+?)\s*$/gm;

/** Plain numbered title line (no bold). */
const INLINE_PLAIN_NUMBERED = /(?:^|\n)\s*(\d+)\.\s+([^*\n:]+?)(?:\s*(?:\(([^)]*)\)|[—–-]\s*([^\n]+?)))?\s*(?=\n|$)/gm;

/** Section headers without numbers: `**Auto-duplicate winning ad sets**` before Why/Trigger bullets. */
const BOLD_SECTION_HEADER =
  /(?:^|\n)\s*\*\*([^*\n]{8,80})\*\*(?:\s*(?:\(([^)]*)\)|[—–-]\s*([^\n*]+?)))?\s*(?=\n\s*[-*]\s*\*\*(?:Why|Trigger|Action|Impact))/gi;

/** Meta / unblock options the assistant offers when scan fails — not buildable automations. */
const META_SUGGESTION_TITLE_PATTERN =
  /^(?:retry(?:\s|$)|tell me(?:\s+a)?\s+goal|wait(?:\s+a)?\s+minute|try again|scan again|unblock|pick one|choose one|say the word)/i;

const AUTOMATION_CONTENT_PATTERN =
  /\b(auto[- ]|duplicate|pause|scale|launch|notify|threshold|roas|underperform|winning|cross-channel|meta →|tiktok|slack|performance digest|performance threshold)\b/i;

interface BuildSuggestionPickInput {
  readonly rank: number;
  readonly title: string;
  readonly subtitle?: string;
  readonly details?: string;
}

/** Build the user message that tells the assistant to implement one ranked suggestion. */
export function buildSuggestionPickMessage(suggestion: BuildSuggestionPickInput): string {
  const spec = normalizeSuggestionDetails(suggestion.details ?? "", suggestion.subtitle).trim();
  const specBlock = spec.length > 0 ? `\n\nExact spec from your recommendation:\n${spec}` : "";
  return (
    `Build suggestion #${suggestion.rank}: "${suggestion.title}".${specBlock}\n\n` +
    "You MUST build this on the canvas now using automation_start_flow once, then automation_add_step for each node. " +
    "Do not reply with text-only analysis — call the builder tools. " +
    "Apply the full trigger criteria (every condition) and all actions via automation_add_step / " +
    "automation_update_step. Put criteria.conditions in the trigger config — do not leave the default spend > 0 placeholder."
  );
}

function extractSubtitleAfterHeader(text: string, headerEnd: number, nextHeaderStart: number): string | undefined {
  const slice = text.slice(headerEnd, nextHeaderStart).trim();
  const parenMatch = slice.match(/^\(([^)]*)\)/);
  if (parenMatch?.[1]) return parenMatch[1].trim();
  const dashMatch = slice.match(/^[—–-]\s*([^\n-]+?)(?=\s*[-*]|\s*\d+\.|$)/);
  if (dashMatch?.[1]) return dashMatch[1].trim();
  return undefined;
}

function collectSimpleInlineBoldMatches(text: string): SuggestionHeaderMatch[] {
  const raw = [...text.matchAll(SIMPLE_INLINE_NUMBERED_BOLD)];
  return raw
    .map((match, index): SuggestionHeaderMatch | null => {
      const rank = Number(match[1]);
      const title = match[2]?.trim() ?? "";
      if (!Number.isFinite(rank) || rank <= 0 || !title) return null;
      const start = match.index ?? 0;
      const length = match[0].length;
      const nextStart = index + 1 < raw.length ? (raw[index + 1].index ?? text.length) : text.length;
      const subtitle = extractSubtitleAfterHeader(text, start + length, nextStart);
      return {
        rank,
        title,
        ...(subtitle !== undefined ? { subtitle } : {}),
        index: start,
        length,
      };
    })
    .filter((entry): entry is SuggestionHeaderMatch => entry !== null);
}

function collectBoldPrefixMatches(text: string): SuggestionHeaderMatch[] {
  const raw = [...text.matchAll(INLINE_BOLD_PREFIX)];
  return raw
    .map((match, index): SuggestionHeaderMatch | null => {
      const rank = Number(match[1]);
      const title = match[2]?.trim() ?? "";
      if (!Number.isFinite(rank) || rank <= 0 || !title) return null;
      const start = match.index ?? 0;
      const length = match[0].length;
      const nextStart = index + 1 < raw.length ? (raw[index + 1].index ?? text.length) : text.length;
      const subtitle = extractSubtitleAfterHeader(text, start + length, nextStart);
      return {
        rank,
        title,
        ...(subtitle !== undefined ? { subtitle } : {}),
        index: start,
        length,
      };
    })
    .filter((entry): entry is SuggestionHeaderMatch => entry !== null);
}

function toLineHeaderMatch(match: RegExpMatchArray): SuggestionHeaderMatch | null {
  const rank = Number(match[1]);
  const title = match[2]?.trim() ?? "";
  if (!Number.isFinite(rank) || rank <= 0 || !title) return null;
  const subtitle = (match[3] ?? match[4])?.trim() || undefined;
  return {
    rank,
    title,
    subtitle,
    index: match.index ?? 0,
    length: match[0].length,
  };
}

function collectLineHeaderMatches(text: string, pattern: RegExp): SuggestionHeaderMatch[] {
  return [...text.matchAll(pattern)]
    .map(toLineHeaderMatch)
    .filter((entry): entry is SuggestionHeaderMatch => entry !== null);
}

function buildSuggestionsFromHeaders(
  text: string,
  headers: readonly SuggestionHeaderMatch[],
): ParsedAutomationSuggestion[] {
  return headers.map((header, index) => {
    const start = header.index + header.length;
    const end = index + 1 < headers.length ? headers[index + 1].index : text.length;
    const details = normalizeSuggestionDetails(text.slice(start, end).trim(), header.subtitle);

    return {
      rank: header.rank,
      title: header.title,
      subtitle: header.subtitle,
      details,
      buildMessage: buildSuggestionPickMessage({
        rank: header.rank,
        title: header.title,
        subtitle: header.subtitle,
        details,
      }),
    };
  });
}

/** Drop subtitle prose duplicated as the first details line (common with em-dash inline titles). */
export function normalizeSuggestionDetails(details: string, subtitle?: string): string {
  const lines = details
    .split("\n")
    .map((line) => line.replace(/^\s*[-*—–]\s*/, "").trim())
    .filter(Boolean);

  if (!subtitle?.trim()) return lines.join("\n");

  const subtitleKey = subtitle.trim().toLowerCase().slice(0, 32);
  const filtered = lines.filter((line, index) => {
    if (index !== 0) return true;
    const lineKey = line.toLowerCase();
    return !lineKey.startsWith(subtitleKey) && !subtitleKey.startsWith(lineKey.slice(0, 32));
  });

  return filtered.join("\n");
}

/** True when a parsed item is a real automation recommendation, not a scan-failure unblock hint. */
export function looksLikeAutomationSuggestion(suggestion: ParsedAutomationSuggestion): boolean {
  const title = suggestion.title.trim();
  if (META_SUGGESTION_TITLE_PATTERN.test(title)) return false;

  if (/\*\*(?:Why|Trigger|Action|Impact):/i.test(suggestion.details)) return true;

  const blob = `${title} ${suggestion.subtitle ?? ""} ${suggestion.details}`.toLowerCase();
  return AUTOMATION_CONTENT_PATTERN.test(blob);
}

function filterBuildableSuggestions(suggestions: readonly ParsedAutomationSuggestion[]): ParsedAutomationSuggestion[] {
  return suggestions.filter(looksLikeAutomationSuggestion);
}

function parseBoldSectionSuggestions(text: string): ParsedAutomationSuggestion[] {
  const headers: SuggestionHeaderMatch[] = [];
  let rank = 1;

  for (const match of text.matchAll(BOLD_SECTION_HEADER)) {
    const title = match[1]?.trim() ?? "";
    if (!title) continue;
    headers.push({
      rank: rank++,
      title,
      subtitle: (match[2] ?? match[3])?.trim() || undefined,
      index: match.index ?? 0,
      length: match[0].length,
    });
  }

  return buildSuggestionsFromHeaders(text, headers);
}

function dedupeSuggestionsByRank(suggestions: readonly ParsedAutomationSuggestion[]): ParsedAutomationSuggestion[] {
  const byRank = new Map<number, ParsedAutomationSuggestion>();
  for (const suggestion of suggestions) {
    if (!byRank.has(suggestion.rank)) {
      byRank.set(suggestion.rank, suggestion);
    }
  }
  return [...byRank.values()].sort((a, b) => a.rank - b.rank);
}

/**
 * Extract numbered automation suggestions from an assistant markdown reply.
 * Uses inline patterns so suggestions still match when the model does not put
 * each item on its own line.
 */
export function parseRankedAutomationSuggestions(text: string): ParsedAutomationSuggestion[] {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }

  const inlineBold = collectSimpleInlineBoldMatches(trimmed);
  const boldPrefix = collectBoldPrefixMatches(trimmed);
  const headingNumbered = collectLineHeaderMatches(trimmed, HEADING_NUMBERED);
  const plainNumbered = collectLineHeaderMatches(trimmed, INLINE_PLAIN_NUMBERED);
  const boldSections = parseBoldSectionSuggestions(trimmed);

  const headerPool =
    inlineBold.length > 0
      ? inlineBold
      : boldPrefix.length > 0
        ? boldPrefix
        : headingNumbered.length > 0
          ? headingNumbered
          : plainNumbered.length > 0
            ? plainNumbered
            : [];

  let suggestions = headerPool.length > 0 ? buildSuggestionsFromHeaders(trimmed, headerPool) : boldSections;

  suggestions = dedupeSuggestionsByRank(filterBuildableSuggestions(suggestions));

  return suggestions;
}

/** Build actionable cards from scan_account_insights when the model text is not parseable. */
export function buildSuggestionsFromScanSummary(summary: AccountInsightsScanSummary): ParsedAutomationSuggestion[] {
  const suggestions: ParsedAutomationSuggestion[] = [];
  let rank = 1;

  for (const signal of summary.behaviorSignals) {
    const title = titleFromBehaviorSignal(signal.action);
    const subtitle = `You did this manually ${signal.count}× in the last ${summary.lookbackDays} days`;
    const details = `- **Why:** ${signal.suggestion}\n- **Trigger:** Performance threshold on qualifying ad sets\n- **Action:** ${signal.suggestion}`;
    suggestions.push({
      rank,
      title,
      subtitle,
      details,
      buildMessage: buildSuggestionPickMessage({ rank, title, subtitle, details }),
    });
    rank += 1;
  }

  // Data-grounded enriched signals rank above the generic guardrails below.
  const aggregatedEnriched = aggregateEnrichedSignalsByType(summary.enrichedSignals);
  for (const signal of aggregatedEnriched) {
    const title = titleFromEnrichedSignal(signal.type);
    const subtitle = buildAggregatedEnrichedSubtitle(signal);
    const details = buildAggregatedEnrichedDetails(signal);
    suggestions.push({
      rank,
      title,
      subtitle,
      details,
      buildMessage: buildSuggestionPickMessage({ rank, title, subtitle, details }),
      signalType: signal.type,
    });
    rank += 1;
  }

  if (summary.losersCount > 0 || summary.totals.spend > 0) {
    const title = "Auto-pause underperforming ads";
    const subtitle = "Guardrails for ads burning budget without conversions";
    const details =
      "- **Why:** Stop wasted spend on ads with no return\n- **Trigger:** Spend ≥ $50 and 0 conversions over 7 days\n- **Action:** Pause ad and notify your team";
    suggestions.push({
      rank,
      title,
      subtitle,
      details,
      buildMessage: buildSuggestionPickMessage({ rank, title, subtitle, details }),
    });
    rank += 1;
  }

  if (summary.scalingCandidatesCount > 0 || summary.winnersCount > 0) {
    const title = "Scale winners via budget bump";
    const subtitle = "Increase budget on proven performers";
    const details =
      "- **Why:** Winners with strong ROAS are ready to scale\n- **Trigger:** Ad set ROAS ≥ 3 and spend ≥ $100 over 7 days\n- **Action:** Increase daily budget by 20%";
    suggestions.push({
      rank,
      title,
      subtitle,
      details,
      buildMessage: buildSuggestionPickMessage({ rank, title, subtitle, details }),
    });
  }

  return suggestions;
}

function buildAggregatedEnrichedSubtitle(signal: AggregatedEnrichedSignal): string {
  if (signal.reasons.length === 1) return signal.reasons[0];
  return `${signal.reasons.length} ads flagged — ${labelFromEnrichedSignalType(signal.type)}`;
}

function buildAggregatedEnrichedDetails(signal: AggregatedEnrichedSignal): string {
  const whyBlock =
    signal.reasons.length === 1
      ? signal.reasons[0]
      : `${signal.reasons.length} ads matched:\n${signal.reasons.map((reason) => `  - ${reason}`).join("\n")}`;
  return `- **Why:** ${whyBlock}\n- **Action:** ${signal.suggestion}`;
}

/** Card title for each enriched-signal type. */
function titleFromEnrichedSignal(type: string): string {
  const titles: Record<string, string> = {
    trend_roas_decline: "Auto-pause ads on ROAS decline",
    trend_cpa_rise: "Auto-pause ads when CPA rises",
    trend_spend_creep: "Cap spend on non-scaling ads",
    creative_fatigue: "Refresh fatiguing creative",
    funnel_low_ctr: "Fix low-CTR ads before they bleed",
    funnel_checkout_dropoff: "Catch the landing/pixel drop-off",
    funnel_no_traffic: "Pause high-spend, no-traffic ads",
    placement_waste: "Cut wasteful placements",
    action_type_leak: "Plug the checkout leak",
  };
  return titles[type] ?? "Data-driven automation";
}

/** Short chip label for an enriched-signal type (e.g. "creative fatigue"). */
export function labelFromEnrichedSignalType(type: string): string {
  const labels: Record<string, string> = {
    trend_roas_decline: "ROAS decline",
    trend_cpa_rise: "CPA rising",
    trend_spend_creep: "spend creep",
    creative_fatigue: "creative fatigue",
    funnel_low_ctr: "funnel: low CTR",
    funnel_checkout_dropoff: "funnel: checkout drop-off",
    funnel_no_traffic: "funnel: no traffic",
    placement_waste: "placement waste",
    action_type_leak: "checkout leak",
  };
  return labels[type] ?? type.replace(/_/g, " ");
}

function titleFromBehaviorSignal(action: string): string {
  const titles: Record<string, string> = {
    duplicate_adset: "Auto-duplicate winning ad sets",
    duplicate_ad: "Auto-duplicate winning ads",
    import_meta_to_tiktok: "Scale Meta winners to TikTok",
    import_meta_to_snapchat: "Scale Meta winners to Snapchat",
    update_status: "Auto-pause underperforming ads",
  };
  return titles[action] ?? `Automate ${formatBehaviorActionLabel(action)}`;
}

/**
 * Prefer suggestions parsed from assistant text; fall back to scan_account_insights
 * behavior signals when the model reply is not parseable. Meta unblock hints
 * (retry scan, tell me a goal) are never shown as buildable cards.
 */
export function resolveAssistantSuggestions(
  text: string,
  scanSummary: AccountInsightsScanSummary | null,
  scanToolStatus?: string,
): ParsedAutomationSuggestion[] {
  const fromText = parseRankedAutomationSuggestions(text);
  if (fromText.length > 0) {
    return fromText;
  }

  if (scanToolStatus === "done" && scanSummary) {
    return buildSuggestionsFromScanSummary(scanSummary);
  }

  return [];
}

/** Remove GFM ranked-list tables from intro prose when cards show the same suggestions. */
export function stripRankedSuggestionMarkdownTables(text: string): string {
  const withoutTables = text.replace(
    /\n(?:\*\*[^*\n]{0,80}\*\*\s*)?\|[^\n]*\|\n\|[-\s|:]+\|\n(?:\|[^\n]*\|\n?)*/g,
    "\n",
  );
  return withoutTables.replace(/\n{3,}/g, "\n\n").trim();
}

/** Intro copy before the ranked list — shown above suggestion cards. */
export function extractSuggestionIntro(text: string, suggestions: readonly ParsedAutomationSuggestion[]): string {
  if (suggestions.length === 0) return text.trim();

  const first = suggestions[0];
  const anchors = [
    `${first.rank}. **${first.title}**`,
    `${first.rank}. ${first.title}`,
    `**${first.rank}. ${first.title}**`,
    `**${first.title}**`,
  ];
  const anchorIndex = anchors.map((anchor) => text.indexOf(anchor)).find((index) => index >= 0) ?? -1;
  const intro = anchorIndex < 0 ? text.trim() : text.slice(0, anchorIndex).trim();
  return stripRankedSuggestionMarkdownTables(intro);
}

/** Trailing ask (e.g. "Which one should I build?") after the ranked list. */
export function extractSuggestionOutro(text: string, suggestions: readonly ParsedAutomationSuggestion[]): string {
  if (suggestions.length === 0) return "";

  const last = suggestions[suggestions.length - 1];
  const anchors = [
    `${last.rank}. **${last.title}**`,
    `${last.rank}. ${last.title}`,
    `**${last.rank}. ${last.title}**`,
    `**${last.title}**`,
  ];
  const startIndex = anchors.map((anchor) => text.indexOf(anchor)).find((index) => index >= 0) ?? -1;
  if (startIndex < 0) return "";

  const afterList = text.slice(startIndex);
  const whichMatch = afterList.match(/\n\*\*(Which[^*]*\*\*[\s\S]*)$/i);
  const noteMatch = afterList.match(/\n\*\*(Note[^*]*\*\*[\s\S]*)$/i);
  return (whichMatch?.[1] ?? noteMatch?.[1] ?? "").trim();
}

function readNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** Parse the JSON payload returned by scan_account_insights (MCP tool result text). */
export function parseScanAccountInsightsResult(resultText: string | undefined): AccountInsightsScanSummary | null {
  if (!resultText?.trim()) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(resultText.trim());
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const record = parsed as Record<string, unknown>;
  const insights =
    record.insights && typeof record.insights === "object" && !Array.isArray(record.insights)
      ? (record.insights as Record<string, unknown>)
      : null;
  const totals =
    insights?.totals && typeof insights.totals === "object" && !Array.isArray(insights.totals)
      ? (insights.totals as Record<string, unknown>)
      : null;

  const behaviorSignals = Array.isArray(record.behaviorSignals)
    ? record.behaviorSignals
        .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
        .map((entry) => ({
          action: typeof entry.action === "string" ? entry.action : "unknown",
          count: readNumber(entry.count),
          suggestion: typeof entry.suggestion === "string" ? entry.suggestion : "",
        }))
        .filter((entry) => entry.suggestion.trim().length > 0)
    : [];

  return {
    lookbackDays: readNumber(record.lookbackDays) || 30,
    behaviorSignals,
    totals: {
      spend: readNumber(totals?.spend),
      adCount: readNumber(totals?.adCount),
      blendedRoas: readNumber(totals?.blendedRoas),
      conversions: readNumber(totals?.conversions),
    },
    winnersCount: Array.isArray(insights?.winners) ? insights.winners.length : 0,
    losersCount: Array.isArray(insights?.losers) ? insights.losers.length : 0,
    scalingCandidatesCount: Array.isArray(insights?.scalingCandidates) ? insights.scalingCandidates.length : 0,
    enrichedSignals: collectEnrichedSignals(insights),
  };
}

/** Signal groups on the insights object, in rank order (funnel diagnostics lead). */
const ENRICHED_SIGNAL_GROUPS = ["funnel", "trends", "creativeFatigue", "placement", "actionTypes"] as const;

/** Flatten the enriched-signal groups on the insights payload into one ranked list. */
function collectEnrichedSignals(insights: Record<string, unknown> | null): EnrichedScanSignal[] {
  if (!insights) return [];
  const collected: EnrichedScanSignal[] = [];
  for (const group of ENRICHED_SIGNAL_GROUPS) {
    const rows = insights[group];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const signal = row as Record<string, unknown>;
      const suggestion = typeof signal.suggestion === "string" ? signal.suggestion : "";
      const reason = typeof signal.reason === "string" ? signal.reason : "";
      if (!suggestion.trim() || !reason.trim()) continue;
      collected.push({
        type: typeof signal.type === "string" ? signal.type : group,
        reason,
        suggestion,
        ...(typeof signal.adName === "string" ? { adName: signal.adName } : {}),
      });
    }
  }
  return collected;
}

/** Read scan_account_insights result from assistant tool calls. */
export function findScanInsightsFromToolCalls(
  toolCalls: ReadonlyArray<{ readonly name: string; readonly status: string; readonly resultText?: string }>,
): AccountInsightsScanSummary | null {
  for (const call of [...toolCalls].reverse()) {
    if (call.name !== "scan_account_insights" || call.status !== "done") continue;
    const summary = parseScanAccountInsightsResult(call.resultText);
    if (summary) return summary;
  }
  return null;
}

/** Human label for a recorded AccountAction type. */
export function formatBehaviorActionLabel(action: string): string {
  const labels: Record<string, string> = {
    import_meta_to_tiktok: "Meta → TikTok cross-launch",
    import_meta_to_snapchat: "Meta → Snapchat cross-launch",
    duplicate_ad: "Duplicate ad",
    duplicate_adset: "Duplicate ad set",
    update_status: "Pause or activate ads",
  };
  return labels[action] ?? action.replace(/_/g, " ");
}
