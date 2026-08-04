"use client";

import type { AutomationNode } from "../contexts/automation-context";
import { TriggerOutputSummary } from "./trigger-output-summary";

/** The entity level a duplicate action operates on. "adset" also covers TikTok ad groups. */
export type DuplicateLevel = "campaign" | "adset";
export type DuplicatePlatform = "meta" | "tiktok";

/**
 * How a Duplicate Campaign / Duplicate Ad Set action sources what it duplicates:
 * - "trigger": from the first trigger's qualifying entities (scale mode, "use from
 *   trigger" data pill, or — on TikTok — an empty source that falls back to the
 *   trigger's qualifying IDs).
 * - "explicit": a specific campaign/ad set the user picked or typed.
 */
export type DuplicateSourceResolution = { mode: "trigger" } | { mode: "explicit"; id: string; name: string };

function getTrimmed(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

/**
 * Resolves whether a duplicate action's source comes from the trigger or an
 * explicit pick, mirroring the executor's own source-resolution precedence.
 *
 * Meta: `scaleQualifyingStructure` or `sourceCampaignMode`/`sourceAdSetMode` ===
 * "dataPill" → trigger; "specific"/"manual" → explicit (`targetId`/`targetName`).
 * TikTok: `scaleQualifyingStructure` or an empty `targetId` (executor falls back to
 * `qualifyingCampaignIds`/qualifying ad-group IDs) → trigger; otherwise explicit.
 */
export function resolveDuplicateSource(
  config: Record<string, unknown>,
  level: DuplicateLevel,
  platform: DuplicatePlatform,
): DuplicateSourceResolution {
  if (config.scaleQualifyingStructure === true) return { mode: "trigger" };

  const id = getTrimmed(config.targetId);
  const name = getTrimmed(config.targetName);

  if (platform === "meta") {
    const sourceMode = level === "campaign" ? config.sourceCampaignMode : config.sourceAdSetMode;
    if (sourceMode === "dataPill") return { mode: "trigger" };
    return { mode: "explicit", id, name };
  }

  // TikTok has no explicit "from trigger" mode: an empty source means the executor
  // falls back to the trigger's qualifying IDs.
  if (!id) return { mode: "trigger" };
  return { mode: "explicit", id, name };
}

function getSourceLabel(level: DuplicateLevel, platform: DuplicatePlatform): string {
  if (level === "campaign") return "Source campaign";
  return platform === "tiktok" ? "Source ad group" : "Source ad set";
}

/** Plural/singular noun for the grouped trigger count, so TikTok reads "ad group". */
function getDedupeNoun(level: DuplicateLevel, platform: DuplicatePlatform): { singular: string; plural: string } {
  if (level === "campaign") return { singular: "campaign", plural: "campaigns" };
  return platform === "tiktok"
    ? { singular: "ad group", plural: "ad groups" }
    : { singular: "ad set", plural: "ad sets" };
}

interface SelectedSourceCardProps {
  config: Record<string, unknown>;
  level: DuplicateLevel;
  platform: DuplicatePlatform;
}

/** Static card for the explicit-pick case: shows the chosen entity, account, and new name. */
function SelectedSourceCard({ config, level, platform }: SelectedSourceCardProps) {
  const sourceName = getTrimmed(config.targetName);
  const sourceId = getTrimmed(config.targetId);
  const accountName = getTrimmed(config.accountName);
  const newName = getTrimmed(config.newName);

  return (
    <div className="rounded-md border bg-card p-3">
      <dl className="space-y-2 text-xs">
        <div className="flex items-start justify-between gap-3">
          <dt className="text-muted-foreground">{getSourceLabel(level, platform)}</dt>
          <dd className="min-w-0 text-right font-medium">
            <span className="block truncate">{sourceName || sourceId || "Not selected"}</span>
            {sourceName && sourceId && (
              <span className="block truncate text-[10.5px] text-muted-foreground">{sourceId}</span>
            )}
          </dd>
        </div>
        {accountName && (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Account</dt>
            <dd className="truncate text-right font-medium">{accountName}</dd>
          </div>
        )}
        <div className="flex items-start justify-between gap-3">
          <dt className="text-muted-foreground">New name</dt>
          <dd className="min-w-0 truncate text-right font-mono text-[10.5px] text-muted-foreground">
            {newName || "Original name"}
          </dd>
        </div>
      </dl>
    </div>
  );
}

interface DuplicateSourcePreviewProps {
  node: AutomationNode;
  level: DuplicateLevel;
  platform: DuplicatePlatform;
  /** The flow's trigger so trigger-mode can dry-run it and list qualifying entities. */
  triggerNode?: AutomationNode;
  selectedAccountId?: string;
  selectedAccountName?: string;
  flowName?: string;
}

/**
 * Preview for "what would be duplicated" on Duplicate Campaign / Duplicate Ad Set
 * (Meta) and Duplicate Campaign / Duplicate Ad Group (TikTok).
 *
 * - Trigger-driven sources (scale / from-trigger / TikTok empty fallback) render the
 *   first trigger's qualifying entities, grouped to the level the action duplicates.
 * - Explicit picks render the chosen campaign/ad set directly.
 */
export function DuplicateSourcePreview({
  node,
  level,
  platform,
  triggerNode,
  selectedAccountId,
  selectedAccountName,
  flowName,
}: DuplicateSourcePreviewProps) {
  const source = resolveDuplicateSource(node.config || {}, level, platform);

  if (source.mode === "explicit") {
    return <SelectedSourceCard config={node.config || {}} level={level} platform={platform} />;
  }

  return (
    <TriggerOutputSummary
      triggerNode={triggerNode}
      selectedAccountId={selectedAccountId}
      selectedAccountName={selectedAccountName}
      flowName={flowName}
      dedupeBy={level}
      dedupeNoun={getDedupeNoun(level, platform)}
    />
  );
}
