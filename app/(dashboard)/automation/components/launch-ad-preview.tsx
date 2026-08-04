"use client";

/**
 * Stub for the launched-ad preview.
 *
 * The real component (`components/launch-ad-preview.tsx`) renders Meta's own ad
 * preview iframe for each ad an execution created. That needs a live ad id and a
 * Meta token, so here it lists the ids instead.
 */

interface LaunchAdPreviewProps {
  adIds: string[];
  adName?: string;
}

export function LaunchAdPreview({ adIds, adName }: LaunchAdPreviewProps) {
  return (
    <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
      <p className="text-xs font-medium text-foreground">{adName ?? "Launched ads"}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {adIds.length} ad{adIds.length === 1 ? "" : "s"}: {adIds.join(", ")}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">Creative previews need a connected Meta account.</p>
    </div>
  );
}
