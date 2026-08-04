"use client";

/**
 * Stub for the cross-channel launch preview.
 *
 * The real component (`components/cross-channel-launch-preview.tsx`) resolves the
 * source ads from Meta and renders what would be created on the destination
 * channel, including placement previews. That is several live API calls deep, so
 * it is stubbed here.
 *
 * Props are accepted openly because the panel passes a wide, partly-derived object
 * at the call site, and the point is to leave `config-panel.tsx` unedited.
 */
export function CrossChannelLaunchPreview(_props: Record<string, unknown>) {
  return (
    <div className="rounded-md border border-dashed border-border bg-muted/40 px-3 py-2">
      <p className="text-[11px] text-muted-foreground">
        The launch preview needs connected Meta and destination-channel accounts, so it is not available in this demo.
      </p>
    </div>
  );
}
