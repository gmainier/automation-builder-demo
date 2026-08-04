"use client";

/**
 * Stub for the ad-set picker.
 *
 * The real component (`components/automation-adset-selector.tsx`) lists an
 * account's ad sets from Meta, with a refresh that calls `api-app`. Neither
 * is reachable here, so this renders a disabled control that says so.
 *
 * The prop signature is copied exactly so `data-pill-selector.tsx` stays unedited.
 */

interface AutomationAdSetSelectorProps {
  value?: string;
  placeholder?: string;
  callbacks?: { onChange: (value: string, name?: string) => void };
  // Open beyond the fields above: the pill selector also passes accountId,
  // accountType and itemType, and the point of the stub is to leave that call
  // site unedited.
  [key: string]: unknown;
}

export function AutomationAdSetSelector({ value, placeholder }: AutomationAdSetSelectorProps) {
  return (
    <div className="rounded-md border border-dashed border-border bg-muted/40 px-3 py-2">
      <p className="text-xs text-muted-foreground">
        {value ? `Ad set ${value}` : (placeholder ?? "Ad set picker needs a connected Meta account")}
      </p>
    </div>
  );
}
