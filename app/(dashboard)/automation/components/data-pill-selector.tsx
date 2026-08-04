"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, X } from "lucide-react";
import { type AutomationNode } from "../contexts/automation-context";
import { AutomationAdSetSelector } from "./automation-adset-selector";
import {
  ADSCAN_ADVERTISER_LAUNCH_VOLUME_EVENT,
  ADSCAN_NEW_COMPETITOR_AD_EVENT,
  ADSCAN_NEW_COMPETITOR_AD_EVENT_LEGACY,
  ADSCAN_SERVICE,
  isAdscanAdvertiserLaunchVolumeEvent,
  isAdscanNewCompetitorAdEvent,
} from "../lib/adscan-events";

interface DataPillSelectorProps {
  previousNodes: AutomationNode[];
  currentNode: AutomationNode;
  currentValue?: string;
  onSelect: (value: string, name?: string) => void;
  accountId?: string;
  accountType?: string | null;
  fieldName: string;
  placeholder?: string;
  showManualSelector?: boolean;
}

// Fields that indicate a step produces Meta ads — if any of these are present in
// the declared outputs, the runtime will auto-derive an Ads Manager link, so we
// surface it as a pickable data pill here too (plug-and-play with any producer).
const AD_PRODUCING_OUTPUT_FIELDS = new Set(["qualifyingAdIds", "qualifyingAds", "qualifyingEntityIds", "adIds"]);
const GOOGLE_SHEETS_LAUNCH_ROW_FIELDS = [
  "id",
  "city",
  "city_naming",
  "country",
  "targeting_location",
  "radius_m",
  "visual_text",
  "min_spend",
  "max_spend",
  "Ad_Set_budget",
  "audience_size",
  "google_maps_image",
  "No_landmarks_image_URL",
  "landing_page_url",
  "hidden_targeting_location_geo",
] as const;

function withAdsManagerLinkOutput(outputs: { field: string; label: string }[]): { field: string; label: string }[] {
  const producesAds = outputs.some((o) => AD_PRODUCING_OUTPUT_FIELDS.has(o.field));
  if (!producesAds) return outputs;
  if (outputs.some((o) => o.field === "adsManagerLink")) return outputs;
  return [...outputs, { field: "adsManagerLink", label: "Ads Manager Link (filtered to ads)" }];
}

// Get available outputs for each action/filter type
// nodeConfig is optional - when provided, dynamic outputs (like Google Sheets data mappings) can be included
export function getOutputsForEvent(
  event: string,
  nodeType: string,
  service?: string,
  nodeConfig?: any,
): { field: string; label: string }[] {
  return withAdsManagerLinkOutput(getOutputsForEventInner(event, nodeType, service, nodeConfig));
}

function getOutputsForEventInner(
  event: string,
  nodeType: string,
  service?: string,
  nodeConfig?: any,
): { field: string; label: string }[] {
  // Action outputs
  if (nodeType === "action") {
    switch (event) {
      case "Duplicate Ad Set":
        return [
          { field: "resultId", label: "New Ad Set ID" },
          { field: "newName", label: "Ad Set Name" },
          { field: "campaignId", label: "Campaign ID" },
        ];
      case "Duplicate Campaign":
        return [
          { field: "resultId", label: "New Campaign ID" },
          { field: "campaignName", label: "Campaign Name" },
        ];
      case "Duplicate Ad":
        return [{ field: "resultId", label: "New Ad ID" }];
      case "Launch Ad":
        return [
          { field: "resultId", label: "Ad Batch ID" },
          { field: "adIds", label: "Created Ad IDs" },
        ];
      case "Launch on TikTok":
      case "Launch on Snapchat":
      case "Launch on Pinterest":
      case "Launch on Axon":
        return [
          { field: "launchedCount", label: "Launched Ad Count" },
          { field: "adBatchIds", label: "Ad Batch IDs" },
          { field: "failedCount", label: "Failed Count" },
        ];
      case "Generate Report Link":
        return [
          { field: "shareableUrl", label: "Shareable Report URL" },
          { field: "reportType", label: "Report Type" },
          { field: "reportTitle", label: "Report Title" },
          { field: "dateRange", label: "Date Range" },
        ];
      default:
        return [];
    }
  }

  // Filter outputs (pass through with matched value)
  if (nodeType === "filter") {
    return [
      { field: "matchedValue", label: "Matched Value" },
      { field: "passed", label: "Filter Passed (true/false)" },
    ];
  }

  // Trigger outputs - check both event name and service
  if (nodeType === "trigger") {
    // Media Library triggers (match by event OR service)
    if (event === "Media Uploaded to Board" || service === "media-library") {
      return [
        { field: "assetId", label: "Asset ID" },
        { field: "assetName", label: "Asset Name" },
        { field: "mediaUrl", label: "Media URL" },
        { field: "boardId", label: "Board ID" },
        { field: "boardName", label: "Board Name" },
      ];
    }

    // Google Sheets "New Rows to Launch" trigger
    if (event === "New Rows to Launch" && service === "google-sheets") {
      const baseOutputs = [
        { field: "newRowCount", label: "New Row Count" },
        { field: "processedRowCount", label: "Processed Row Count" },
        { field: "skippedRowCount", label: "Skipped Row Count" },
        { field: "transformedRows", label: "Transformed Rows (batch)" },
        { field: "contributingRowNumbers", label: "Row Numbers" },
      ];

      // Add dynamic outputs from configured column mappings
      // customMappings format: { sheetColumn: appField }
      const customMappings = nodeConfig?.sheetConfig?.customMappings as Record<string, string> | undefined;
      if (customMappings) {
        const dynamicOutputs = Object.entries(customMappings)
          .filter(([sheetCol, appField]) => sheetCol && appField)
          .map(([sheetCol, appField]) => ({
            field: `mapped.${appField}`,
            label: `${appField} (${sheetCol})`,
          }));
        return [...baseOutputs, ...getGoogleSheetsLaunchRowOutputs(), ...dynamicOutputs];
      }

      return [...baseOutputs, ...getGoogleSheetsLaunchRowOutputs()];
    }

    // Google Sheets triggers - show dynamic data mappings if available
    if (event === "Cell Value Changed" || service === "google-sheets") {
      // Check if node has custom data mappings configured
      const dataMappings = nodeConfig?.dataMappings as { label: string; cell: string }[] | undefined;
      if (dataMappings && dataMappings.length > 0) {
        // Return dynamic outputs based on user's data mappings
        const dynamicOutputs = dataMappings
          .filter((m) => m.label && m.cell)
          .map((m) => ({
            field: m.label, // Use label as field name for reference
            label: `${m.label} (${m.cell})`, // Show label with cell reference
          }));

        return [{ field: "triggerValue", label: "Trigger Cell Value" }, ...dynamicOutputs];
      }

      // Fallback: legacy column-based outputs
      return [
        { field: "rowNumber", label: "Row Number" },
        { field: "triggerValue", label: "Trigger Value" },
        { field: "customName", label: "Name (mapped)" },
        { field: "description", label: "Description (mapped)" },
        { field: "mediaUrl", label: "Media URL (mapped)" },
        { field: "adSetId", label: "Ad Set ID (mapped)" },
        { field: "A", label: "Column A" },
        { field: "B", label: "Column B" },
        { field: "C", label: "Column C" },
        { field: "D", label: "Column D" },
        { field: "E", label: "Column E" },
        { field: "F", label: "Column F" },
      ];
    }

    // Google Drive triggers
    if (event === "New File in Folder" || service === "google-drive") {
      return [
        { field: "fileId", label: "File ID" },
        { field: "fileName", label: "File Name" },
        { field: "fileUrl", label: "File URL" },
        { field: "mimeType", label: "MIME Type" },
        { field: "thumbnailUrl", label: "Thumbnail URL" },
      ];
    }

    // Meta Ads Performance Threshold trigger
    if (event === "Performance Threshold" || (service === "meta-ads" && event === "Performance Threshold")) {
      return [
        { field: "qualifyingAdIds", label: "Qualifying Ad IDs" },
        { field: "qualifyingAdNames", label: "Qualifying Ad Names (all)" },
        { field: "qualifyingAdSetIds", label: "Qualifying Ad Set IDs" },
        { field: "qualifyingCampaignIds", label: "Qualifying Campaign IDs" },
        { field: "qualifyingAds", label: "Qualifying Ads (full data)" },
        { field: "adName", label: "Qualifying Ad Name" },
        { field: "adSetName", label: "Ad Set Name" },
        { field: "campaignName", label: "Campaign Name" },
        { field: "matchedCampaigns", label: "Matched Campaigns" },
        { field: "matchedAdSets", label: "Matched Ad Sets" },
        { field: "totalAdsChecked", label: "Total Ads Checked" },
      ];
    }

    // Meta Ads Performance Monitoring trigger
    if (event === "Performance Monitoring" || (service === "meta-ads" && event === "Performance Monitoring")) {
      return [
        { field: "summary", label: "Summary (ready-made)" },
        { field: "metricLabel", label: "Metric (formatted)" },
        { field: "directionLabel", label: "Direction (past tense)" },
        { field: "monitoringPercentage", label: "Threshold %" },
        { field: "actualChange", label: "Actual Change %" },
        { field: "currentValue", label: "Current Value" },
        { field: "previousValue", label: "Previous Value" },
        { field: "entityName", label: "Entity Name" },
        { field: "comparisonLabel", label: "Comparison Label" },
        { field: "monitoringLevel", label: "Monitoring Level" },
        { field: "monitoringMetric", label: "Metric (raw)" },
        { field: "monitoringDirection", label: "Direction (raw)" },
        { field: "monitoringComparisonWindow", label: "Comparison Window" },
        { field: "qualifyingCount", label: "Qualifying Count" },
        { field: "qualifyingEntityIds", label: "Qualifying Entity IDs" },
        { field: "qualifyingEntities", label: "Qualifying Entities (full data)" },
      ];
    }

    // Meta Ads Auto-Scale trigger
    if (event === "Auto-Scale" || (service === "meta-ads" && event === "Auto-Scale")) {
      return [
        { field: "qualifyingAdIds", label: "Qualifying Ad IDs" },
        { field: "qualifyingAds", label: "Qualifying Ads (full data)" },
        { field: "scaledAdSets", label: "Scaled Ad Set IDs" },
      ];
    }

    // Adscan triggers — keyed off the event constant (not the service-only
    // fallback that previously mis-routed typoed Launch-Volume events into the
    // Competitor branch). New adscan events MUST add a case here.
    if (
      service === ADSCAN_SERVICE ||
      isAdscanNewCompetitorAdEvent(event) ||
      isAdscanAdvertiserLaunchVolumeEvent(event)
    ) {
      switch (event) {
        case ADSCAN_NEW_COMPETITOR_AD_EVENT:
        case ADSCAN_NEW_COMPETITOR_AD_EVENT_LEGACY:
          // Mirrors AdscanTriggerData (adscan-competitor.ts). Only three vars
          // are exposed: a one-line summary, the count, and a pre-formatted
          // multi-line list of ads. Per-ad scalars and raw arrays were dropped
          // — see an earlier fix.
          return [
            { field: "summary", label: "Summary (ready-made)" },
            { field: "adCount", label: "Matching Ad Count" },
            { field: "adsList", label: "Ads List (formatted)" },
          ];
        case ADSCAN_ADVERTISER_LAUNCH_VOLUME_EVENT:
          // Mirrors AdscanLaunchVolumeTriggerData
          // (adscan-advertiser-launch-volume.ts). Same slim contract as the
          // sibling competitor trigger plus advertiser-count / threshold
          // metadata that Slack/email templates can interpolate.
          return [
            { field: "summary", label: "Summary (ready-made)" },
            { field: "advertiserCount", label: "Advertisers Crossing Threshold" },
            { field: "adCount", label: "Total Ads (across advertisers)" },
            { field: "adsList", label: "Ads List (formatted)" },
            { field: "windowDays", label: "Window (days)" },
            { field: "minCount", label: "Min Count Threshold" },
          ];
        default:
          return [];
      }
    }
  }

  return [];
}

function getGoogleSheetsLaunchRowOutputs(): { field: string; label: string }[] {
  return GOOGLE_SHEETS_LAUNCH_ROW_FIELDS.map((field) => ({
    field,
    label: formatSheetLaunchRowField(field),
  }));
}

function formatSheetLaunchRowField(field: string): string {
  return field
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase())
    .replace(/\bId\b/g, "ID")
    .replace(/\bUrl\b/g, "URL");
}

// Parse pill reference like "{{node-action-1.resultId}}"
function parsePillReference(value: string): { nodeId: string; field: string } | null {
  const match = value?.match(/\{\{(.+?)\.(.+?)\}\}/);
  if (!match) return null;
  return { nodeId: match[1], field: match[2] };
}

export function DataPillSelector({
  previousNodes,
  currentNode,
  currentValue,
  onSelect,
  accountId,
  accountType,
  fieldName,
  placeholder = "Select target...",
  showManualSelector = true,
}: DataPillSelectorProps) {
  // Get available outputs from ALL previous steps (triggers, actions, filters)
  // Pass node config to enable dynamic outputs (e.g., Google Sheets data mappings)
  const availableOutputs = previousNodes
    .filter((n) => n.position < currentNode.position)
    .filter((n) => getOutputsForEvent(n.event || "", n.type, n.service, n.config).length > 0)
    .map((node) => ({
      nodeId: node.id,
      stepNumber: node.position + 1,
      event: node.event || "",
      nodeType: node.type,
      outputs: getOutputsForEvent(node.event || "", node.type, node.service, node.config),
    }));

  // Check if current value is a pill reference
  const isPillReference = Boolean(currentValue?.startsWith("{{") && currentValue.endsWith("}}"));
  const pillRef = isPillReference && currentValue ? parsePillReference(currentValue) : null;

  // Find the step info for the selected pill
  const selectedStep = pillRef ? availableOutputs.find((s) => s.nodeId === pillRef.nodeId) : null;
  const selectedOutput = selectedStep ? selectedStep.outputs.find((o) => o.field === pillRef?.field) : null;

  return (
    <div className="space-y-2">
      {/* Show selected pill badge */}
      {pillRef && selectedStep && (
        <div className="flex items-center gap-2">
          <Badge className="bg-blue-100 text-blue-800 px-3 py-1.5 text-sm">
            <Zap className="w-3 h-3 mr-1.5" />
            Step {selectedStep.stepNumber}: {selectedOutput?.label || pillRef.field}
          </Badge>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onSelect("")}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Manual selector when no pill is selected */}
      {!pillRef && showManualSelector && accountId && (
        <AutomationAdSetSelector
          value={currentValue || ""}
          callbacks={{
            onChange: (value, name) => onSelect(value, name),
          }}
          accountId={accountId}
          accountType={accountType ?? null}
          itemType="adset"
          placeholder={placeholder}
        />
      )}

      {/* Available data pills from previous steps */}
      {availableOutputs.length > 0 && !pillRef && (
        <div className="mt-3 p-3 bg-muted/50 rounded-lg border border-dashed">
          <p className="text-xs text-muted-foreground mb-2 font-medium">Or use output from previous step:</p>
          <div className="flex flex-wrap gap-2">
            {availableOutputs.map((step) =>
              step.outputs
                .filter((output) => {
                  // For targetId field, only show resultId outputs (ad set/campaign IDs)
                  if (fieldName === "targetId") {
                    return output.field === "resultId";
                  }
                  // For name fields, show name outputs
                  if (fieldName === "adNameTemplate" || fieldName === "newName") {
                    return output.field.toLowerCase().includes("name");
                  }
                  return true;
                })
                .map((output) => (
                  <Badge
                    key={`${step.nodeId}-${output.field}`}
                    variant="outline"
                    className="cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-colors py-1.5 px-3"
                    onClick={() => onSelect(`{{${step.nodeId}.${output.field}}}`)}
                  >
                    <Zap className="w-3 h-3 mr-1.5 text-blue-500" />
                    Step {step.stepNumber}: {output.label}
                  </Badge>
                )),
            )}
          </div>
        </div>
      )}

      {/* Show hint when no previous steps have outputs */}
      {availableOutputs.length === 0 && !pillRef && (
        <p className="text-xs text-muted-foreground mt-1">
          Add a "Duplicate Ad Set" step before this to use its output here
        </p>
      )}
    </div>
  );
}
