// Pure encode/decode for the chat SSE protocol. Each event is a single
// `data: <json>\n\n` frame; the terminal frame is `data: [DONE]\n\n`.

import type { ChatStreamEvent } from "./types";

export const SSE_DONE = "[DONE]";

export function encodeEvent(event: ChatStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export function encodeDone(): string {
  return `data: ${SSE_DONE}\n\n`;
}

/**
 * Encode an SSE comment frame (a line starting with `:`). Proxies keep the
 * connection warm on these, but `parseEvents` ignores any part that does not
 * start with `data:`, so a heartbeat produces no client event.
 */
export function encodeComment(text = "heartbeat"): string {
  return `: ${text}\n\n`;
}

/**
 * Parse the complete `data:` payloads out of an SSE text buffer. Returns the
 * decoded events and the unconsumed trailing remainder (an incomplete frame).
 */
export function parseEvents(buffer: string): { events: ChatStreamEvent[]; rest: string } {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  const events: ChatStreamEvent[] = [];
  for (const part of parts) {
    const line = part.trim();
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (payload === SSE_DONE || payload.length === 0) continue;
    try {
      events.push(JSON.parse(payload) as ChatStreamEvent);
    } catch {
      // Skip malformed frames rather than aborting the whole stream.
    }
  }
  return { events, rest };
}
