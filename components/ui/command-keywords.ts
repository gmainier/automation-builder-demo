/**
 * cmdk's internal `useValue` runs `keywords.map((keyword) => keyword.trim())`
 * with no guard, inside a layout effect. A single null/undefined keyword
 * therefore throws `Cannot read properties of null (reading 'trim')` where an
 * error boundary sees it, which takes the whole page down instead of degrading
 * one dropdown row.
 *
 * Combobox options are routinely derived from untyped third-party API payloads
 * (TikTok's `/identity/get/` returns `display_name: null` for some linked
 * accounts), so the `label: string` prop contract cannot be relied on at
 * runtime. Drop non-strings here rather than trusting every call site.
 *
 * @param keywords - Raw keyword list from a caller, possibly holding nullish entries.
 * @returns The string-only keywords, or `undefined` when no list was supplied.
 */
export function toCommandKeywords(keywords: readonly unknown[] | undefined): string[] | undefined {
  if (!keywords) return undefined;
  return keywords.filter((keyword): keyword is string => typeof keyword === "string");
}
