"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Flame,
  Loader2,
  RefreshCw,
  ThumbsUp,
  MessageCircle,
  Share2,
  Globe,
} from "lucide-react";
import { cn, kFormatter } from "@/lib/utils";
import { formatCurrencyCompact } from "@/lib/utils/currency";
import { calculateSpendFromViews, pickAdscanViewsMetric } from "@/lib/adscan/spend-formula";
import Meta from "@/components/ui/icons/meta";
import { useUser } from "@/lib/providers/user-provider";
import type { AutomationNode } from "../contexts/automation-context";

/** Launch-Ad copy context so the mockup reflects what will actually be launched. */
interface AdMockupContext {
  /** "post_id" | "creative_id" | "new_ad" — drives whether the post or the new-ad copy is shown. */
  adSource?: string;
  headline?: string;
  primaryText?: string;
  linkUrl?: string;
  callToAction?: string;
}

interface TriggerOutputSummaryProps {
  /** The flow's trigger. Nothing renders if this is missing. */
  triggerNode?: AutomationNode;
  selectedAccountId?: string;
  selectedAccountName?: string;
  flowName?: string;
  /** When the downstream action is a Meta Launch Ad, drives the mockup's copy. */
  adContext?: AdMockupContext;
  /**
   * When the downstream action operates per ad set or per campaign (e.g. Change
   * Budget), collapse the matched ads to unique ad sets/campaigns so the count and
   * list reflect what the action will actually touch — not the raw ad count.
   * Deduped by ID (ad set / campaign names are not unique).
   */
  dedupeBy?: "adset" | "campaign";
  /**
   * Overrides the noun used for the deduped count/list (defaults to "campaign" /
   * "ad set"). Lets callers say "ad group" for TikTok without changing `dedupeBy`.
   */
  dedupeNoun?: { singular: string; plural: string };
}

interface DryRunResponse {
  matchedCount: number;
  triggerSource?: "bigquery" | "meta";
  triggerError?: string | null;
  triggerData?: {
    qualifyingAds?: Array<{
      adId?: string;
      adName?: string;
      adsetId?: string;
      adsetName?: string;
      campaignId?: string;
      campaignName?: string;
      spend?: number;
      // Adscan ad rows expose these instead of adName/campaignName.
      id?: string;
      headline?: string;
      company?: string;
      // Ad's own creative thumbnail — rendered next to the row instead of the
      // generic Meta icon when present. `previewUrl` is the larger
      // preview image; `thumbnailUrl` is preferred since it's already sized
      // for inline display.
      thumbnailUrl?: string | null;
      previewUrl?: string | null;
      // Adscan engagement columns — surfaced so the preview can show
      // views/spend per row when available. Spend is derived
      // client-side via `calculateSpendFromViews` since upstream Adscan
      // doesn't track real spend yet (see `lib/adscan/spend-formula.ts`).
      // For US Ad Library rows these are typically null (Meta doesn't expose
      // engagement) — `usRank` below carries the qualifying signal instead.
      views?: number | null;
      reach?: number | null;
      impressions?: number | null;
      // Latest US `impression_rank` snapshot, an earlier fix. Hydrated on Adscan
      // rows when the upstream `ads.listForAutomation` returns it. Rendered
      // as `US #${rank}` in the row's metadata line so the user can
      // see *why* a us_ranking-criterion rule fired.
      usRank?: { rank: number; total: number } | null;
    }>;
    winners?: OrganicPreviewPost[];
    qualifyingPosts?: OrganicPreviewPost[];
    qualifyingPostsCount?: number;
    qualifyingEntities?: Array<{
      entityId?: string;
      entityName?: string;
      currentValue?: number;
      previousValue?: number;
      percentageChange?: number;
      status?: string;
    }>;
    accountCurrency?: string;
    monitoringLevel?: string;
    monitoringMetric?: string;
  };
}

interface OrganicPreviewPost {
  postId?: string;
  message?: string | null;
  permalinkUrl?: string | null;
  mediaUrl?: string | null;
  mediaType?: string | null;
  metric?: string;
  metricValue?: number;
  createdTime?: string;
}

function buildTriggerPreviewKey(triggerNode: AutomationNode): string {
  return JSON.stringify({
    id: triggerNode.id,
    service: triggerNode.service,
    event: triggerNode.event,
    config: triggerNode.config || {},
  });
}

function getOrganicScanTarget(triggerNode: AutomationNode): { label: string; href: string | null; detail: string } {
  const config = triggerNode.config || {};
  const pageId = typeof config.pageId === "string" ? config.pageId.trim() : "";
  const instaId = typeof config.instaId === "string" ? config.instaId.trim() : "";
  const lookbackDays = typeof config.lookbackDays === "number" ? config.lookbackDays : 7;
  const detail = [
    `${lookbackDays} day${lookbackDays === 1 ? "" : "s"}`,
    instaId ? `includes Instagram ${instaId}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  if (!pageId) {
    return { label: "No Facebook Page selected", href: null, detail };
  }

  return {
    label: `Facebook Page ${pageId}`,
    href: `https://www.facebook.com/${pageId}`,
    detail,
  };
}

/**
 * Renders a compact "what the trigger produces" card above an action step's preview.
 * Auto-runs the dry-run once on mount so every downstream action step can show
 * the upstream records without the user having to click through.
 */
export function TriggerOutputSummary({
  triggerNode,
  selectedAccountId,
  selectedAccountName,
  flowName,
  adContext,
  dedupeBy,
  dedupeNoun,
}: TriggerOutputSummaryProps) {
  const [state, setState] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "ready"; data: DryRunResponse }
    | { status: "error"; message: string }
  >({ status: "idle" });
  const [elapsed, setElapsed] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);
  const startedKeyRef = useRef<string | null>(null);
  const triggerPreviewKey = triggerNode ? `${buildTriggerPreviewKey(triggerNode)}:${refreshCount}` : "";

  // Auto-run once per trigger-node config, and again whenever the preview is refreshed.
  useEffect(() => {
    if (!triggerNode) return;
    if (startedKeyRef.current === triggerPreviewKey) return;
    startedKeyRef.current = triggerPreviewKey;

    setState({ status: "loading" });
    setElapsed(0);
    const t0 = Date.now();
    const interval = setInterval(() => setElapsed(Math.round((Date.now() - t0) / 100) / 10), 100);

    (async () => {
      try {
        const res = await fetch("/api/automation-rules/dry-run-notification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            triggerNode,
            notificationNode: { config: { notificationMethod: "email", emailRecipients: [], customMessage: "" } },
            automationName: flowName || "Preview",
            selectedAccountId,
            selectedAccountName,
          }),
        });
        const raw = await res.text();
        let data: any = null;
        try {
          data = JSON.parse(raw);
        } catch {
          setState({ status: "error", message: `Bad response (HTTP ${res.status}): ${raw.slice(0, 160)}` });
          return;
        }
        if (!res.ok) {
          setState({
            status: "error",
            message: data?.error || `HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ""}`,
          });
          return;
        }
        setState({ status: "ready", data });
      } catch (err) {
        setState({ status: "error", message: err instanceof Error ? err.message : "Failed" });
      } finally {
        clearInterval(interval);
      }
    })();

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerPreviewKey]);

  const data = state.status === "ready" ? state.data : null;
  const ads = data?.triggerData?.qualifyingAds || [];
  const posts = data?.triggerData?.winners || data?.triggerData?.qualifyingPosts || [];
  const entities = data?.triggerData?.qualifyingEntities || [];
  const items = ads.length > 0 ? ads : posts.length > 0 ? posts : entities;

  // When the downstream action works per ad set/campaign, collapse the matched ads
  // to unique entities by ID (names collide — e.g. several distinct campaigns all
  // named "New Sales campaign"). Mirrors the trigger's own `[...new Set(adsetId)]`
  // dedup and the handler's per-campaign dedup, so the preview count matches the
  // number of budget writes the action will actually perform.
  const dedupedGroups = (() => {
    if (!dedupeBy || ads.length === 0) return null;
    const groups = new Map<
      string,
      { id: string; name: string; adCount: number; spend: number; thumb: string | null }
    >();
    for (const ad of ads) {
      const id = (dedupeBy === "campaign" ? ad.campaignId : ad.adsetId) || "";
      if (!id) continue;
      const name = (dedupeBy === "campaign" ? ad.campaignName : ad.adsetName) || id;
      const existing = groups.get(id);
      if (existing) {
        existing.adCount += 1;
        existing.spend += Number(ad.spend) || 0;
      } else {
        groups.set(id, {
          id,
          name,
          adCount: 1,
          spend: Number(ad.spend) || 0,
          thumb: ad.thumbnailUrl ?? ad.previewUrl ?? null,
        });
      }
    }
    return [...groups.values()];
  })();
  const dedupedNounSingular = dedupeNoun?.singular ?? (dedupeBy === "campaign" ? "campaign" : "ad set");
  const dedupedNounPlural = dedupeNoun?.plural ?? `${dedupedNounSingular}s`;
  const isOrganicPostTrigger =
    triggerNode?.service === "meta-ads" && triggerNode.event === "Best Performing Organic Post";
  const shouldShowItems = expanded || (isOrganicPostTrigger && posts.length > 0);

  // FB page profile image for the ad mockup avatar (same CDN the launcher uses).
  const { extendedUser } = useUser();
  const company = extendedUser?.company ?? null;
  const mockupPageId = typeof triggerNode?.config?.pageId === "string" ? triggerNode.config.pageId.trim() : "";
  const mockupPageImageUrl =
    company && mockupPageId && /^\d/.test(mockupPageId)
      ? `https://media.example.com/${company}/profile/fb_${mockupPageId}.jpg`
      : null;

  useEffect(() => {
    if (!isOrganicPostTrigger) return;
    if (posts.length === 0) return;
    setExpanded(true);
  }, [isOrganicPostTrigger, posts.length]);

  if (!triggerNode) return null;

  const scanTarget = isOrganicPostTrigger ? getOrganicScanTarget(triggerNode) : null;
  const isRefreshDisabled = state.status === "loading";
  // Singular noun — pluralization is applied at render based on matchedCount.
  // Previously this branched on ads.length (e.g. "ads") and the renderer added
  // another "s" when matchedCount > 1, producing "adss".
  const itemNoun =
    ads.length > 0
      ? "ad"
      : posts.length > 0
        ? "post"
        : data?.triggerData?.monitoringLevel === "account"
          ? "account"
          : data?.triggerData?.monitoringLevel === "adset"
            ? "ad set"
            : data?.triggerData?.monitoringLevel === "ad"
              ? "ad"
              : "item";

  const sym = (() => {
    const c = data?.triggerData?.accountCurrency;
    return c === "GBP" ? "£" : c === "EUR" ? "€" : "$";
  })();

  return (
    <div className="overflow-hidden rounded-md border bg-muted/30">
      <div className="flex items-center gap-1 px-2.5 py-2 transition-colors hover:bg-muted/50">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
        >
          <div className="flex min-w-0 items-center gap-1.5">
            <Flame className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              From the trigger
            </span>
            {state.status === "loading" && (
              <span className="flex items-center gap-1 text-[10.5px] text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="tabular-nums">Scanning posts... {elapsed.toFixed(1)}s</span>
              </span>
            )}
            {data && !data.triggerError && (
              <span className="truncate text-[11px] font-medium text-foreground">
                {dedupedGroups
                  ? `${dedupedGroups.length} ${dedupedGroups.length === 1 ? dedupedNounSingular : dedupedNounPlural} matched`
                  : `${data.matchedCount} ${data.matchedCount === 1 ? itemNoun : itemNoun + "s"} matched`}
                {data.triggerSource && (
                  <span
                    className={cn(
                      "ml-1.5 rounded px-1 py-px text-[9px] font-semibold uppercase tracking-wide",
                      data.triggerSource === "bigquery"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {data.triggerSource === "bigquery" ? "BQ" : "Meta"}
                  </span>
                )}
              </span>
            )}
            {state.status === "error" && <span className="truncate text-[11px] text-red-600">{state.message}</span>}
          </div>
          {items.length > 0 &&
            (shouldShowItems ? (
              <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
            ))}
        </button>
        {isOrganicPostTrigger && (
          <button
            type="button"
            aria-label="Refresh trigger preview"
            title="Refresh trigger preview"
            disabled={isRefreshDisabled}
            onClick={() => setRefreshCount((count) => count + 1)}
            className={cn(
              "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded border bg-background text-muted-foreground transition-colors hover:text-foreground",
              isRefreshDisabled && "cursor-not-allowed opacity-50",
            )}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isRefreshDisabled && "animate-spin")} />
          </button>
        )}
      </div>

      {scanTarget && (
        <div className="border-t bg-card px-2.5 py-2 text-[11px] text-muted-foreground">
          <span>Checking </span>
          {scanTarget.href ? (
            <a
              href={scanTarget.href}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              {scanTarget.label}
            </a>
          ) : (
            <span className="font-medium text-foreground">{scanTarget.label}</span>
          )}
          {scanTarget.detail && <span> · {scanTarget.detail}</span>}
        </div>
      )}

      {/* Ad preview — render the top winning organic post as it'll look as an ad. */}
      {isOrganicPostTrigger && posts.length > 0 && (
        <div className="border-t bg-muted/20 px-2.5 py-2.5">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Ad preview</p>
          <div className="mx-auto max-w-[300px]">
            <OrganicPostAdMockup
              post={posts[0]}
              pageImageUrl={mockupPageImageUrl}
              adContext={adContext}
              pageName={
                (typeof (data?.triggerData as { pageName?: unknown } | undefined)?.pageName === "string" &&
                  (data?.triggerData as { pageName?: string }).pageName) ||
                (typeof triggerNode.config?.accountName === "string" && triggerNode.config.accountName) ||
                "Sponsored Page"
              }
            />
          </div>
        </div>
      )}

      {/* Note: ItemThumbnail (defined below) renders the ad's own creative
          thumbnail when available, falling back to the Meta brand icon for
          rows that have no thumbnail or whose image fails to load. */}
      {/* Deduped-by-entity list (Change Budget etc.): one row per ad set/campaign. */}
      {shouldShowItems && dedupedGroups && dedupedGroups.length > 0 && (
        <ul className="divide-y border-t bg-card">
          {dedupedGroups.slice(0, 5).map((g) => (
            <li key={g.id} className="flex items-center gap-2 px-2.5 py-1.5">
              <ItemThumbnail src={g.thumb} alt={g.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-medium text-foreground">{g.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {[
                    `${g.adCount} ad${g.adCount === 1 ? "" : "s"}`,
                    g.spend > 0 ? `${sym}${g.spend.toFixed(2)} spend` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </li>
          ))}
          {dedupedGroups.length > 5 && (
            <li className="px-2.5 py-1 text-center text-[10.5px] text-muted-foreground">
              + {dedupedGroups.length - 5} more
            </li>
          )}
        </ul>
      )}

      {shouldShowItems && !dedupedGroups && items.length > 0 && (
        <ul className="divide-y border-t bg-card">
          {items.slice(0, 5).map((it: any, i: number) => {
            if (posts.length > 0) {
              return <OrganicPostRow key={it.postId || i} post={it} />;
            }

            // Adscan rows have no adName/entityName — fall back to headline → company → id.
            const name = it.adName || it.entityName || it.headline || it.company || it.id || "—";
            const ctx = it.campaignName || it.adsetName || it.company || null;
            const value = it.spend != null ? `${sym}${Number(it.spend).toFixed(2)}` : null;
            const pct =
              it.percentageChange != null
                ? `${it.percentageChange > 0 ? "+" : ""}${Number(it.percentageChange).toFixed(1)}%`
                : null;
            // Adscan engagement metrics. `pickAdscanViewsMetric`
            // mirrors the server-side picker used by the trigger evaluator
            // and notification body so the preview shows the same views/spend
            // numbers users see in /adscan and in the notification email.
            // Skipped when the metric is null/0 to avoid rendering
            // "0 views · $0.00 spend" for US Ad Library rows that null-fill
            // engagement columns.
            const viewsMetric = pickAdscanViewsMetric(it);
            const hasViewsMetric = viewsMetric !== null && viewsMetric > 0;
            const adscanViewsLabel = hasViewsMetric ? `${kFormatter(viewsMetric)} views` : null;
            const adscanSpendLabel = hasViewsMetric
              ? `${formatCurrencyCompact(calculateSpendFromViews(viewsMetric))} spend`
              : null;
            // an earlier fix: surface the US rank snapshot as a metadata fragment
            // so us_ranking-criterion rules show *why* each row qualified.
            // Renders as "US #3" — appended after the views/spend pair
            // so non-US rows keep the engagement columns leftmost. US rows
            // typically have null views/spend, so this becomes the primary
            // signal for them.
            const usRank = it.usRank && typeof it.usRank.rank === "number" ? `US #${it.usRank.rank}` : null;
            return (
              <li key={it.adId || it.entityId || i} className="flex items-center gap-2 px-2.5 py-1.5">
                <ItemThumbnail src={it.thumbnailUrl ?? it.previewUrl ?? null} alt={name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-medium text-foreground">{name}</p>
                  {(ctx || value || pct || adscanViewsLabel || adscanSpendLabel || usRank) && (
                    <p className="text-[10px] text-muted-foreground">
                      {[ctx, value, adscanViewsLabel, adscanSpendLabel, pct, usRank].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
          {items.length > 5 && (
            <li className="px-2.5 py-1 text-center text-[10.5px] text-muted-foreground">+ {items.length - 5} more</li>
          )}
        </ul>
      )}
    </div>
  );
}

/** "LEARN_MORE" → "Learn More". Falls back to empty for unset/unknown CTAs. */
function formatCtaLabel(cta?: string): string {
  if (!cta) return "";
  return cta
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getLinkDomain(url?: string): string {
  const trimmed = url?.trim();
  if (!trimmed) return "";
  try {
    return new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`).hostname.replace(/^www\./, "");
  } catch {
    return trimmed.replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
  }
}

/** Facebook-feed-style mockup of an organic post as it will appear when promoted as an ad. */
function OrganicPostAdMockup({
  post,
  pageName,
  pageImageUrl,
  adContext,
}: {
  post: OrganicPreviewPost;
  pageName: string;
  pageImageUrl?: string | null;
  adContext?: AdMockupContext;
}) {
  const [imgError, setImgError] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const media = post.mediaUrl || null;
  const isVideo = post.mediaType === "video" || (!!media && /\.(mp4|mov|webm)(\?|$)/i.test(media));
  const showPageImage = !!pageImageUrl && !avatarError;

  // New ad → show the configured ad copy; post/creative promotion → show the post as-is.
  const isNewAd = adContext?.adSource === "new_ad";
  const bodyText = (isNewAd ? adContext?.primaryText?.trim() || post.message : post.message) || "";
  const headline = adContext?.headline?.trim() || "";
  const linkDomain = getLinkDomain(adContext?.linkUrl);
  const ctaLabel = formatCtaLabel(adContext?.callToAction) || "Learn More";
  const showLinkCard = isNewAd && (!!headline || !!linkDomain);

  return (
    <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 pb-2 pt-3">
        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-blue-50 ring-1 ring-blue-100">
          {showPageImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={pageImageUrl as string}
              alt={pageName}
              className="h-full w-full object-cover"
              onError={() => setAvatarError(true)}
            />
          ) : (
            <Meta className="h-5 w-5" grayscale={false} />
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[12px] font-semibold leading-tight text-gray-900">{pageName}</p>
          <p className="flex items-center gap-1 text-[10px] text-gray-500">
            Sponsored · <Globe className="h-2.5 w-2.5" />
          </p>
        </div>
      </div>

      {/* Primary text / caption */}
      {bodyText && <p className="line-clamp-4 px-3 pb-2.5 text-[12.5px] leading-snug text-gray-800">{bodyText}</p>}

      {/* Media */}
      <div className="relative aspect-square w-full bg-gray-100">
        {media && !imgError ? (
          isVideo ? (
            <video src={media} className="h-full w-full object-cover" muted playsInline />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={media} alt="" className="h-full w-full object-cover" onError={() => setImgError(true)} />
          )
        ) : (
          <div className="flex h-full items-center justify-center text-[11px] text-gray-400">No media preview</div>
        )}
      </div>

      {/* Link/CTA — a new ad shows the configured headline + link card; a promoted post keeps the simple bar */}
      {showLinkCard ? (
        <div className="flex items-center gap-2 border-t border-gray-100 bg-gray-50 px-3 py-2">
          <div className="min-w-0 flex-1">
            {linkDomain && <p className="truncate text-[10px] uppercase tracking-wide text-gray-500">{linkDomain}</p>}
            {headline && (
              <p className="line-clamp-2 text-[12px] font-semibold leading-tight text-gray-900">{headline}</p>
            )}
          </div>
          <span className="shrink-0 rounded-md bg-gray-200 px-2.5 py-1.5 text-[11px] font-semibold text-gray-700">
            {ctaLabel}
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-3 py-2">
          <span className="truncate text-[11px] text-gray-500">{pageName}</span>
          <span className="rounded-md bg-gray-200 px-2.5 py-1 text-[11px] font-semibold text-gray-700">{ctaLabel}</span>
        </div>
      )}

      {/* Engagement bar */}
      <div className="flex items-center justify-around border-t border-gray-100 px-3 py-1.5 text-[11px] text-gray-500">
        <span className="flex items-center gap-1">
          <ThumbsUp className="h-3.5 w-3.5" /> Like
        </span>
        <span className="flex items-center gap-1">
          <MessageCircle className="h-3.5 w-3.5" /> Comment
        </span>
        <span className="flex items-center gap-1">
          <Share2 className="h-3.5 w-3.5" /> Share
        </span>
      </div>
    </div>
  );
}

function OrganicPostRow({ post }: { post: OrganicPreviewPost }) {
  const name = post.message || post.postId || "Organic post";
  const metricLabel = post.metric ? post.metric.replace(/_/g, " ") : "metric";
  const metricValue =
    typeof post.metricValue === "number" && Number.isFinite(post.metricValue)
      ? `${post.metricValue.toLocaleString()} ${metricLabel}`
      : null;
  const createdDate = post.createdTime ? new Date(post.createdTime).toLocaleDateString() : null;

  return (
    <li className="flex items-center gap-2 px-2.5 py-1.5">
      <ItemThumbnail src={post.mediaUrl ?? null} alt={name} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-medium text-foreground">{name}</p>
        {(metricValue || createdDate || post.permalinkUrl) && (
          <p className="text-[10px] text-muted-foreground">
            {[metricValue, createdDate].filter(Boolean).join(" · ")}
            {post.permalinkUrl && (
              <>
                {metricValue || createdDate ? " · " : ""}
                <a
                  href={post.permalinkUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline-offset-2 hover:underline"
                >
                  Open post
                </a>
              </>
            )}
          </p>
        )}
      </div>
    </li>
  );
}

/**
 * Square 5x5 thumbnail rendered next to each matched-trigger row. Shows the
 * ad's own creative thumbnail when `src` is provided and loads successfully;
 * falls back to the Meta brand icon for rows without a thumbnail (e.g.
 * monitoring entities) or when the image fails to load (broken URL,
 * cross-origin block, etc.). Keeps row alignment stable in all states.
 *
 * Why this exists: trigger preview originally always rendered the Meta icon,
 * which was misleading for adscan competitor-ad triggers where the actual
 * matched ad has its own creative thumbnail.
 */
function ItemThumbnail({ src, alt }: { src: string | null; alt: string }) {
  const [errored, setErrored] = useState(false);
  const showImage = src !== null && src !== "" && !errored;
  return (
    <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center overflow-hidden rounded bg-muted/60">
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="h-full w-full object-cover" onError={() => setErrored(true)} />
      ) : (
        <Meta className="h-3.5 w-3.5" grayscale={false} />
      )}
    </div>
  );
}
