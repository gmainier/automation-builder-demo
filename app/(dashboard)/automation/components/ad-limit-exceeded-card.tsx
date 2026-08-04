"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, AlertTriangle, CheckCircle2, XCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";

interface ExistingAd {
  id: string;
  name: string;
  effective_status: string;
  thumbnailUrl: string | null;
  spend: string;
  impressions: string;
  createdTime: string | null;
}

interface AutoSplitInfo {
  createdAdSetCount: number;
  createdAdSetIds: string[];
  adsPlaced: number;
}

interface AdLimitExceededCardProps {
  adSetId: string;
  accountId: string;
  currentAdCount: number;
  maxAds: number;
  adsToLaunch: number;
  adsToDelete: number;
  existingAds: ExistingAd[];
  executionId: number;
  onResumeSuccess?: () => void;
  autoSplitInfo?: AutoSplitInfo;
}

export function AdLimitExceededCard({
  adSetId,
  accountId,
  currentAdCount,
  maxAds,
  adsToLaunch,
  adsToDelete,
  existingAds,
  executionId,
  onResumeSuccess,
  autoSplitInfo,
}: AdLimitExceededCardProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    error?: string;
  } | null>(null);

  const toggleAd = (adId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(adId)) {
        next.delete(adId);
      } else {
        next.add(adId);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === existingAds.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(existingAds.map((ad) => ad.id)));
    }
  };

  const handleDeleteAndResume = async () => {
    if (selectedIds.size < adsToDelete) {
      toast.error(`Please select at least ${adsToDelete} ads to delete`);
      return;
    }

    setProcessing(true);
    setResult(null);

    try {
      const res = await fetch("/api/automation-rules/delete-ads-and-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adIdsToDelete: Array.from(selectedIds),
          executionId,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setResult({ success: true });
        toast.success("Ads deleted and automation resumed!");
        onResumeSuccess?.();
      } else {
        setResult({
          success: false,
          error: data.error || "Failed to delete and resume",
        });
        toast.error(data.error || "Failed to delete and resume");
      }
    } catch (err: any) {
      setResult({ success: false, error: err.message });
      toast.error(err.message || "An error occurred");
    } finally {
      setProcessing(false);
    }
  };

  const handleSkip = async () => {
    setProcessing(true);
    setResult(null);

    try {
      const res = await fetch("/api/automation-rules/delete-ads-and-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adIdsToDelete: [],
          executionId,
          skipDeletion: true,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setResult({ success: true });
        toast.success("Automation resumed without deletion");
        onResumeSuccess?.();
      } else {
        setResult({ success: false, error: data.error || "Failed to resume" });
        toast.error(data.error || "Failed to resume");
      }
    } catch (err: any) {
      setResult({ success: false, error: err.message });
      toast.error(err.message || "An error occurred");
    } finally {
      setProcessing(false);
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-green-100 text-green-700 border-green-200";
      case "PAUSED":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      default:
        return "bg-gray-100 text-gray-600 border-gray-200";
    }
  };

  return (
    <div className="space-y-3">
      {/* Warning banner */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <p className="font-medium">
            Ad set has {currentAdCount}/{maxAds} ads
          </p>
          <p className="text-xs mt-0.5 text-red-700">
            Launching {adsToLaunch} ad{adsToLaunch > 1 ? "s" : ""} would exceed Meta's {maxAds}-ad limit. Delete at
            least {adsToDelete} existing ad
            {adsToDelete > 1 ? "s" : ""} to continue.
          </p>
        </div>
      </div>

      {/* Auto-split info banner */}
      {autoSplitInfo && autoSplitInfo.createdAdSetCount > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-sm">
          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">
              Auto-split created {autoSplitInfo.createdAdSetCount} new ad set
              {autoSplitInfo.createdAdSetCount > 1 ? "s" : ""} and placed {autoSplitInfo.adsPlaced} ad
              {autoSplitInfo.adsPlaced !== 1 ? "s" : ""}
            </p>
            <p className="text-xs mt-0.5 text-blue-700">
              {adsToLaunch} remaining ad{adsToLaunch > 1 ? "s" : ""} still need{adsToLaunch === 1 ? "s" : ""} space.
              Delete ads below or skip to continue.
            </p>
            <div className="flex flex-wrap gap-1 mt-1">
              {autoSplitInfo.createdAdSetIds.map((id) => (
                <a
                  key={id}
                  href={`https://adsmanager.facebook.com/adsmanager/manage/adsets?act=${accountId}&selected_adset_ids=${id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-blue-600 hover:text-blue-800 underline"
                >
                  {id}
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2 text-center text-xs">
        <div className="rounded-lg border bg-muted/30 p-2">
          <p className="text-muted-foreground">Max Ads</p>
          <p className="font-semibold text-sm">{maxAds}</p>
        </div>
        <div className="rounded-lg border bg-muted/30 p-2">
          <p className="text-muted-foreground">Current</p>
          <p className="font-semibold text-sm">{currentAdCount}</p>
        </div>
        <div className="rounded-lg border bg-muted/30 p-2">
          <p className="text-muted-foreground">To Launch</p>
          <p className="font-semibold text-sm">{adsToLaunch}</p>
        </div>
        <div className="rounded-lg border bg-red-50 p-2">
          <p className="text-red-600">To Delete</p>
          <p className="font-semibold text-sm text-red-700">{adsToDelete}</p>
        </div>
      </div>

      {/* Header */}
      <div>
        <p className="text-sm font-medium text-blue-700">
          Delete {adsToDelete} ad{adsToDelete > 1 ? "s" : ""} from Meta Ads Manager to launch
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Ad data is for the last 7 days. Sorted by impressions (lowest first).
        </p>
      </div>

      {/* Ads table */}
      {!result?.success && (
        <div className="border rounded-lg max-h-64 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                <th className="p-2 text-left w-8">
                  <Checkbox
                    checked={selectedIds.size === existingAds.length && existingAds.length > 0}
                    onCheckedChange={toggleAll}
                  />
                </th>
                <th className="p-2 text-left w-8">#</th>
                <th className="p-2 text-left w-10"></th>
                <th className="p-2 text-left">Name</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-right">Spend</th>
                <th className="p-2 text-right">Impr.</th>
                <th className="p-2 text-left">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {existingAds.map((ad, index) => (
                <tr
                  key={ad.id}
                  className={`hover:bg-muted/30 cursor-pointer ${selectedIds.has(ad.id) ? "bg-blue-50" : ""}`}
                  onClick={() => toggleAd(ad.id)}
                >
                  <td className="p-2">
                    <Checkbox checked={selectedIds.has(ad.id)} onCheckedChange={() => toggleAd(ad.id)} />
                  </td>
                  <td className="p-2 text-muted-foreground">{index + 1}</td>
                  <td className="p-2">
                    {ad.thumbnailUrl ? (
                      <div className="relative w-8 h-8 rounded overflow-hidden bg-muted shrink-0">
                        <Image src={ad.thumbnailUrl} alt="" fill className="object-cover" unoptimized />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded bg-muted flex items-center justify-center text-muted-foreground text-[10px]">
                        Ad
                      </div>
                    )}
                  </td>
                  <td className="p-2">
                    <p className="truncate max-w-[160px] font-medium">{ad.name}</p>
                    <p className="text-[10px] text-muted-foreground">{ad.id}</p>
                  </td>
                  <td className="p-2">
                    <Badge variant="outline" className={`text-[10px] ${statusColor(ad.effective_status)}`}>
                      {ad.effective_status}
                    </Badge>
                  </td>
                  <td className="p-2 text-right font-mono">${parseFloat(ad.spend).toFixed(2)}</td>
                  <td className="p-2 text-right font-mono">{parseInt(ad.impressions).toLocaleString()}</td>
                  <td className="p-2 text-muted-foreground">
                    {ad.createdTime
                      ? formatDistanceToNow(new Date(ad.createdTime), {
                          addSuffix: true,
                        })
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer / action buttons */}
      {!result?.success && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Select {adsToDelete} ad{adsToDelete > 1 ? "s" : ""} to delete ({selectedIds.size} selected)
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleSkip} disabled={processing}>
              Skip
            </Button>
            <Button
              size="sm"
              onClick={handleDeleteAndResume}
              disabled={processing || selectedIds.size < adsToDelete}
              className="gap-1.5 bg-red-600 hover:bg-red-700"
            >
              {processing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete & Resume
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Result banner */}
      {result && (
        <div
          className={`flex items-center gap-2 p-2 rounded-lg text-sm ${
            result.success
              ? "bg-green-50 border border-green-200 text-green-700"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}
        >
          {result.success ? (
            <>
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Ads deleted and automation resumed successfully!</span>
            </>
          ) : (
            <>
              <XCircle className="h-4 w-4 shrink-0" />
              <span>{result.error || "Operation failed"}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
