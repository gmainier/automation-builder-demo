/**
 * Display helpers for the automation assistant transcript: short previews with
 * expandable detail, plus compact tool-error summaries for the MCP tool card.
 */

export const ASSISTANT_MESSAGE_COLLAPSE_CHARS = 280;

/** Returns whether the message should start collapsed behind "Show more". */
export function shouldCollapseAssistantMessage(text: string): boolean {
  return text.trim().length > ASSISTANT_MESSAGE_COLLAPSE_CHARS;
}

/** Short preview used when the assistant bubble is collapsed. */
export function collapseAssistantMessage(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= ASSISTANT_MESSAGE_COLLAPSE_CHARS) return trimmed;
  return `${trimmed.slice(0, ASSISTANT_MESSAGE_COLLAPSE_CHARS).trimEnd()}…`;
}

/**
 * Pull a short, human-readable line from a tool error/result payload.
 * Prefers MCP error envelopes (`message`) over raw JSON dumps.
 */
export function summarizeToolResultText(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  const trimmed = raw.trim();
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const record = parsed as Record<string, unknown>;
      if (typeof record.message === "string" && record.message.trim()) {
        return shortenOneLine(record.message, 120);
      }
      if (typeof record.error === "string" && record.error.trim()) {
        return shortenOneLine(record.error, 120);
      }
    }
  } catch {
    // Not JSON — fall through to plain text.
  }
  return shortenOneLine(trimmed, 120);
}

function shortenOneLine(value: string, maxChars: number): string {
  const oneLine = value.replace(/\s+/g, " ").trim();
  if (oneLine.length <= maxChars) return oneLine;
  return `${oneLine.slice(0, maxChars).trimEnd()}…`;
}
