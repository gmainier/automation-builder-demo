import type { AssistantMessage } from "../hooks/use-automation-assistant";

/** Hide pickable cards once the user chose one — avoids duplicating the build-progress card. */
export function shouldSuppressSuggestionCards(messages: readonly AssistantMessage[], messageIndex: number): boolean {
  const message = messages[messageIndex];
  if (message?.role !== "assistant") return false;
  return messages.slice(messageIndex + 1).some((entry) => entry.role === "user" && Boolean(entry.suggestionBuild));
}

/** Rank badge: top pick is filled violet; others stay neutral until selected. */
export function suggestionRankBadgeClass(isPrimary: boolean): string {
  return isPrimary ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-700";
}
