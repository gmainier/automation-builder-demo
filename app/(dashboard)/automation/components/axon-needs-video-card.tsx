"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";

interface ImageOnlyAd {
  adId: string;
  adName: string;
  mediaUrl: string;
  thumbnailUrl?: string;
}

interface AxonNeedsVideoCardProps {
  imageOnlyAds: ImageOnlyAd[];
  actionConfig: {
    accountId: string;
    campaignId: string;
    campaignName?: string;
    adStatus?: string;
    axonEndCards?: any[];
    axonCreativeLanguages?: string[];
  };
  executionId?: number;
  onLaunchSuccess?: (adBatchId: number) => void;
}

const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/x-m4v"];
const ALLOWED_EXTENSIONS = [".mp4", ".mov", ".m4v"];

export function AxonNeedsVideoCard({
  imageOnlyAds,
  actionConfig,
  executionId,
  onLaunchSuccess,
}: AxonNeedsVideoCardProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [launchResult, setLaunchResult] = useState<{
    success: boolean;
    error?: string;
    adBatchId?: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const extension = file.name.toLowerCase().split(".").pop();
    const isValid =
      ALLOWED_VIDEO_TYPES.includes(file.type) ||
      ALLOWED_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext));

    if (!isValid) {
      toast.error("Please select a video file (MP4, MOV, or M4V)");
      e.target.value = "";
      return;
    }

    // Validate file size (max 1GB)
    if (file.size > 1073741824) {
      toast.error("Video must be under 1GB");
      e.target.value = "";
      return;
    }

    setIsUploading(true);
    setLaunchResult(null);

    try {
      // Get video dimensions before uploading (used by Axon for 9:16 conversion)
      let videoDimension: string | undefined;
      try {
        const objectUrl = URL.createObjectURL(file);
        videoDimension = await new Promise<string | undefined>((resolve) => {
          const video = document.createElement("video");
          video.preload = "metadata";
          video.onloadedmetadata = () => {
            URL.revokeObjectURL(objectUrl);
            if (video.videoWidth && video.videoHeight) {
              resolve(`${video.videoWidth}x${video.videoHeight}`);
            } else {
              resolve(undefined);
            }
          };
          video.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(undefined);
          };
          video.src = objectUrl;
        });
      } catch {
        // Non-critical — dimension is optional
      }

      // Upload to R2 storage
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "automation-video");

      const uploadRes = await fetch("/api/library/r2-upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        throw new Error("Failed to upload video");
      }

      const uploadData = await uploadRes.json();
      const videoUrl = uploadData.url || uploadData.publicUrl;

      if (!videoUrl) {
        throw new Error("Upload succeeded but no URL returned");
      }

      setUploadedUrl(videoUrl);
      toast.success("Video uploaded! Launching on AppLovin...");

      // Retry the Axon launch with the uploaded video + original images
      const retryRes = await fetch("/api/automation-rules/retry-axon-launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrl,
          adName: file.name.replace(/\.[^.]+$/, ""),
          videoDimension,
          actionConfig,
          executionId,
          imageOnlyAds,
        }),
      });

      const retryData = await retryRes.json();
      setLaunchResult(retryData);

      if (retryData.success) {
        toast.success(`AppLovin launch successful! Batch ID: ${retryData.adBatchId}`);
        onLaunchSuccess?.(retryData.adBatchId);
      } else {
        toast.error(retryData.error || "AppLovin launch failed");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to upload video");
      setLaunchResult({ success: false, error: err.message });
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-3">
      {/* Warning banner */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <p className="font-medium">AppLovin requires video ads</p>
          <p className="text-xs mt-0.5 text-amber-700">
            All {imageOnlyAds.length} qualifying ad
            {imageOnlyAds.length > 1 ? "s" : ""} contain only images. Upload a video (MP4/MOV/M4V, max 60s, 9:16
            portrait) to launch on AppLovin.
          </p>
        </div>
      </div>

      {/* Image-only ads grid */}
      <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
        {imageOnlyAds.slice(0, 5).map((ad) => (
          <div key={ad.adId} className="flex items-center gap-3 p-2 text-sm">
            {(ad.thumbnailUrl || ad.mediaUrl) && (
              <div className="relative w-10 h-10 rounded overflow-hidden bg-muted shrink-0">
                <Image src={ad.thumbnailUrl || ad.mediaUrl} alt="" fill className="object-cover" unoptimized />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="truncate font-medium">{ad.adName}</p>
              <p className="text-xs text-muted-foreground">{ad.adId}</p>
            </div>
            <Badge variant="outline" className="text-[10px] shrink-0">
              image
            </Badge>
          </div>
        ))}
        {imageOnlyAds.length > 5 && (
          <div className="p-2 text-center text-xs text-muted-foreground">+{imageOnlyAds.length - 5} more ads</div>
        )}
      </div>

      {/* Upload & Launch section */}
      {!launchResult?.success && (
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp4,.mov,.m4v,video/mp4,video/quicktime"
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="gap-1.5">
            {isUploading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {uploadedUrl ? "Launching..." : "Uploading..."}
              </>
            ) : (
              <>
                <Upload className="h-3.5 w-3.5" />
                Upload Video & Launch
              </>
            )}
          </Button>
          <span className="text-xs text-muted-foreground">MP4, MOV, M4V (max 1GB)</span>
        </div>
      )}

      {/* Launch result */}
      {launchResult && (
        <div
          className={`flex items-center gap-2 p-2 rounded-lg text-sm ${
            launchResult.success
              ? "bg-green-50 border border-green-200 text-green-700"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}
        >
          {launchResult.success ? (
            <>
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Launched successfully! Batch ID: {launchResult.adBatchId}</span>
            </>
          ) : (
            <>
              <XCircle className="h-4 w-4 shrink-0" />
              <span>{launchResult.error || "Launch failed"}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
