"use client";

import { useEffect, useRef, useState } from "react";
import { type AutomationNode, useAutomation } from "../contexts/automation-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Zap, Play, Filter, Trash2, Clock, ShieldCheck, Layers } from "lucide-react";
import { getServiceInfo } from "../lib/service-icons";
import {
  getServiceTheme,
  getNodeTypeAccent,
  nodeTypeBadgeStyles,
  statusColors,
  statusGlowColors,
} from "../lib/service-themes";
import { getNodeSummary } from "../lib/node-summary";
import { ADSCAN_NEW_COMPETITOR_AD_EVENT_LEGACY, ADSCAN_NEW_COMPETITOR_AD_EVENT } from "../lib/adscan-events";
import { useCustomMetricsById } from "../lib/use-custom-metrics-by-id";
import { cn } from "@/lib/utils";
import Meta from "@/components/ui/icons/meta";

interface FlowNodeProps {
  node: AutomationNode;
  index: number;
  onNodeClick(node: AutomationNode): void;
  isSelected?: boolean;
}

const nodeIcons = {
  trigger: Zap,
  action: Play,
  filter: Filter,
  delay: Clock,
  approval: ShieldCheck,
};

const LAUNCH_TEMPLATE_ADS_EVENT = "Launch Template Ads";
const LEGACY_HUNCH_TEMPLATE_EVENT = "Create Media + Launch Ads from Templates";

// Helper to get display text for node events based on config
function getEventDisplayText(node: AutomationNode): string {
  if (!node.event) return "Select an event";

  // Media Library trigger - show board name only if specific board selected
  if (node.service === "media-library" && node.event === "Media Uploaded to Board") {
    if (node.config?.boardName) {
      return `Media Uploaded to ${node.config.boardName}`;
    }
    return "Media Uploaded"; // No specific board = all boards
  }

  // Meta Ads action - show template name for Launch Ad
  if (node.service === "meta-ads" && node.event === "Launch Ad") {
    if (node.config?.templateName) {
      return `Launch Ad • ${node.config.templateName}`;
    }
  }

  if (
    node.service === "meta-ads" &&
    (node.event === LAUNCH_TEMPLATE_ADS_EVENT || node.event === LEGACY_HUNCH_TEMPLATE_EVENT)
  ) {
    const count = Array.isArray(node.config?.templateIds) ? node.config.templateIds.length : 0;
    return count > 0 ? `Launch Template Ads • ${count}` : "Launch Template Ads";
  }

  if (
    node.service === "meta-ads" &&
    (node.event === "Duplicate Ad Set from Sheet Row" || node.event === "Prepare Dynamic Ad Set from Sheet Row")
  ) {
    return "Duplicate Ad Set from Sheet Row";
  }

  if (
    node.service === "meta-ads" &&
    (node.event === "Create Media from Templates" || node.event === "Create Dynamic Media from Templates")
  ) {
    const count = Array.isArray(node.config?.templateIds) ? node.config.templateIds.length : 0;
    return count > 0 ? `Create Media from Templates • ${count}` : "Create Media from Templates";
  }

  // Adscan trigger was renamed in an earlier fix — render legacy rules with the new label.
  if (node.service === "adscan" && node.event === ADSCAN_NEW_COMPETITOR_AD_EVENT_LEGACY) {
    return ADSCAN_NEW_COMPETITOR_AD_EVENT;
  }

  return node.event;
}

export function FlowNode({ node, index, onNodeClick, isSelected = false }: FlowNodeProps) {
  const { deleteNode, flow, assistantActiveStepId, invalidNodeId } = useAutomation();
  const isAssistantBuilding = assistantActiveStepId === node.id;
  // Set by a failed save that blamed this step, so the toast has something to point at.
  const isInvalid = invalidNodeId === node.id;
  const cardRef = useRef<HTMLDivElement | null>(null);

  // A long flow can push the blamed step off screen, which would leave the toast
  // referring to a card the user cannot see.
  useEffect(() => {
    if (!isInvalid) return;
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [isInvalid]);

  // Live buffered-count badge for media-library triggers with grouping enabled.
  // Polls the backend every 15s so the canvas reflects recent uploads.
  const isMediaBufferTrigger =
    node.type === "trigger" && node.service === "media-library" && !!node.config?.groupingEnabled;
  const groupThreshold = (node.config?.groupThreshold as number | undefined) || 5;
  const savedRuleId = typeof flow.id === "number" ? flow.id : null;
  const [bufferedCount, setBufferedCount] = useState<number | null>(null);

  useEffect(() => {
    if (!isMediaBufferTrigger || !savedRuleId) {
      setBufferedCount(null);
      return;
    }
    let cancelled = false;
    const fetchCount = async () => {
      try {
        const res = await fetch(`/api/automation-rules/media-buffer-count?ruleId=${savedRuleId}`);
        if (!res.ok) return;
        const data = (await res.json()) as { count?: number };
        if (!cancelled && typeof data.count === "number") {
          setBufferedCount(data.count);
        }
      } catch {
        // Non-critical — leave the badge hidden on error.
      }
    };
    fetchCount();
    const interval = setInterval(fetchCount, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isMediaBufferTrigger, savedRuleId]);

  const Icon = nodeIcons[node.type];
  const serviceInfo = node.service ? getServiceInfo(node.service) : null;
  const theme = getServiceTheme(node.service);
  const accent = getNodeTypeAccent(node.type);
  const typeBadgeStyle = nodeTypeBadgeStyles[node.type];
  const customMetricsById = useCustomMetricsById();
  const summary = getNodeSummary(node, { customMetricsById });

  const isConfigured = node.service && node.event;
  const status = isInvalid ? "error" : isConfigured ? "configured" : "warning";
  const isCreateMediaStep =
    node.service === "meta-ads" &&
    (node.event === "Create Media from Templates" || node.event === "Create Dynamic Media from Templates");
  const serviceLabel = isCreateMediaStep ? "the app" : serviceInfo?.label;

  // Render the service icon
  const renderServiceIcon = () => {
    if (!node.service) {
      return <Icon className="h-6 w-6 text-muted-foreground" />;
    }

    if (isCreateMediaStep) {
      return <Layers className="h-6 w-6 text-primary" />;
    }

    // Special handling for Meta icon
    if (node.service === "meta-ads") {
      return <Meta className="h-7 w-7" grayscale={false} />;
    }

    // Use emoji or image from service info
    if (serviceInfo) {
      // Handle image icons (local paths or URLs)
      if (
        serviceInfo.iconType === "image" ||
        (typeof serviceInfo.icon === "string" &&
          (serviceInfo.icon.startsWith("/") || serviceInfo.icon.startsWith("http")))
      ) {
        return <img src={serviceInfo.icon} alt={serviceInfo.label} className="h-7 w-7 object-contain" />;
      }
      return <span className="text-2xl">{serviceInfo.icon}</span>;
    }

    return <Icon className="h-6 w-6 text-muted-foreground" />;
  };

  return (
    <div
      ref={cardRef}
      data-testid={`flow-node-${node.type}-${index}`}
      data-node-type={node.type}
      data-node-service={node.service || ""}
      data-node-event={node.event || ""}
      data-node-invalid={isInvalid ? "true" : undefined}
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-xl bg-card transition-all duration-200 ease-out",
        "border shadow-sm hover:-translate-y-0.5",
        isSelected
          ? cn("border-primary shadow-lg ring-2 ring-offset-1 ring-offset-background", accent.selectedRing)
          : "border-border hover:border-gray-300 hover:shadow-md",
        // Live "assistant is building this step" pulse
        isAssistantBuilding &&
          "border-violet-400 shadow-lg ring-2 ring-violet-400/60 ring-offset-1 ring-offset-background animate-pulse",
        // Blamed by the last failed save. Wins over the selected ring so the card
        // stays obviously wrong even while the user has it open to fix it.
        isInvalid &&
          "border-destructive shadow-lg ring-2 ring-destructive/60 ring-offset-1 ring-offset-background hover:border-destructive",
      )}
      onClick={() => onNodeClick(node)}
    >
      {/* Coloured accent spine — keys the card to its node type at a glance */}
      <div
        className={cn(
          "absolute inset-y-0 left-0 w-1 transition-opacity",
          accent.spine,
          isSelected ? "opacity-100" : "opacity-60 group-hover:opacity-100",
        )}
      />

      {/* Header with step number, type badge, and status */}
      <div className="flex items-center justify-between px-4 pt-3">
        <div className="flex items-center gap-2">
          {/* Step number circle */}
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
            {index + 1}
          </span>

          {/* Node type badge */}
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5",
              typeBadgeStyle.bg,
              typeBadgeStyle.text,
              typeBadgeStyle.border,
            )}
          >
            {node.type}
          </Badge>
        </div>

        {/* Status indicator dot with a soft glow ring */}
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "h-2 w-2 rounded-full ring-2 transition-colors",
              statusColors[status],
              statusGlowColors[status],
            )}
          />
        </div>
      </div>

      {/* Body with icon, content, and menu */}
      <div className="flex items-start gap-3 p-4 pt-3">
        {/* Icon container with colored background */}
        <div
          className={cn(
            "flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl shadow-sm ring-1 ring-black/[0.04]",
            "transition-all duration-200 group-hover:scale-105 group-hover:shadow-md",
            node.service ? theme.iconBg : "bg-muted",
          )}
        >
          {renderServiceIcon()}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pt-0.5">
          <h3 className="font-semibold text-foreground truncate text-sm md:text-base">
            {serviceLabel ? `${serviceLabel} · ${getEventDisplayText(node)}` : "Choose an app"}
          </h3>
          {summary.subtitle && <p className="text-xs text-muted-foreground truncate mt-0.5">{summary.subtitle}</p>}
          {!summary.subtitle && serviceLabel && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{getEventDisplayText(node)}</p>
          )}
          {isMediaBufferTrigger && bufferedCount !== null && (
            <div className="flex items-center gap-1 mt-1">
              <Layers className="h-3 w-3 text-muted-foreground/70" />
              <span className="text-[10px] font-medium text-muted-foreground/70">
                Buffered: {bufferedCount} / {groupThreshold}
              </span>
            </div>
          )}
        </div>

        {/* Action menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
            >
              <MoreVertical className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                deleteNode(node.id);
              }}
              className="text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Chips row — active settings summary (e.g. "ROAS drops >20%", "All campaigns", "min £50") */}
      {summary.badges.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-border/60 px-4 py-2.5">
          {summary.badges.map((badge, i) => (
            <span
              key={i}
              className={cn(
                "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium",
                badge.tone === "warning"
                  ? "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200"
                  : badge.tone === "muted"
                    ? "bg-muted text-muted-foreground"
                    : "bg-primary/10 text-primary ring-1 ring-inset ring-primary/15",
              )}
            >
              {badge.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
