import { normalizeSuggestionDetails } from "./parse-assistant-suggestions";

/** Split normalized suggestion details into display lines. */
export function formatSuggestionDetailLines(details: string, subtitle?: string): readonly string[] {
  const markdownCleaned = details
    .split("\n")
    .map((line) => formatSuggestionDetailLine(line.trim()))
    .filter(Boolean)
    .join("\n");

  return normalizeSuggestionDetails(markdownCleaned, subtitle)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Strip markdown emphasis so card/modal text reads cleanly (e.g. `*Trigger:*` → `Trigger:`). */
export function formatSuggestionDetailLine(line: string): string {
  return line
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^[-*—–]\s*/, "")
    .trim();
}
