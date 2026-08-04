const KEYWORD_DELIMITER_PATTERN = /[\n\r,;\t]+/;

function stripSurroundingQuotes(token: string): string {
  const trimmed = token.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

/**
 * Parses raw pasted text (CSV cell contents, comma/semicolon lists, or one
 * keyword per line) into individual keywords.
 *
 * Splits on newlines, commas, semicolons, and tabs; strips CSV-style
 * surrounding double quotes; drops empty entries; dedupes case-insensitively
 * keeping the first occurrence.
 */
export function parseKeywordList(raw: string): string[] {
  const keywords: string[] = [];
  const seen = new Set<string>();
  for (const token of raw.split(KEYWORD_DELIMITER_PATTERN)) {
    const keyword = stripSurroundingQuotes(token);
    if (!keyword) continue;
    const dedupeKey = keyword.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    keywords.push(keyword);
  }
  return keywords;
}

/**
 * Appends incoming keywords to an existing list, skipping any that are
 * already present (case-insensitive). Returns a new array; never mutates.
 */
export function mergeKeywordLists(existing: readonly string[], incoming: readonly string[]): string[] {
  const seen = new Set(existing.map((keyword) => keyword.toLowerCase()));
  const merged = [...existing];
  for (const keyword of incoming) {
    const dedupeKey = keyword.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    merged.push(keyword);
  }
  return merged;
}
