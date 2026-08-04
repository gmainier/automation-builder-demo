/**
 * Default client-side filter for {@link ComboboxMultiple}'s underlying cmdk
 * `<Command>`.
 *
 * cmdk's built-in filter scores options with fuzzy *subsequence* matching, so a
 * query like `"top"` still matches `"ABO - PRATH testing - c(o)(p)y"` (t→o→p as
 * a subsequence) and the list looks unfiltered. This matcher instead requires
 * every whitespace-separated search term to appear as a *substring* of the
 * option's value or keywords — the same predictable behaviour the sibling
 * `AdsetSelectorFilter` already uses for the destination-campaign picker.
 *
 * Matching options all score `1` so cmdk preserves the incoming option order
 * (e.g. `sortSelectedFirst`) rather than re-ranking by fuzzy score.
 *
 * @param value - The cmdk item value (typically an id).
 * @param search - The raw search query typed by the user.
 * @param keywords - Extra searchable strings for the item (usually the label).
 * @returns `1` when the option matches (cmdk shows it), `0` to hide it.
 */
export function substringCommandFilter(value: string, search: string, keywords?: string[]): number {
  const terms = search.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return 1;

  const haystack = [value, ...(keywords ?? [])].join(" ").toLowerCase();
  return terms.every((term) => haystack.includes(term)) ? 1 : 0;
}
