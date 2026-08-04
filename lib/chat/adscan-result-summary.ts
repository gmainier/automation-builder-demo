import type { ToolCallRecord } from "./types";

const ADS_CONTAINER_KEYS = ["ads", "data", "items", "results"] as const;
const AD_ID_KEYS = ["hash", "id", "adId", "ad_id"] as const;
const TITLE_KEYS = ["title", "headline", "cardTitle", "name"] as const;
const BODY_KEYS = ["body", "text", "copy", "primaryText", "message", "description"] as const;
const CAPTION_KEYS = ["caption"] as const;
/** Best match first; `domain` trails because it is an identifier of last resort, not a brand name. */
const BRAND_KEYS = ["advertiserName", "companyName", "brandName", "pageName", "domain"] as const;
/** Inside an advertiser record a `domain` must never win over a real name on a sibling key. */
const NESTED_BRAND_KEYS = ["name", "advertiserName", "companyName", "brandName", "pageName"] as const;

/**
 * Metrics in the order the model should keep them when the budget forces a cut.
 * Each entry collapses its aliases so one metric never occupies two slots.
 */
const METRIC_FIELDS = [
  { key: "views", aliases: ["views"] },
  { key: "reach", aliases: ["reach"] },
  { key: "spend", aliases: ["spend", "spendUsd"] },
  { key: "bestUsRank", aliases: ["bestUsRank", "usRank"] },
  { key: "similarity", aliases: ["similarity"] },
  { key: "impressions", aliases: ["impressions"] },
] as const;

/** `ads.list` rows nest the creative under `cards[]` and the brand under `advertiser`. */
const CARD_CONTAINER_KEYS = ["cards", "creatives", "media"] as const;
const ADVERTISER_RECORD_KEYS = ["advertiser", "brand", "company"] as const;
const PARTNER_RECORD_KEYS = ["partner"] as const;
const METRIC_RECORD_KEYS = ["engagement", "metrics", "stats", "performance"] as const;

/** The brand name is the strongest topical signal, so it is never compressed. */
const ADVERTISER_TEXT_LIMIT = 100;
/** Bounded so an upstream hint can never eat the budget the ad copy needs. */
const SEARCH_HINT_LIMIT = 200;

/**
 * Per-ad text budgets, richest first. The wire cap is a hard ceiling, so the
 * encoder walks down this ladder until the payload fits.
 *
 * Metrics are shed BEFORE copy: the model needs advertiser + copy to judge
 * whether an ad is on-topic, and reach/rank numbers never answer that question.
 */
const TEXT_PROFILES = [
  { title: 100, body: 220, metrics: 3 },
  { title: 100, body: 140, metrics: 3 },
  { title: 80, body: 110, metrics: 2 },
  { title: 80, body: 90, metrics: 0 },
  { title: 70, body: 75, metrics: 0 },
  { title: 60, body: 60, metrics: 0 },
  { title: 50, body: 50, metrics: 0 },
  { title: 40, body: 40, metrics: 0 },
  { title: 30, body: 30, metrics: 0 },
] as const;

type TextProfile = (typeof TEXT_PROFILES)[number];

interface CompactAdScanAd {
  readonly index: number;
  readonly adId: string;
  readonly advertiser?: string;
  readonly title?: string;
  readonly body?: string;
  readonly metrics?: Record<string, number | string>;
}

interface CompactAdScanResult {
  readonly note: string;
  readonly adIds: readonly string[];
  readonly adCount: number;
  readonly hasMore?: boolean;
  readonly searchHint?: string;
  /** Set when the wire budget forced the id list to be cut short of `adCount`. */
  readonly adIdsTruncated?: boolean;
  /** Set when the wire budget forced per-ad detail to be cut short of `adCount`. */
  readonly detailShownFor?: number;
  readonly ads: readonly CompactAdScanAd[];
}

/** Result-level fields carried through from the raw tool payload. */
interface ResultEnvelope {
  readonly hasMore: boolean;
  readonly searchHint: string | null;
}

/** How much of the result survived the wire budget. */
interface ResultShape {
  readonly detailCount: number;
  readonly idCount: number;
}

interface CompactOptions {
  /** Hard ceiling for the encoded payload, mirroring the caller's wire cap. */
  readonly maxChars: number;
}

const NOTE =
  "Compact AdScan result — TEXT ONLY, no image or video is attached and you cannot see these creatives. " +
  "Judge topical fit from advertiser/title/body. When adding all/them to a board, pass every value in adIds; " +
  "when you were asked to check the ads, pass only the ids that passed your check. " +
  "If detailShownFor is present, only that many ads carry copy here — the rest are unchecked, not rejected. " +
  "If adIdsTruncated is true, adIds is a partial list: say the result was too large to board in full.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJsonRecord(value: unknown): Record<string, unknown> | null {
  if (isRecord(value)) return value;
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function resultData(result: Record<string, unknown>): Record<string, unknown> {
  const envelope = isRecord(result.result) ? result.result : result;
  return isRecord(envelope.data) ? envelope.data : envelope;
}

function adRowsFrom(result: Record<string, unknown>): Record<string, unknown>[] {
  const data = resultData(result);
  for (const key of ADS_CONTAINER_KEYS) {
    const value = data[key];
    if (Array.isArray(value)) return value.filter(isRecord);
  }
  return [];
}

function getString(row: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function getRecord(row: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> | null {
  for (const key of keys) {
    if (isRecord(row[key])) return row[key] as Record<string, unknown>;
  }
  return null;
}

/** First creative carrying copy; carousels often have an empty position-0 card. */
function firstTextCard(row: Record<string, unknown>): Record<string, unknown> | null {
  for (const key of CARD_CONTAINER_KEYS) {
    const cards = row[key];
    if (!Array.isArray(cards)) continue;
    const records = cards.filter(isRecord);
    if (records.length === 0) continue;
    const withCopy = records.find((card) => getString(card, [...TITLE_KEYS, ...BODY_KEYS, ...CAPTION_KEYS]));
    return withCopy ?? records[0];
  }
  return null;
}

/**
 * Nested `advertiser.name` first: the flat keys are a fallback for hand-built
 * envelopes, and one of them (`domain`) would otherwise shadow the real brand.
 */
function advertiserName(row: Record<string, unknown>): string | null {
  const advertiser = getRecord(row, ADVERTISER_RECORD_KEYS);
  const partner = getRecord(row, PARTNER_RECORD_KEYS);
  return (
    (advertiser ? getString(advertiser, NESTED_BRAND_KEYS) : null) ??
    (partner ? getString(partner, NESTED_BRAND_KEYS) : null) ??
    getString(row, BRAND_KEYS)
  );
}

function cleanText(value: string | null, limit: number): string | undefined {
  if (!value || limit <= 0) return undefined;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return undefined;
  return normalized.length > limit ? `${normalized.slice(0, limit).trimEnd()}...` : normalized;
}

function readMetric(sources: readonly Record<string, unknown>[], aliases: readonly string[]): number | string | null {
  for (const alias of aliases) {
    for (const source of sources) {
      const value = source[alias];
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  return null;
}

function metricValues(row: Record<string, unknown>, keep: number): Record<string, number | string> | undefined {
  if (keep <= 0) return undefined;
  const sources = [
    row,
    ...METRIC_RECORD_KEYS.flatMap((key) => (isRecord(row[key]) ? [row[key] as Record<string, unknown>] : [])),
  ];
  const entries = METRIC_FIELDS.flatMap((field) => {
    const value = readMetric(sources, field.aliases);
    return value === null ? [] : [[field.key, value] as const];
  }).slice(0, keep);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function compactAdScanAd(row: Record<string, unknown>, index: number, profile: TextProfile): CompactAdScanAd | null {
  const adId = getString(row, AD_ID_KEYS);
  if (!adId) return null;
  const card = firstTextCard(row);
  const advertiser = cleanText(advertiserName(row), ADVERTISER_TEXT_LIMIT);
  const title = cleanText(getString(row, TITLE_KEYS) ?? (card ? getString(card, TITLE_KEYS) : null), profile.title);
  const rawBody = getString(row, BODY_KEYS) ?? (card ? getString(card, [...BODY_KEYS, ...CAPTION_KEYS]) : null);
  const body = cleanText(rawBody, profile.body);
  const metrics = metricValues(row, profile.metrics);
  return {
    index: index + 1,
    adId,
    ...(advertiser ? { advertiser } : {}),
    ...(title ? { title } : {}),
    ...(body ? { body } : {}),
    ...(metrics ? { metrics } : {}),
  };
}

function compactAdScanAds(rows: readonly Record<string, unknown>[], profile: TextProfile): CompactAdScanAd[] {
  return rows
    .map((row, index) => compactAdScanAd(row, index, profile))
    .filter((ad): ad is CompactAdScanAd => ad !== null);
}

function buildResult(
  ads: readonly CompactAdScanAd[],
  envelope: ResultEnvelope,
  shape: ResultShape,
): CompactAdScanResult {
  return {
    note: NOTE,
    adIds: ads.slice(0, shape.idCount).map((ad) => ad.adId),
    adCount: ads.length,
    ...(envelope.hasMore ? { hasMore: true } : {}),
    ...(envelope.searchHint ? { searchHint: envelope.searchHint } : {}),
    ...(shape.idCount < ads.length ? { adIdsTruncated: true } : {}),
    ...(shape.detailCount < ads.length ? { detailShownFor: shape.detailCount } : {}),
    ads: ads.slice(0, shape.detailCount),
  };
}

/** Largest `count` in `0..total` whose encoding fits, or 0 when even that overflows. */
function largestFittingCount(encode: (count: number) => string, total: number, maxChars: number): number {
  let low = 0;
  let high = total;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (encode(mid).length <= maxChars) low = mid;
    else high = mid - 1;
  }
  return low;
}

/**
 * Encodes at the richest profile that fits `maxChars`, then sheds ad detail and,
 * only if that is still not enough, ad ids — each shortfall flagged in the
 * payload. The caller tail-truncates anything over its cap, which would hand the
 * model unparseable JSON, so overflowing is never an acceptable outcome here.
 *
 * Fits any `maxChars` above the fixed envelope (`NOTE` plus keys and markers,
 * ~600 chars); the caller's wire cap is an order of magnitude above that floor.
 */
function encodeWithinBudget(
  rows: readonly Record<string, unknown>[],
  envelope: ResultEnvelope,
  maxChars: number,
): string | null {
  let leanest: CompactAdScanAd[] | null = null;
  for (const profile of TEXT_PROFILES) {
    const ads = compactAdScanAds(rows, profile);
    if (ads.length === 0) return null;
    leanest = ads;
    const encoded = JSON.stringify(buildResult(ads, envelope, { detailCount: ads.length, idCount: ads.length }));
    if (encoded.length <= maxChars) return encoded;
  }
  if (!leanest) return null;
  const ads = leanest;

  const withDetail = (detailCount: number): string =>
    JSON.stringify(buildResult(ads, envelope, { detailCount, idCount: ads.length }));
  const detailCount = largestFittingCount(withDetail, ads.length, maxChars);
  if (withDetail(detailCount).length <= maxChars) return withDetail(detailCount);

  // Only reachable when the id list alone overflows. A declared-partial list beats
  // a payload the model cannot parse, so drop ids last and say so.
  const withIds = (idCount: number): string => JSON.stringify(buildResult(ads, envelope, { detailCount: 0, idCount }));
  return withIds(largestFittingCount(withIds, ads.length, maxChars));
}

/**
 * Builds a compact model-facing AdScan result that preserves every returned ad
 * id, plus the advertiser and copy the model needs to judge whether each ad
 * matches what the user asked for.
 */
export function compactAdScanToolResultForWire(call: ToolCallRecord, options: CompactOptions): string | null {
  if (call.card?.kind !== "adscan") return null;
  const result = parseJsonRecord(call.resultText);
  if (!result) return null;
  const rows = adRowsFrom(result);
  if (rows.length === 0) return null;
  const envelope: ResultEnvelope = {
    hasMore: resultData(result).hasMore === true,
    searchHint: cleanText(getString(result, ["searchHint"]), SEARCH_HINT_LIMIT) ?? null,
  };
  return encodeWithinBudget(rows, envelope, options.maxChars);
}
