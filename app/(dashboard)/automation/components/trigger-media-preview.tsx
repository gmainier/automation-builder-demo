"use client";

import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Image as ImageIcon, Video, FileText, BarChart3, Table2, Megaphone, FolderOpen, Eye } from "lucide-react";

interface TriggerMediaPreviewProps {
  flowState: any;
  executionFlow: any;
}

/**
 * Determine trigger info from execution flow nodes.
 */
function getTriggerInfo(executionFlow: any): { service: string; event: string } | null {
  const nodes = executionFlow?.nodes;
  if (!Array.isArray(nodes)) return null;
  const triggerNode = nodes.find((n: any) => n.type === "trigger");
  if (!triggerNode) return null;
  return { service: triggerNode.service, event: triggerNode.event };
}

/**
 * Check if a MIME type is an image.
 */
function isImage(mimeType?: string): boolean {
  return !!mimeType && mimeType.startsWith("image/");
}

/**
 * Check if a MIME type is a video.
 */
function isVideo(mimeType?: string): boolean {
  return !!mimeType && mimeType.startsWith("video/");
}

/**
 * Infer media type from URL extension.
 */
function inferMediaType(url?: string): "image" | "video" | "unknown" {
  if (!url) return "unknown";
  const lower = url.toLowerCase();
  if (/\.(mp4|mov|avi|webm|mkv)/.test(lower)) return "video";
  if (/\.(jpg|jpeg|png|gif|webp|svg|bmp)/.test(lower)) return "image";
  return "unknown";
}

function MediaThumbnail({
  src,
  alt,
  mimeType,
  videoSrc,
  posterSrc,
}: {
  src: string;
  alt: string;
  mimeType?: string;
  /** Direct video URL for <video> element (e.g. fileUrl when src is a thumbnail) */
  videoSrc?: string;
  /** Poster/thumbnail URL for <video> element */
  posterSrc?: string;
}) {
  const mediaType = isVideo(mimeType) ? "video" : isImage(mimeType) ? "image" : inferMediaType(src);

  return (
    <div className="relative rounded-lg overflow-hidden border bg-muted/30 group">
      {mediaType === "video" ? (
        <div className="relative">
          {/* Use <video> to get a real frame thumbnail from the video */}
          <video
            src={videoSrc || src}
            poster={posterSrc}
            preload="metadata"
            muted
            playsInline
            className="w-full h-40 object-cover"
            onError={(e) => {
              // If video fails to load, show placeholder
              (e.target as HTMLVideoElement).style.display = "none";
              (e.target as HTMLVideoElement).nextElementSibling?.classList.remove("hidden");
            }}
          />
          <div className="hidden w-full h-40 flex items-center justify-center bg-muted">
            <Video className="h-10 w-10 text-muted-foreground" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="rounded-full bg-black/40 p-2.5">
              <Video className="h-5 w-5 text-white" />
            </div>
          </div>
        </div>
      ) : mediaType === "image" ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={src}
          alt={alt}
          className="w-full h-40 object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
            (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
          }}
        />
      ) : (
        <div className="w-full h-40 flex items-center justify-center bg-muted">
          <FileText className="h-10 w-10 text-muted-foreground" />
        </div>
      )}
      {/* Hidden fallback for image errors */}
      {mediaType === "image" && (
        <div className="hidden w-full h-40 flex items-center justify-center bg-muted">
          <ImageIcon className="h-10 w-10 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

function GoogleDrivePreview({ data }: { data: any }) {
  const url = data.thumbnailUrl || data.fileUrl;
  if (!url) return null;

  return (
    <div className="space-y-2">
      <MediaThumbnail
        src={url}
        alt={data.fileName || "Google Drive file"}
        mimeType={data.mimeType}
        videoSrc={data.fileUrl}
        posterSrc={data.thumbnailUrl}
      />
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium truncate flex-1">{data.fileName || "Untitled file"}</p>
        {data.mimeType && (
          <Badge variant="secondary" className="text-xs shrink-0">
            {data.mimeType.split("/").pop()}
          </Badge>
        )}
      </div>
      {data.folderName && <p className="text-xs text-muted-foreground">Folder: {data.folderName}</p>}
    </div>
  );
}

function GoogleDriveFolderPreview({ data }: { data: any }) {
  const files: any[] = data.videoFiles || data.imageFiles || data.files || [];
  if (files.length === 0 && !data.fileCount) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <FolderOpen className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm font-medium">{data.folderName || "Folder"}</p>
        <Badge variant="secondary" className="text-xs">
          {data.fileCount || files.length} file{(data.fileCount || files.length) !== 1 ? "s" : ""}
        </Badge>
        {data.videoCount > 0 && (
          <Badge variant="secondary" className="text-xs">
            {data.videoCount} video{data.videoCount !== 1 ? "s" : ""}
          </Badge>
        )}
        {data.imageCount > 0 && (
          <Badge variant="secondary" className="text-xs">
            {data.imageCount} image{data.imageCount !== 1 ? "s" : ""}
          </Badge>
        )}
      </div>
      {files.length > 0 && (
        <ScrollArea className="w-full">
          <div className="flex gap-3 pb-2">
            {files.slice(0, 6).map((file: any, idx: number) => (
              <div key={idx} className="shrink-0 w-32">
                <MediaThumbnail
                  src={file.thumbnailUrl || file.webContentLink || ""}
                  alt={file.name || `File ${idx + 1}`}
                  mimeType={file.mimeType}
                  videoSrc={file.webContentLink}
                  posterSrc={file.thumbnailUrl}
                />
                <p className="text-xs text-muted-foreground mt-1 truncate">{file.name || `File ${idx + 1}`}</p>
              </div>
            ))}
            {files.length > 6 && (
              <div className="shrink-0 w-32 h-40 rounded-lg border bg-muted/30 flex items-center justify-center">
                <p className="text-sm text-muted-foreground">+{files.length - 6} more</p>
              </div>
            )}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}
    </div>
  );
}

function MediaLibraryPreview({ data }: { data: any }) {
  const url = data.thumbnail || data.assetUrl;
  if (!url) return null;

  return (
    <div className="space-y-2">
      <MediaThumbnail
        src={url}
        alt={data.assetName || "Media asset"}
        mimeType={data.mimeType}
        videoSrc={data.assetUrl}
        posterSrc={data.thumbnail}
      />
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium truncate flex-1">{data.assetName || "Untitled asset"}</p>
        {data.mimeType && (
          <Badge variant="secondary" className="text-xs shrink-0">
            {data.mimeType.split("/").pop()}
          </Badge>
        )}
      </div>
      {data.boardName && <p className="text-xs text-muted-foreground">Board: {data.boardName}</p>}
    </div>
  );
}

function PerformanceThresholdPreview({ data }: { data: any }) {
  const ads: any[] = data.qualifyingAds || [];
  const count = data.qualifyingAdsCount || ads.length;
  if (count === 0) return null;

  const displayAds = ads.slice(0, 5);
  // Check if any ads have thumbnails
  const hasAnyThumbnail = displayAds.some((ad: any) => ad.thumbnailUrl);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-blue-500" />
        <p className="text-sm font-medium">
          {count} qualifying ad{count !== 1 ? "s" : ""}
        </p>
      </div>
      {/* Show thumbnails in a horizontal scroll if available */}
      {hasAnyThumbnail && (
        <ScrollArea className="w-full">
          <div className="flex gap-3 pb-2">
            {displayAds
              .filter((ad: any) => ad.thumbnailUrl)
              .map((ad: any, idx: number) => (
                <div key={idx} className="shrink-0 w-36">
                  <MediaThumbnail src={ad.thumbnailUrl} alt={ad.adName || `Ad ${idx + 1}`} />
                  <p className="text-xs text-muted-foreground mt-1 truncate">{ad.adName || `Ad ${idx + 1}`}</p>
                </div>
              ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}
      <div className="space-y-1.5">
        {displayAds.map((ad: any, idx: number) => (
          <div key={idx} className="flex items-center gap-2 p-2 rounded bg-muted/50 text-sm">
            {ad.thumbnailUrl && (
              <div className="relative h-10 w-10 rounded overflow-hidden border bg-muted shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ad.thumbnailUrl} alt="" className="h-full w-full object-cover" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{ad.adName || ad.adId || `Ad ${idx + 1}`}</p>
              {ad.adsetName && <p className="text-xs text-muted-foreground truncate">{ad.adsetName}</p>}
            </div>
            <div className="flex gap-3 text-xs text-muted-foreground shrink-0 ml-3">
              {ad.spend != null && <span>Spend: ${Number(ad.spend).toFixed(2)}</span>}
              {ad.roas != null && <span>ROAS: {Number(ad.roas).toFixed(2)}</span>}
              {ad.cpa != null && <span>CPA: ${Number(ad.cpa).toFixed(2)}</span>}
            </div>
          </div>
        ))}
        {ads.length > 5 && <p className="text-xs text-muted-foreground text-center">+{ads.length - 5} more ads</p>}
      </div>
    </div>
  );
}

function AdLaunchedPreview({ data }: { data: any }) {
  const ads: any[] = data.launchedAds || [];
  const count = data.launchedAdsCount || ads.length;
  if (count === 0) return null;

  // If there's a video URL from the first ad, show it
  const videoUrl = data.videoUrl || ads[0]?.videoUrl;
  const videoName = data.videoName || ads[0]?.videoName || ads[0]?.name;

  return (
    <div className="space-y-2">
      {videoUrl && (
        <MediaThumbnail src={videoUrl} alt={videoName || "Launched ad"} mimeType="video/mp4" videoSrc={videoUrl} />
      )}
      <div className="flex items-center gap-2">
        <Megaphone className="h-4 w-4 text-green-500" />
        <p className="text-sm font-medium">
          {count} launched ad{count !== 1 ? "s" : ""}
        </p>
        {data.batchTitle && (
          <Badge variant="secondary" className="text-xs">
            {data.batchTitle}
          </Badge>
        )}
      </div>
      {ads.length > 0 && (
        <div className="space-y-1">
          {ads.slice(0, 3).map((ad: any, idx: number) => (
            <div key={idx} className="flex items-center gap-2 p-1.5 rounded bg-muted/50 text-sm">
              <p className="truncate">{ad.videoName || ad.name || ad.adId || `Ad ${idx + 1}`}</p>
              {ad.adGroupName && <span className="text-xs text-muted-foreground shrink-0">{ad.adGroupName}</span>}
            </div>
          ))}
          {ads.length > 3 && <p className="text-xs text-muted-foreground">+{ads.length - 3} more</p>}
        </div>
      )}
    </div>
  );
}

function AdApprovedPreview({ data }: { data: any }) {
  const ads: any[] = data.approvedAds || [];
  const count = data.approvedAdsCount || ads.length;
  if (count === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Eye className="h-4 w-4 text-emerald-500" />
        <p className="text-sm font-medium">
          {count} approved ad{count !== 1 ? "s" : ""}
        </p>
      </div>
      <div className="space-y-1">
        {ads.slice(0, 5).map((ad: any, idx: number) => (
          <div key={idx} className="flex items-center justify-between p-1.5 rounded bg-muted/50 text-sm">
            <p className="truncate">{ad.adName || ad.adId || `Ad ${idx + 1}`}</p>
            {ad.campaignName && <span className="text-xs text-muted-foreground shrink-0 ml-2">{ad.campaignName}</span>}
          </div>
        ))}
        {ads.length > 5 && <p className="text-xs text-muted-foreground">+{ads.length - 5} more</p>}
      </div>
    </div>
  );
}

function GoogleSheetsPreview({ data }: { data: any }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Table2 className="h-4 w-4 text-green-600" />
        <p className="text-sm font-medium">Google Sheets</p>
      </div>
      <div className="p-3 rounded bg-muted/50 space-y-1 text-sm">
        {data.sheetName && (
          <p>
            <span className="text-muted-foreground">Sheet:</span> {data.sheetName}
          </p>
        )}
        {data.newRowCount != null && (
          <p>
            <span className="text-muted-foreground">New rows:</span> {data.newRowCount}
          </p>
        )}
        {data.triggerValue != null && (
          <p>
            <span className="text-muted-foreground">Trigger value:</span> {String(data.triggerValue)}
          </p>
        )}
        {data.processedRowCount != null && (
          <p>
            <span className="text-muted-foreground">Processed rows:</span> {data.processedRowCount}
          </p>
        )}
      </div>
    </div>
  );
}

function CampaignStatusPreview({ data }: { data: any }) {
  const campaigns: any[] = data.matchingCampaigns || [];
  const count = data.matchingCampaignsCount || campaigns.length;
  if (count === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Megaphone className="h-4 w-4 text-orange-500" />
        <p className="text-sm font-medium">
          {count} campaign{count !== 1 ? "s" : ""} changed to {data.targetStatus || "new status"}
        </p>
      </div>
      <div className="space-y-1">
        {campaigns.slice(0, 5).map((c: any, idx: number) => (
          <div key={idx} className="flex items-center justify-between p-1.5 rounded bg-muted/50 text-sm">
            <p className="truncate">{c.campaignName || c.campaignId || `Campaign ${idx + 1}`}</p>
            {c.effectiveStatus && (
              <Badge variant="secondary" className="text-xs shrink-0">
                {c.effectiveStatus}
              </Badge>
            )}
          </div>
        ))}
        {campaigns.length > 5 && <p className="text-xs text-muted-foreground">+{campaigns.length - 5} more</p>}
      </div>
    </div>
  );
}

function OrganicPostPreview({ data }: { data: any }) {
  const posts: any[] = Array.isArray(data.winners) && data.winners.length > 0 ? data.winners : [data];
  const displayPosts = posts.filter((post) => post?.postId || post?.mediaUrl).slice(0, 5);
  if (displayPosts.length === 0 && !data.qualifyingPostsCount) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Megaphone className="h-4 w-4 text-blue-500" />
        <p className="text-sm font-medium">
          {data.qualifyingPostsCount || displayPosts.length} organic post
          {(data.qualifyingPostsCount || displayPosts.length) !== 1 ? "s" : ""} ready to promote
        </p>
      </div>
      {displayPosts.map((post, idx) => (
        <OrganicPostPreviewRow key={post.postId || idx} post={post} />
      ))}
    </div>
  );
}

function OrganicPostPreviewRow({ post }: { post: any }) {
  const mediaUrl = post.mediaUrl || post.thumbnail || post.assetUrl;
  const metricLabel = post.metric ? String(post.metric).replace(/_/g, " ") : "metric";

  return (
    <div className="flex gap-3 rounded bg-muted/50 p-2 text-sm">
      {mediaUrl && (
        <div className="w-24 shrink-0">
          <MediaThumbnail
            src={mediaUrl}
            alt={post.message || "Organic post"}
            mimeType={post.mediaType === "video" ? "video/mp4" : post.mediaType === "image" ? "image/jpeg" : undefined}
            videoSrc={post.mediaType === "video" ? mediaUrl : undefined}
          />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 font-medium">{post.message || post.postId || "Organic post"}</p>
        <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
          {post.metricValue != null && (
            <span>
              {Number(post.metricValue).toLocaleString()} {metricLabel}
            </span>
          )}
          {post.createdTime && <span>{new Date(post.createdTime).toLocaleDateString()}</span>}
          {post.permalinkUrl && (
            <a
              className="text-primary underline-offset-2 hover:underline"
              href={post.permalinkUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open post
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Renders a preview of the trigger data for an automation approval.
 * Shows media thumbnails, ad summaries, or data previews based on trigger type.
 */
export function TriggerMediaPreview({ flowState, executionFlow }: TriggerMediaPreviewProps) {
  if (!flowState) return null;

  const triggerInfo = getTriggerInfo(executionFlow);
  const data = flowState.triggerOutputs || {};
  // Fallback: check stepResults[0].outputs for extra data
  const stepOutputs = flowState.stepResults?.[0]?.outputs || {};
  const merged = { ...stepOutputs, ...data };

  // If there's essentially no data, don't render
  const hasData = Object.keys(merged).filter((k) => k !== "summary").length > 0;
  if (!hasData && !merged.summary) return null;

  const service = triggerInfo?.service;
  const event = triggerInfo?.event;

  let content: React.ReactNode = null;

  if (service === "google-drive" && event === "New File in Folder") {
    // Single file from Google Drive
    if (merged.fileUrl || merged.thumbnailUrl) {
      content = <GoogleDrivePreview data={merged} />;
    }
  } else if (service === "google-drive" && event === "New Files in Folder") {
    // Folder with multiple files
    content = <GoogleDriveFolderPreview data={merged} />;
  } else if (service === "media-library") {
    content = <MediaLibraryPreview data={merged} />;
  } else if (service === "meta-ads" && event === "Performance Threshold") {
    content = <PerformanceThresholdPreview data={merged} />;
  } else if (service === "meta-ads" && event === "Best Performing Organic Post") {
    content = <OrganicPostPreview data={merged} />;
  } else if (event === "Ad Launched") {
    content = <AdLaunchedPreview data={merged} />;
  } else if (event === "Ad Approved") {
    content = <AdApprovedPreview data={merged} />;
  } else if (service === "google-sheets") {
    content = <GoogleSheetsPreview data={merged} />;
  } else if (event === "Campaign Status Change") {
    content = <CampaignStatusPreview data={merged} />;
  }

  // For any trigger with assetUrl/thumbnail/fileUrl, show a generic media preview
  if (!content && (merged.assetUrl || merged.thumbnail || merged.fileUrl || merged.thumbnailUrl || merged.mediaUrl)) {
    const url = merged.thumbnail || merged.thumbnailUrl || merged.assetUrl || merged.fileUrl || merged.mediaUrl;
    const name = merged.assetName || merged.fileName || merged.message || "Media";
    content = (
      <div className="space-y-2">
        <MediaThumbnail
          src={url}
          alt={name}
          mimeType={
            merged.mimeType ||
            (merged.mediaType === "video" ? "video/mp4" : merged.mediaType === "image" ? "image/jpeg" : undefined)
          }
          videoSrc={merged.assetUrl || merged.fileUrl || (merged.mediaType === "video" ? merged.mediaUrl : undefined)}
          posterSrc={merged.thumbnail || merged.thumbnailUrl}
        />
        <p className="text-sm font-medium truncate">{name}</p>
      </div>
    );
  }

  // Fallback: just summary text
  if (!content && merged.summary && merged.summary !== `Triggered at ${merged.summary}`) {
    content = <p className="text-sm text-muted-foreground">{merged.summary}</p>;
  }

  if (!content) return null;

  return (
    <div>
      <h4 className="font-semibold mb-2 flex items-center gap-2">
        <Eye className="h-4 w-4" />
        Trigger Preview
      </h4>
      <div className="rounded-lg border p-4">{content}</div>
    </div>
  );
}

/**
 * Compact inline preview for table rows. Shows a small thumbnail or summary badge.
 */
export function TriggerMiniPreview({ flowState, executionFlow }: TriggerMediaPreviewProps) {
  if (!flowState) return null;

  const triggerInfo = getTriggerInfo(executionFlow);
  const data = flowState.triggerOutputs || {};
  const stepOutputs = flowState.stepResults?.[0]?.outputs || {};
  const merged = { ...stepOutputs, ...data };

  const thumbnailUrl = merged.thumbnail || merged.thumbnailUrl || merged.assetUrl || merged.fileUrl || merged.mediaUrl;
  const name = merged.assetName || merged.fileName || merged.folderName || merged.message;

  if (thumbnailUrl) {
    const mimeType =
      merged.mimeType ||
      (merged.mediaType === "video" ? "video/mp4" : merged.mediaType === "image" ? "image/jpeg" : undefined);
    const mediaType = isVideo(mimeType) ? "video" : isImage(mimeType) ? "image" : inferMediaType(thumbnailUrl);
    const videoUrl = merged.assetUrl || merged.fileUrl || (merged.mediaType === "video" ? merged.mediaUrl : undefined);

    return (
      <div className="flex items-center gap-2 mt-1">
        <div className="relative h-8 w-8 rounded overflow-hidden border bg-muted shrink-0">
          {mediaType === "video" && videoUrl ? (
            <>
              <video
                src={videoUrl}
                poster={merged.thumbnail || merged.thumbnailUrl}
                preload="metadata"
                muted
                playsInline
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.target as HTMLVideoElement).style.display = "none";
                  (e.target as HTMLVideoElement).nextElementSibling?.classList.remove("hidden");
                }}
              />
              <div className="hidden h-full w-full flex items-center justify-center">
                <Video className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
                <Video className="h-3 w-3 text-white" />
              </div>
            </>
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thumbnailUrl}
                alt={name || "Preview"}
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                  (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                }}
              />
              <div className="hidden h-full w-full flex items-center justify-center">
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
              </div>
            </>
          )}
        </div>
        {name && <span className="text-xs text-muted-foreground truncate max-w-[120px]">{name}</span>}
      </div>
    );
  }

  // For non-media triggers, show a compact summary
  const service = triggerInfo?.service;
  const event = triggerInfo?.event;

  if (service === "meta-ads" && merged.qualifyingAdsCount) {
    return (
      <span className="text-xs text-muted-foreground mt-1 block">
        {merged.qualifyingAdsCount} qualifying ad{merged.qualifyingAdsCount !== 1 ? "s" : ""}
      </span>
    );
  }

  if (event === "Ad Launched" && merged.launchedAdsCount) {
    return (
      <span className="text-xs text-muted-foreground mt-1 block">
        {merged.launchedAdsCount} launched ad{merged.launchedAdsCount !== 1 ? "s" : ""}
      </span>
    );
  }

  if (service === "google-sheets" && merged.sheetName) {
    return (
      <span className="text-xs text-muted-foreground mt-1 block truncate max-w-[150px]">Sheet: {merged.sheetName}</span>
    );
  }

  return null;
}
